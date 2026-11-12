import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { env } from '../config/env.config';

/**
 * Conexao com PostgreSQL (pool) + criacao das tabelas no boot.
 * Persiste clientes e o historico de mensagens, para o painel monitorar.
 */
@Injectable()
export class PgService implements OnModuleInit {
  private readonly logger = new Logger(PgService.name);
  private pool: Pool;

  async onModuleInit() {
    if (!env.database.url) {
      this.logger.error('DATABASE_URL vazia - o bot precisa do Postgres para persistir conversas');
      return;
    }
    this.pool = new Pool({ connectionString: env.database.url, max: 10 });
    await this.aguardarConexao();
    await this.criarTabelas();
    this.logger.log('PostgreSQL conectado e tabelas prontas');
  }

  private async aguardarConexao(tentativas = 15): Promise<void> {
    for (let i = 1; i <= tentativas; i++) {
      try {
        await this.pool.query('SELECT 1');
        return;
      } catch (e) {
        this.logger.warn(`Postgres indisponivel (tentativa ${i}/${tentativas})...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error('Nao foi possivel conectar ao Postgres');
  }

  async query<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }

  private async criarTabelas(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id UUID PRIMARY KEY,
        nome TEXT NOT NULL,
        cpf_cnpj TEXT,
        telefone_whatsapp TEXT UNIQUE NOT NULL,
        origem TEXT DEFAULT 'WHATSAPP',
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS mensagens (
        id UUID PRIMARY KEY,
        telefone TEXT NOT NULL,
        cliente_id UUID,
        direcao TEXT NOT NULL,          -- RECEBIDA | ENVIADA
        tipo TEXT NOT NULL DEFAULT 'texto', -- texto | menu | documento | ia | atendente
        conteudo TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    // seq: cursor monotonico para o viewer em tempo real (polling "apos N")
    await this.pool.query(`ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS seq BIGSERIAL;`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_mensagens_telefone ON mensagens (telefone, seq);`);

    // Contatos para campanhas (sincronizados do WhatsApp, manual ou CSV)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS contatos (
        id UUID PRIMARY KEY,
        nome TEXT,
        telefone TEXT UNIQUE NOT NULL,
        cpf_cnpj TEXT,
        origem TEXT DEFAULT 'MANUAL',   -- MANUAL | CSV | WHATSAPP_SYNC
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Templates de mensagem (cobranca, aviso, etc.) com variaveis {{nome}}...
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id UUID PRIMARY KEY,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'COBRANCA_VENCIDA',
        conteudo TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Campanhas de disparo em lote
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS campanhas (
        id UUID PRIMARY KEY,
        nome TEXT NOT NULL,
        template_id UUID,
        status TEXT NOT NULL DEFAULT 'RASCUNHO', -- RASCUNHO | ENVIANDO | CONCLUIDA
        total INT DEFAULT 0,
        enviados INT DEFAULT 0,
        falhas INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        executed_at TIMESTAMPTZ
      );
    `);

    // Atendentes humanos cadastrados (para handoff)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS atendentes (
        id UUID PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Modo de atendimento por conversa: BOT (automatico) ou HUMANO (bot pausado)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS conversa_modo (
        telefone TEXT PRIMARY KEY,
        modo TEXT NOT NULL DEFAULT 'BOT',   -- BOT | HUMANO
        atendente_telefone TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
  }
}
