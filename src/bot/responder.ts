import { BotButton } from '../evolution/evolution.service';

/**
 * Canal de saida do bot. Permite que o mesmo fluxo seja usado tanto para o
 * WhatsApp real (Evolution) quanto para o simulador local (que captura as
 * mensagens em memoria para inspecao).
 */
export interface BotResponder {
  enviarTexto(numero: string, texto: string): Promise<void>;
  enviarMenu(numero: string, titulo: string, descricao: string, botoes: BotButton[]): Promise<void>;
  enviarDocumento(numero: string, base64: string, nomeArquivo: string, legenda?: string): Promise<void>;
  menuComoTexto(titulo: string, descricao: string, botoes: BotButton[]): string;
}

export interface MensagemCapturada {
  tipo: 'texto' | 'menu' | 'documento';
  conteudo: string;
  arquivo?: string;
}

/** Responder usado pelo simulador: nao envia ao WhatsApp, apenas guarda o que seria enviado. */
export class CaptureResponder implements BotResponder {
  public readonly mensagens: MensagemCapturada[] = [];

  async enviarTexto(_numero: string, texto: string): Promise<void> {
    this.mensagens.push({ tipo: 'texto', conteudo: texto });
  }

  async enviarMenu(_numero: string, titulo: string, descricao: string, botoes: BotButton[]): Promise<void> {
    this.mensagens.push({ tipo: 'menu', conteudo: this.menuComoTexto(titulo, descricao, botoes) });
  }

  async enviarDocumento(_numero: string, _base64: string, nomeArquivo: string, legenda?: string): Promise<void> {
    this.mensagens.push({ tipo: 'documento', conteudo: legenda || '', arquivo: nomeArquivo });
  }

  menuComoTexto(titulo: string, descricao: string, botoes: BotButton[]): string {
    const linhas = botoes.map((b, i) => `${i + 1}. ${b.texto}`).join('\n');
    return `*${titulo}*\n${descricao}\n\n${linhas}\n\n_Responda com o numero da opcao._`;
  }
}
