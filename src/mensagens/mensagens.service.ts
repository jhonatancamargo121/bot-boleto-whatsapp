import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PgService } from '../database/pg.service';

export interface MensagemRegistro {
  telefone: string;
  clienteId?: string | null;
  direcao: 'RECEBIDA' | 'ENVIADA';
  tipo?: string;
  conteudo: string;
}

export interface ResumoConversa {
  telefone: string;
  nome: string | null;
  total: number;
  ultima_msg: string;
  ultima_data: string;
}

/**
 * Persiste e consulta o historico de mensagens (para o painel de monitoramento).
 */
@Injectable()
export class MensagensService {
  constructor(private readonly pg: PgService) {}

  async registrar(m: MensagemRegistro): Promise<void> {
    await this.pg.query(
      `INSERT INTO mensagens (id, telefone, cliente_id, direcao, tipo, conteudo)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), m.telefone, m.clienteId || null, m.direcao, m.tipo || 'texto', m.conteudo],
    );
  }

  /** Lista as conversas (1 por telefone) com ultima mensagem e contagem. */
  async listarConversas(): Promise<ResumoConversa[]> {
    return this.pg.query<ResumoConversa>(`
      SELECT m.telefone,
             c.nome,
             COUNT(*)::int AS total,
             (ARRAY_AGG(m.conteudo ORDER BY m.created_at DESC))[1] AS ultima_msg,
             MAX(m.created_at) AS ultima_data
      FROM mensagens m
      LEFT JOIN clientes c ON c.telefone_whatsapp = m.telefone
      GROUP BY m.telefone, c.nome
      ORDER BY MAX(m.created_at) DESC
    `);
  }

  /** Transcricao completa de uma conversa (ordenada pelo cursor seq). */
  async transcricao(telefone: string): Promise<
    Array<{ seq: number; direcao: string; tipo: string; conteudo: string; created_at: string }>
  > {
    return this.pg.query(
      `SELECT seq, direcao, tipo, conteudo, created_at
       FROM mensagens WHERE telefone = $1 ORDER BY seq ASC`,
      [telefone],
    );
  }

  /** Mensagens com seq > afterSeq (para o viewer em tempo real via polling). */
  async mensagensApos(
    telefone: string,
    afterSeq: number,
  ): Promise<Array<{ seq: number; direcao: string; tipo: string; conteudo: string; created_at: string }>> {
    return this.pg.query(
      `SELECT seq, direcao, tipo, conteudo, created_at
       FROM mensagens WHERE telefone = $1 AND seq > $2 ORDER BY seq ASC`,
      [telefone, afterSeq],
    );
  }
}
