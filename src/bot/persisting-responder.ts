import { BotButton, EvolutionService } from '../evolution/evolution.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { BotResponder } from './responder';

/**
 * Responder usado no fluxo real do WhatsApp: envia pela Evolution E registra
 * cada saida no banco, para o painel conseguir mostrar a conversa completa.
 */
export class PersistingResponder implements BotResponder {
  constructor(
    private readonly evolution: EvolutionService,
    private readonly mensagens: MensagensService,
    private readonly telefone: string,
    private readonly clienteId: () => string | null,
  ) {}

  async enviarTexto(numero: string, texto: string): Promise<void> {
    await this.evolution.enviarTexto(numero, texto);
    await this.log('texto', texto);
  }

  async enviarMenu(numero: string, titulo: string, descricao: string, botoes: BotButton[]): Promise<void> {
    await this.evolution.enviarMenu(numero, titulo, descricao, botoes);
    await this.log('menu', this.menuComoTexto(titulo, descricao, botoes));
  }

  async enviarDocumento(numero: string, base64: string, nomeArquivo: string, legenda?: string): Promise<void> {
    await this.evolution.enviarDocumento(numero, base64, nomeArquivo, legenda);
    await this.log('documento', `[PDF] ${nomeArquivo}${legenda ? ' - ' + legenda : ''}`);
  }

  menuComoTexto(titulo: string, descricao: string, botoes: BotButton[]): string {
    return this.evolution.menuComoTexto(titulo, descricao, botoes);
  }

  private async log(tipo: string, conteudo: string): Promise<void> {
    try {
      await this.mensagens.registrar({
        telefone: this.telefone,
        clienteId: this.clienteId(),
        direcao: 'ENVIADA',
        tipo,
        conteudo,
      });
    } catch {
      /* nao quebrar o envio por falha de log */
    }
  }
}
