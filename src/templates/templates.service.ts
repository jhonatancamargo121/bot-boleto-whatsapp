import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PgService } from '../database/pg.service';

export interface Template {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

/** Tipos de campanha previstos na doc (secao 7.1). */
export const TIPOS_TEMPLATE = [
  'AVISO_VENCIMENTO',
  'COBRANCA_VENCIDA',
  'ATUALIZACAO_BOLETO',
  'SEGUNDA_VIA',
] as const;

@Injectable()
export class TemplatesService {
  constructor(private readonly pg: PgService) {}

  listar(): Promise<Template[]> {
    return this.pg.query<Template>(`SELECT * FROM templates ORDER BY created_at DESC`);
  }

  async obter(id: string): Promise<Template | undefined> {
    const rows = await this.pg.query<Template>(`SELECT * FROM templates WHERE id = $1`, [id]);
    return rows[0];
  }

  async criar(nome: string, tipo: string, conteudo: string): Promise<void> {
    await this.pg.query(
      `INSERT INTO templates (id, nome, tipo, conteudo) VALUES ($1,$2,$3,$4)`,
      [randomUUID(), nome.trim(), tipo, conteudo],
    );
  }

  async excluir(id: string): Promise<void> {
    await this.pg.query(`DELETE FROM templates WHERE id = $1`, [id]);
  }

  /** Substitui variaveis {{nome}}, {{telefone}}, {{empresa}}, etc. */
  renderizar(conteudo: string, dados: Record<string, string>): string {
    return conteudo.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, chave) => dados[chave] ?? `{{${chave}}}`);
  }
}
