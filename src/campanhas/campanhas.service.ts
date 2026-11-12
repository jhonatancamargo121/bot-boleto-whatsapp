import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PgService } from '../database/pg.service';
import { TemplatesService } from '../templates/templates.service';
import { ContatosService } from '../contatos/contatos.service';
import { EvolutionService } from '../evolution/evolution.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { env } from '../config/env.config';

export interface Campanha {
  id: string;
  nome: string;
  template_id: string;
  status: string;
  total: number;
  enviados: number;
  falhas: number;
  created_at: string;
  executed_at: string | null;
}

@Injectable()
export class CampanhasService {
  private readonly logger = new Logger(CampanhasService.name);

  constructor(
    private readonly pg: PgService,
    private readonly templates: TemplatesService,
    private readonly contatos: ContatosService,
    private readonly evolution: EvolutionService,
    private readonly mensagens: MensagensService,
  ) {}

  listar(): Promise<Campanha[]> {
    return this.pg.query<Campanha>(
      `SELECT c.*, t.nome AS template_nome
       FROM campanhas c LEFT JOIN templates t ON t.id = c.template_id
       ORDER BY c.created_at DESC`,
    );
  }

  async criar(nome: string, templateId: string): Promise<string> {
    const id = randomUUID();
    await this.pg.query(
      `INSERT INTO campanhas (id, nome, template_id, status) VALUES ($1,$2,$3,'RASCUNHO')`,
      [id, nome.trim(), templateId],
    );
    return id;
  }

  /**
   * Executa a campanha: renderiza o template para cada contato e envia pelo
   * WhatsApp (Evolution), registrando no historico de mensagens. Atualiza o
   * progresso na propria campanha. Roda em background (nao bloqueia o painel).
   */
  async executar(campanhaId: string): Promise<{ total: number }> {
    const rows = await this.pg.query<Campanha>(`SELECT * FROM campanhas WHERE id = $1`, [campanhaId]);
    const campanha = rows[0];
    if (!campanha) throw new Error('Campanha nao encontrada');

    const template = await this.templates.obter(campanha.template_id);
    if (!template) throw new Error('Template da campanha nao encontrado');

    const destinatarios = await this.contatos.todosTelefones();
    await this.pg.query(
      `UPDATE campanhas SET status='ENVIANDO', total=$2, enviados=0, falhas=0, executed_at=now() WHERE id=$1`,
      [campanhaId, destinatarios.length],
    );

    // Dispara em background (sequencial, com pequeno intervalo anti-flood).
    void this.disparar(campanhaId, template.conteudo, destinatarios);
    return { total: destinatarios.length };
  }

  private async disparar(
    campanhaId: string,
    conteudo: string,
    destinatarios: { telefone: string; nome: string | null }[],
  ): Promise<void> {
    let enviados = 0;
    let falhas = 0;
    for (const d of destinatarios) {
      const texto = this.templates.renderizar(conteudo, {
        nome: d.nome || 'cliente',
        telefone: d.telefone,
        empresa: env.bot.empresaNome,
      });
      try {
        await this.evolution.enviarTexto(d.telefone, texto);
        await this.mensagens
          .registrar({ telefone: d.telefone, direcao: 'ENVIADA', tipo: 'campanha', conteudo: texto })
          .catch(() => undefined);
        enviados++;
      } catch (e) {
        falhas++;
        this.logger.warn(`Falha ao enviar campanha para ${d.telefone}: ${(e as Error).message}`);
      }
      await this.pg
        .query(`UPDATE campanhas SET enviados=$2, falhas=$3 WHERE id=$1`, [campanhaId, enviados, falhas])
        .catch(() => undefined);
      await new Promise((r) => setTimeout(r, 800)); // intervalo anti-flood
    }
    await this.pg
      .query(`UPDATE campanhas SET status='CONCLUIDA' WHERE id=$1`, [campanhaId])
      .catch(() => undefined);
    this.logger.log(`Campanha ${campanhaId} concluida: ${enviados} enviados, ${falhas} falhas`);
  }
}
