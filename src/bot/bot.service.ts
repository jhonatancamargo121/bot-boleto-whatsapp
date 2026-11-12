import { Injectable, Logger } from '@nestjs/common';
import { ClientesService } from '../clientes/clientes.service';
import { BoletosService } from '../boletos/boletos.service';
import { ConversasService } from '../conversas/conversas.service';
import { EstadoConversa } from '../conversas/conversa.types';
import { EvolutionService, BotButton } from '../evolution/evolution.service';
import { IaService } from '../ia/ia.service';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { AtendentesService } from '../atendentes/atendentes.service';
import { BotResponder } from './responder';
import { env } from '../config/env.config';

const MENU_BOTOES: BotButton[] = [
  { id: 'segunda_via', texto: 'Segunda via de boleto' },
  { id: 'ja_paguei', texto: 'Ja efetuei o pagamento' },
  { id: 'atendente', texto: 'Falar com atendente' },
];

/**
 * Orquestra o fluxo de conversa do WhatsApp.
 * Regras (conforme doc, secao 6): opcoes numericas e palavras-chave simples,
 * sem IA. Cadastro do cliente em memoria + segunda via simulada.
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    private readonly clientes: ClientesService,
    private readonly boletos: BoletosService,
    private readonly conversas: ConversasService,
    private readonly evolution: EvolutionService,
    private readonly ia: IaService,
    private readonly atendimento: AtendimentoService,
    private readonly atendentes: AtendentesService,
  ) {}

  /**
   * Ponto de entrada do fluxo. `responder` define o canal de saida
   * (Evolution real no webhook, ou capturador no simulador).
   */
  async processarMensagem(
    telefone: string,
    textoBruto: string,
    pushName?: string,
    responder: BotResponder = this.evolution,
  ): Promise<void> {
    const texto = (textoBruto || '').trim();
    const lower = texto.toLowerCase();
    this.logger.log(`<- ${telefone}: ${texto}`);

    // Se a conversa esta em atendimento HUMANO, o bot fica em silencio.
    // (A reativacao do bot e feita pelo atendente no painel.)
    if ((await this.atendimento.obterModo(telefone)) === 'HUMANO') {
      this.logger.log(`(modo HUMANO - bot silenciado para ${telefone})`);
      return;
    }

    // Comandos globais
    if (['menu', 'inicio', 'voltar', '0'].includes(lower)) {
      const cli = await this.clientes.buscarPorTelefone(telefone);
      if (cli) {
        this.conversas.atualizar(telefone, { estado: EstadoConversa.MENU });
        return this.mostrarMenu(telefone, cli.nome, responder);
      }
    }

    const cliente = await this.clientes.buscarPorTelefone(telefone);
    const conversa = this.conversas.obter(telefone);

    // ===== Cliente ainda nao cadastrado: fluxo de cadastro =====
    if (!cliente) {
      switch (conversa.estado) {
        case EstadoConversa.AGUARDANDO_NOME:
          this.conversas.atualizar(telefone, {
            estado: EstadoConversa.AGUARDANDO_CPF,
            rascunhoNome: texto,
          });
          return responder.enviarTexto(
            telefone,
            `Obrigado, ${texto.split(' ')[0]}! Agora informe seu *CPF ou CNPJ* (somente numeros).`,
          );

        case EstadoConversa.AGUARDANDO_CPF:
          if (!this.clientes.validarCpfCnpj(texto)) {
            return responder.enviarTexto(
              telefone,
              'CPF/CNPJ invalido. Envie 11 digitos (CPF) ou 14 digitos (CNPJ), somente numeros.',
            );
          }
          {
            const novo = await this.clientes.cadastrar({
              nome: conversa.rascunhoNome || pushName || 'Cliente',
              cpfCnpj: texto,
              telefone,
            });
            this.conversas.atualizar(telefone, { estado: EstadoConversa.MENU, rascunhoNome: undefined });
            await responder.enviarTexto(
              telefone,
              `Cadastro concluido com sucesso, ${novo.nome.split(' ')[0]}! ✅`,
            );
            return this.mostrarMenu(telefone, novo.nome, responder);
          }

        default:
          // INICIO ou qualquer estado: saudacao + inicia cadastro
          this.conversas.atualizar(telefone, { estado: EstadoConversa.AGUARDANDO_NOME });
          return responder.enviarTexto(
            telefone,
            `Ola! Bem-vindo(a) a *${env.bot.empresaNome}*.\n` +
              `Nao encontrei seu cadastro por este numero.\n\n` +
              `Para comecar, qual o seu *nome completo*?`,
          );
      }
    }

    // ===== Cliente cadastrado =====
    if (conversa.estado === EstadoConversa.AGUARDANDO_SELECAO_BOLETO) {
      return this.tratarSelecaoBoleto(telefone, texto, responder);
    }

    // Interpreta opcao do menu (numero, id do botao ou palavra-chave)
    const opcao = this.interpretarOpcaoMenu(lower);
    switch (opcao) {
      case 'segunda_via':
        return this.iniciarSegundaVia(telefone, responder);
      case 'ja_paguei':
        return responder.enviarTexto(
          telefone,
          'Certo! Registramos que voce ja efetuou o pagamento. ' +
            'Assim que a baixa for confirmada pelo banco, o boleto sera atualizado automaticamente. ' +
            'Se precisar, envie o comprovante por aqui.',
        );
      case 'atendente':
        return this.transferirParaHumano(telefone, cliente.nome, responder);
      default:
        // Texto livre: deixa a IA (DeepSeek) responder DENTRO do escopo de
        // segunda via/boleto. Fallback para o menu se a IA estiver off/falhar.
        return this.responderComIa(telefone, texto, cliente.nome, responder);
    }
  }

  /** Coloca a conversa em atendimento humano: pausa o bot e avisa o atendente. */
  private async transferirParaHumano(telefone: string, nome: string, responder: BotResponder): Promise<void> {
    const atendente = await this.atendentes.plantao();
    await this.atendimento.definirModo(telefone, 'HUMANO', atendente?.telefone);

    await responder.enviarTexto(
      telefone,
      'Certo! Estou transferindo voce para um atendente humano. ' +
        'Em instantes alguem da nossa equipe continua o atendimento por aqui. 👤',
    );

    // Notifica o atendente de plantao no WhatsApp dele (best-effort).
    if (atendente?.telefone) {
      try {
        await this.evolution.enviarTexto(
          atendente.telefone,
          `🔔 Novo atendimento humano solicitado.\n` +
            `Cliente: ${nome}\nWhatsApp: ${telefone}\n\n` +
            `Responda pelo painel: ${env.bot.empresaNome} (modo humano ativado, o bot esta pausado para este contato).`,
        );
      } catch (e) {
        this.logger.warn(`Nao foi possivel notificar o atendente: ${(e as Error).message}`);
      }
    }
  }

  private async responderComIa(
    telefone: string,
    texto: string,
    nome: string,
    responder: BotResponder,
  ): Promise<void> {
    const resposta = await this.ia.responder(texto);
    if (resposta) {
      await responder.enviarTexto(telefone, resposta);
      return;
    }
    // Sem IA disponivel: orienta e mostra o menu.
    await responder.enviarTexto(
      telefone,
      'Posso ajudar com a *segunda via do seu boleto*. Veja as opcoes abaixo:',
    );
    return this.mostrarMenu(telefone, nome, responder);
  }

  private async mostrarMenu(telefone: string, nome: string, responder: BotResponder): Promise<void> {
    await responder.enviarMenu(
      telefone,
      `Ola, ${nome.split(' ')[0]}!`,
      'Como podemos ajudar? Escolha uma opcao:',
      MENU_BOTOES,
    );
  }

  private interpretarOpcaoMenu(lower: string): string | null {
    if (['1', 'segunda_via', 'segunda via', 'boleto', '2 via', 'segunda'].includes(lower)) return 'segunda_via';
    if (['2', 'ja_paguei', 'paguei', 'ja paguei', 'pago'].includes(lower)) return 'ja_paguei';
    if (['3', 'atendente', 'atendimento', 'humano'].includes(lower)) return 'atendente';
    return null;
  }

  private async iniciarSegundaVia(telefone: string, responder: BotResponder): Promise<void> {
    const cliente = (await this.clientes.buscarPorTelefone(telefone))!;
    const boletos = this.boletos.obterBoletosEmAberto(cliente);

    if (boletos.length === 0) {
      this.conversas.atualizar(telefone, { estado: EstadoConversa.MENU });
      return responder.enviarTexto(
        telefone,
        'Nao localizei boletos em aberto para o seu cadastro. ✅\nDigite *menu* para outras opcoes.',
      );
    }

    if (boletos.length === 1) {
      return this.enviarSegundaVia(telefone, boletos[0].id, responder);
    }

    // Multiplos boletos: lista e aguarda selecao
    const linhas = boletos
      .map(
        (b, i) =>
          `${i + 1}. Parcela ${b.numeroParcela} - venc. ${this.boletos.formatarData(b.dataVencimento)} - ${this.boletos.formatarValor(b.valor)} (${b.status})`,
      )
      .join('\n');
    this.conversas.atualizar(telefone, {
      estado: EstadoConversa.AGUARDANDO_SELECAO_BOLETO,
      boletosListados: boletos.map((b) => b.id),
    });
    return responder.enviarTexto(
      telefone,
      `Voce possui ${boletos.length} boletos em aberto:\n\n${linhas}\n\n` +
        `Responda com o *numero* do boleto que deseja receber (ou *menu* para voltar).`,
    );
  }

  private async tratarSelecaoBoleto(telefone: string, texto: string, responder: BotResponder): Promise<void> {
    const conversa = this.conversas.obter(telefone);
    const ids = conversa.boletosListados || [];
    const indice = parseInt(texto.replace(/\D/g, ''), 10);

    if (isNaN(indice) || indice < 1 || indice > ids.length) {
      return responder.enviarTexto(
        telefone,
        `Opcao invalida. Responda com um numero de 1 a ${ids.length}, ou digite *menu*.`,
      );
    }
    return this.enviarSegundaVia(telefone, ids[indice - 1], responder);
  }

  private async enviarSegundaVia(telefone: string, boletoId: string, responder: BotResponder): Promise<void> {
    const cliente = (await this.clientes.buscarPorTelefone(telefone))!;
    const boletos = this.boletos.obterBoletosEmAberto(cliente);
    const boleto = boletos.find((b) => b.id === boletoId);

    if (!boleto) {
      this.conversas.atualizar(telefone, { estado: EstadoConversa.MENU });
      return responder.enviarTexto(telefone, 'Boleto nao encontrado. Digite *menu* para recomecar.');
    }

    // Texto da segunda via (template da doc, secao 6.3)
    await responder.enviarTexto(
      telefone,
      `Segue a segunda via do seu boleto.\n\n` +
        `Contrato: ${boleto.numeroContrato}\n` +
        `Parcela: ${boleto.numeroParcela}\n` +
        `Vencimento: ${this.boletos.formatarData(boleto.dataVencimento)}\n` +
        `Valor: ${this.boletos.formatarValor(boleto.valor)}\n\n` +
        `Linha digitavel:\n${boleto.linhaDigitavel}`,
    );

    // PDF (simulado)
    if (env.bot.sendPdf) {
      try {
        const base64 = await this.boletos.gerarPdfBase64(cliente, boleto);
        await responder.enviarDocumento(
          telefone,
          base64,
          `boleto-${boleto.codigoExterno}.pdf`,
          'Segunda via em PDF (documento simulado)',
        );
      } catch (e) {
        this.logger.warn(`Falha ao gerar/enviar PDF: ${(e as Error).message}`);
      }
    }

    this.conversas.atualizar(telefone, { estado: EstadoConversa.MENU, boletosListados: undefined });
    await responder.enviarTexto(telefone, 'Posso ajudar em algo mais? Digite *menu* para ver as opcoes.');
  }
}
