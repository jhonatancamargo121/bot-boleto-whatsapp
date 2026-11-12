import { Injectable } from '@nestjs/common';
import { PgService } from '../database/pg.service';

export type ModoAtendimento = 'BOT' | 'HUMANO';

/**
 * Controla o modo de cada conversa: BOT (automatico) ou HUMANO (bot pausado,
 * atendente assume pelo painel). Persistido para sobreviver a reinicios.
 */
@Injectable()
export class AtendimentoService {
  constructor(private readonly pg: PgService) {}

  async obterModo(telefone: string): Promise<ModoAtendimento> {
    const rows = await this.pg.query<{ modo: ModoAtendimento }>(
      `SELECT modo FROM conversa_modo WHERE telefone = $1`,
      [telefone],
    );
    return rows[0]?.modo || 'BOT';
  }

  async definirModo(telefone: string, modo: ModoAtendimento, atendenteTelefone?: string): Promise<void> {
    await this.pg.query(
      `INSERT INTO conversa_modo (telefone, modo, atendente_telefone, updated_at)
       VALUES ($1,$2,$3, now())
       ON CONFLICT (telefone)
       DO UPDATE SET modo = EXCLUDED.modo, atendente_telefone = EXCLUDED.atendente_telefone, updated_at = now()`,
      [telefone, modo, atendenteTelefone || null],
    );
  }

  /** Telefones atualmente em atendimento humano (para destacar no painel). */
  async telefonesEmHumano(): Promise<Set<string>> {
    const rows = await this.pg.query<{ telefone: string }>(
      `SELECT telefone FROM conversa_modo WHERE modo = 'HUMANO'`,
    );
    return new Set(rows.map((r) => r.telefone));
  }
}
