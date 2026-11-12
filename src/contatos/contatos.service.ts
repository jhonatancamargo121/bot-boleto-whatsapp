import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PgService } from '../database/pg.service';
import { EvolutionService } from '../evolution/evolution.service';

export interface Contato {
  id: string;
  nome: string | null;
  telefone: string;
  cpf_cnpj: string | null;
  origem: string;
  created_at: string;
}

@Injectable()
export class ContatosService {
  private readonly logger = new Logger(ContatosService.name);

  constructor(
    private readonly pg: PgService,
    private readonly evolution: EvolutionService,
  ) {}

  listar(): Promise<Contato[]> {
    return this.pg.query<Contato>(`SELECT * FROM contatos ORDER BY nome NULLS LAST, created_at DESC`);
  }

  todosTelefones(): Promise<{ telefone: string; nome: string | null }[]> {
    return this.pg.query(`SELECT telefone, nome FROM contatos`);
  }

  /** Insere/atualiza um contato (idempotente por telefone). */
  async upsert(dados: { nome?: string; telefone: string; cpfCnpj?: string; origem?: string }): Promise<void> {
    const tel = dados.telefone.replace(/\D/g, '');
    if (tel.length < 10) return;
    await this.pg.query(
      `INSERT INTO contatos (id, nome, telefone, cpf_cnpj, origem)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (telefone)
       DO UPDATE SET nome = COALESCE(EXCLUDED.nome, contatos.nome),
                     cpf_cnpj = COALESCE(EXCLUDED.cpf_cnpj, contatos.cpf_cnpj)`,
      [randomUUID(), dados.nome?.trim() || null, tel, dados.cpfCnpj?.replace(/\D/g, '') || null, dados.origem || 'MANUAL'],
    );
  }

  async excluir(id: string): Promise<void> {
    await this.pg.query(`DELETE FROM contatos WHERE id = $1`, [id]);
  }

  /**
   * Importa contatos de um texto CSV: linhas "nome;telefone;cpf_cnpj"
   * (cpf_cnpj opcional). Aceita virgula ou ponto-e-virgula. Retorna quantos importou.
   */
  async importarCsv(texto: string): Promise<number> {
    let n = 0;
    for (const linha of texto.split(/\r?\n/)) {
      const l = linha.trim();
      if (!l || /nome.*telefone/i.test(l)) continue; // pula vazio/cabecalho
      const cols = l.split(/[;,]/).map((c) => c.trim());
      const [nome, telefone, cpf] = cols;
      if (!telefone) continue;
      await this.upsert({ nome, telefone, cpfCnpj: cpf, origem: 'CSV' });
      n++;
    }
    return n;
  }

  /**
   * Sincroniza contatos da instancia Evolution (WhatsApp). So funciona com o
   * numero conectado. Retorna quantos contatos foram processados.
   */
  async sincronizarWhatsapp(): Promise<number> {
    const contatos = await this.evolution.buscarContatos();
    let n = 0;
    for (const c of contatos) {
      const jid: string = c.id || c.remoteJid || '';
      if (!jid.endsWith('@s.whatsapp.net')) continue; // ignora grupos/broadcast
      const telefone = jid.split('@')[0];
      await this.upsert({ nome: c.pushName || c.name || c.notify, telefone, origem: 'WHATSAPP_SYNC' });
      n++;
    }
    this.logger.log(`Sincronizados ${n} contatos do WhatsApp`);
    return n;
  }
}
