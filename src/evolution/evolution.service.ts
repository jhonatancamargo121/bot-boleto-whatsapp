import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env.config';

export interface BotButton {
  id: string;
  texto: string;
}

/**
 * Cliente da Evolution API (v2).
 * Responsavel por enviar mensagens, botoes/listas e documentos (PDF) ao WhatsApp.
 *
 * Endpoints usados (Evolution v2):
 *  - POST /message/sendText/{instance}
 *  - POST /message/sendButtons/{instance}
 *  - POST /message/sendList/{instance}
 *  - POST /message/sendMedia/{instance}
 */
@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly http: AxiosInstance;
  private readonly instance = env.evolution.instance;

  constructor() {
    this.http = axios.create({
      baseURL: env.evolution.apiUrl,
      headers: { apikey: env.evolution.apiKey, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  }

  /** Solicita o QR/pairing code para conectar a instancia ao WhatsApp. */
  async conectar(): Promise<any> {
    const { data } = await this.http.get(`/instance/connect/${this.instance}`);
    return data;
  }

  /** Estado atual da conexao da instancia (open / connecting / close). */
  async estadoConexao(): Promise<any> {
    const { data } = await this.http.get(`/instance/connectionState/${this.instance}`);
    return data;
  }

  /** Lista os contatos do WhatsApp da instancia (requer numero conectado). */
  async buscarContatos(): Promise<any[]> {
    const { data } = await this.http.post(`/chat/findContacts/${this.instance}`, {});
    return Array.isArray(data) ? data : data?.contacts || [];
  }

  /** Envia mensagem de texto simples. */
  async enviarTexto(numero: string, texto: string): Promise<void> {
    await this.post(`/message/sendText/${this.instance}`, { number: numero, text: texto });
  }

  /**
   * Envia um menu de opcoes ao cliente.
   * Se USE_BUTTONS=true tenta botoes interativos; caso contrario (ou em falha)
   * envia as opcoes como texto numerado, que e o caminho mais confiavel no WhatsApp.
   */
  async enviarMenu(numero: string, titulo: string, descricao: string, botoes: BotButton[]): Promise<void> {
    if (env.bot.useButtons) {
      try {
        await this.post(`/message/sendButtons/${this.instance}`, {
          number: numero,
          title: titulo,
          description: descricao,
          buttons: botoes.map((b) => ({ type: 'reply', displayText: b.texto, id: b.id })),
        });
        return;
      } catch (e) {
        this.logger.warn(`Botoes falharam, usando fallback de texto numerado: ${this.errMsg(e)}`);
      }
    }
    await this.enviarTexto(numero, this.menuComoTexto(titulo, descricao, botoes));
  }

  /** Monta o menu como texto numerado (fallback universal). */
  menuComoTexto(titulo: string, descricao: string, botoes: BotButton[]): string {
    const linhas = botoes.map((b, i) => `${i + 1}. ${b.texto}`).join('\n');
    return `*${titulo}*\n${descricao}\n\n${linhas}\n\n_Responda com o numero da opcao._`;
  }

  /** Envia um documento (PDF) em base64. */
  async enviarDocumento(numero: string, base64: string, nomeArquivo: string, legenda?: string): Promise<void> {
    await this.post(`/message/sendMedia/${this.instance}`, {
      number: numero,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: base64,
      fileName: nomeArquivo,
      caption: legenda || '',
    });
  }

  private async post(path: string, body: unknown): Promise<void> {
    try {
      await this.http.post(path, body);
    } catch (e) {
      this.logger.error(`Falha ao chamar Evolution ${path}: ${this.errMsg(e)}`);
      throw e;
    }
  }

  private errMsg(e: unknown): string {
    if (axios.isAxiosError(e)) {
      return `${e.response?.status} ${JSON.stringify(e.response?.data) || e.message}`;
    }
    return (e as Error)?.message || String(e);
  }
}
