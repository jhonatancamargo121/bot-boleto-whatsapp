import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cliente } from './cliente.entity';
import { PgService } from '../database/pg.service';

interface ClienteRow {
  id: string;
  nome: string;
  cpf_cnpj: string;
  telefone_whatsapp: string;
  origem: string;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Repositorio de clientes em PostgreSQL.
 * (Os boletos seguem simulados em memoria; aqui persistimos o cadastro real
 * para que o painel consiga exibir quem e cada conversa.)
 */
@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);

  constructor(private readonly pg: PgService) {}

  async buscarPorTelefone(telefone: string): Promise<Cliente | undefined> {
    const rows = await this.pg.query<ClienteRow>(
      `SELECT * FROM clientes WHERE telefone_whatsapp = $1 LIMIT 1`,
      [telefone],
    );
    return rows[0] ? this.toEntity(rows[0]) : undefined;
  }

  /** Valida formato basico de CPF (11) ou CNPJ (14) por quantidade de digitos. */
  validarCpfCnpj(valor: string): boolean {
    const digitos = (valor || '').replace(/\D/g, '');
    return digitos.length === 11 || digitos.length === 14;
  }

  /** Cria ou atualiza o cliente a partir do cadastro feito no WhatsApp. */
  async cadastrar(dados: { nome: string; cpfCnpj: string; telefone: string }): Promise<Cliente> {
    const cpfCnpj = dados.cpfCnpj.replace(/\D/g, '');
    const rows = await this.pg.query<ClienteRow>(
      `INSERT INTO clientes (id, nome, cpf_cnpj, telefone_whatsapp, origem, ativo)
       VALUES ($1,$2,$3,$4,'WHATSAPP',TRUE)
       ON CONFLICT (telefone_whatsapp)
       DO UPDATE SET nome = EXCLUDED.nome, cpf_cnpj = EXCLUDED.cpf_cnpj, updated_at = now()
       RETURNING *`,
      [randomUUID(), dados.nome.trim(), cpfCnpj, dados.telefone],
    );
    this.logger.log(`Cliente cadastrado/atualizado: ${rows[0].nome} (${dados.telefone})`);
    return this.toEntity(rows[0]);
  }

  async listar(): Promise<Cliente[]> {
    const rows = await this.pg.query<ClienteRow>(`SELECT * FROM clientes ORDER BY created_at DESC`);
    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(r: ClienteRow): Cliente {
    return {
      id: r.id,
      nome: r.nome,
      cpfCnpj: r.cpf_cnpj,
      telefoneWhatsapp: r.telefone_whatsapp,
      origem: r.origem,
      ativo: r.ativo,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
