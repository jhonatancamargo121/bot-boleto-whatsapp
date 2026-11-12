import { Body, Controller, Get, HttpCode, Logger, Post, Query } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import { EvolutionService } from '../evolution/evolution.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { ClientesService } from '../clientes/clientes.service';
import { PersistingResponder } from '../bot/persisting-responder';
import { env } from '../config/env.config';

/**
 * Recebe os eventos da Evolution API (evento MESSAGES_UPSERT).
 * Configure o webhook da instancia para: POST {URL}/webhook/whatsapp?token=WEBHOOK_TOKEN
 *
 * Cada mensagem recebida e enviada e registrada no banco (para o painel).
 */
@Controller('webhook/whatsapp')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly bot: BotService,
    private readonly evolution: EvolutionService,
    private readonly mensagens: MensagensService,
    private readonly clientes: ClientesService,
  ) {}

  @Get()
  verificar(): string {
    return 'ok';
  }

  @HttpCode(200)
  @Post()
  async receber(@Query('token') token: string, @Body() body: any): Promise<{ success: boolean }> {
    if (env.webhookToken && token !== env.webhookToken) {
      this.logger.warn('Webhook recebido com token invalido - ignorado');
      return { success: false };
    }

    try {
      const eventos = this.extrairMensagens(body);
      for (const ev of eventos) {
        if (ev.fromMe || ev.isGroup || !ev.texto) continue;

        const cliente = await this.clientes.buscarPorTelefone(ev.telefone);
        const clienteId = cliente?.id || null;

        // Registra a mensagem recebida
        await this.mensagens
          .registrar({
            telefone: ev.telefone,
            clienteId,
            direcao: 'RECEBIDA',
            tipo: 'texto',
            conteudo: ev.texto,
          })
          .catch(() => undefined);

        // Processa pelo bot, persistindo as respostas
        const responder = new PersistingResponder(
          this.evolution,
          this.mensagens,
          ev.telefone,
          () => clienteId,
        );
        await this.bot.processarMensagem(ev.telefone, ev.texto, ev.pushName, responder);
      }
    } catch (e) {
      this.logger.error(`Erro processando webhook: ${(e as Error).message}`);
    }
    return { success: true };
  }

  /**
   * Normaliza o payload da Evolution v2. O campo "data" pode vir como objeto
   * unico ou array. Extrai telefone, texto (varios formatos) e flags.
   */
  private extrairMensagens(body: any): Array<{
    telefone: string;
    texto: string;
    pushName?: string;
    fromMe: boolean;
    isGroup: boolean;
  }> {
    const lista = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean);
    return lista.map((d: any) => {
      const remoteJid: string = d?.key?.remoteJid || '';
      const msg = d?.message || {};
      const texto =
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.buttonsResponseMessage?.selectedButtonId ||
        msg.buttonsResponseMessage?.selectedDisplayText ||
        msg.templateButtonReplyMessage?.selectedId ||
        msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
        msg.listResponseMessage?.title ||
        '';
      return {
        telefone: remoteJid.split('@')[0],
        texto: String(texto || ''),
        pushName: d?.pushName,
        fromMe: !!d?.key?.fromMe,
        isGroup: remoteJid.endsWith('@g.us'),
      };
    });
  }
}
