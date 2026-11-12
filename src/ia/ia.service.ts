import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { env } from '../config/env.config';

/**
 * Integração com a DeepSeek (chat completions).
 *
 * ESCOPO TRAVADO: o agente responde EXCLUSIVAMENTE sobre emissão de segunda via
 * de boleto e dúvidas técnicas relacionadas. Qualquer outro assunto deve ser
 * recusado com educação e o cliente direcionado ao menu. Nunca inventa valores,
 * vencimentos ou linha digitável — esses dados vêm da opção de segunda via.
 */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  private readonly systemPrompt =
    `Você é o atendente virtual da ${env.bot.empresaNome}, especializado APENAS em ` +
    `SEGUNDA VIA DE BOLETO e dúvidas técnicas relacionadas (linha digitável, vencimento, ` +
    `valor, status do boleto, como pagar, prazos). ` +
    `REGRAS OBRIGATÓRIAS:\n` +
    `1) Responda somente sobre segunda via/boleto. Se perguntarem qualquer outra coisa ` +
    `(vendas, negociação de dívida, valores de contrato, assuntos pessoais, etc.), ` +
    `recuse educadamente e diga que só pode ajudar com a segunda via do boleto.\n` +
    `2) NUNCA invente número de boleto, valor, vencimento ou linha digitável. ` +
    `Para obter o boleto, oriente o cliente a escolher a opção "Segunda via de boleto" no menu.\n` +
    `3) Não negocie descontos, parcelamentos ou prazos. Não dê conselho jurídico ou financeiro.\n` +
    `4) Seja breve (até 3 frases), cordial e em português do Brasil.\n` +
    `5) Sempre que fizer sentido, lembre que o cliente pode digitar *menu* para ver as opções.`;

  /**
   * Gera uma resposta curta para uma dúvida em linguagem natural, dentro do escopo.
   * Retorna null se a IA estiver desabilitada ou falhar (o chamador faz fallback).
   */
  async responder(textoCliente: string): Promise<string | null> {
    if (!env.ia.enabled) return null;
    try {
      const { data } = await axios.post(
        `${env.ia.apiUrl}/chat/completions`,
        {
          model: env.ia.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: textoCliente },
          ],
          temperature: 0.3,
          max_tokens: 220,
        },
        {
          headers: {
            Authorization: `Bearer ${env.ia.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );
      const resposta = data?.choices?.[0]?.message?.content?.trim();
      return resposta || null;
    } catch (e: any) {
      this.logger.warn(`DeepSeek falhou: ${e?.response?.status || ''} ${e?.message || e}`);
      return null;
    }
  }
}
