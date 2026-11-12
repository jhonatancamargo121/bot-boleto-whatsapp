import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PgService } from '../database/pg.service';

export interface Atendente {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
  created_at: string;
}

@Injectable()
export class AtendentesService {
  constructor(private readonly pg: PgService) {}

  listar(): Promise<Atendente[]> {
    return this.pg.query<Atendente>(`SELECT * FROM atendentes ORDER BY created_at DESC`);
  }

  async criar(nome: string, telefone: string): Promise<void> {
    await this.pg.query(
      `INSERT INTO atendentes (id, nome, telefone, ativo) VALUES ($1,$2,$3,TRUE)`,
      [randomUUID(), nome.trim(), telefone.replace(/\D/g, '')],
    );
  }

  async excluir(id: string): Promise<void> {
    await this.pg.query(`DELETE FROM atendentes WHERE id = $1`, [id]);
  }

  /** Retorna o primeiro atendente ativo (plantao) para receber o handoff. */
  async plantao(): Promise<Atendente | undefined> {
    const rows = await this.pg.query<Atendente>(
      `SELECT * FROM atendentes WHERE ativo = TRUE ORDER BY created_at ASC LIMIT 1`,
    );
    return rows[0];
  }
}
