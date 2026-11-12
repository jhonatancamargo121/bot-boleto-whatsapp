import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CampanhasService } from '../campanhas/campanhas.service';
import { TemplatesService } from '../templates/templates.service';
import { ContatosService } from '../contatos/contatos.service';
import { esc, dataBr, layout, exigirAuth } from './view';

@Controller('painel/campanhas')
export class CampanhasPainelController {
  constructor(
    private readonly auth: AuthService,
    private readonly campanhas: CampanhasService,
    private readonly templates: TemplatesService,
    private readonly contatos: ContatosService,
  ) {}

  @Get()
  async lista(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    const itens: any[] = await this.campanhas.listar();
    const tpls = await this.templates.listar();
    const totalContatos = (await this.contatos.todosTelefones()).length;
    const linhas = itens
      .map(
        (c) => `<tr>
          <td>${esc(c.nome)}</td><td class="muted">${esc(c.template_nome || '-')}</td>
          <td><span class="pill">${esc(c.status)}</span></td>
          <td>${c.enviados}/${c.total}${c.falhas ? ' (' + c.falhas + ' falhas)' : ''}</td>
          <td class="muted">${esc(dataBr(c.executed_at || c.created_at))}</td>
          <td>${c.status === 'RASCUNHO'
            ? `<form method="post" action="/painel/campanhas/executar" onsubmit="return confirm('Disparar para ${totalContatos} contatos?')">
                 <input type="hidden" name="id" value="${esc(c.id)}"><button>Disparar</button></form>`
            : '<span class="muted">-</span>'}</td>
        </tr>`,
      )
      .join('');
    const opts = tpls.map((t) => `<option value="${t.id}">${esc(t.nome)} (${t.tipo})</option>`).join('');
    const corpo = `<h2>Campanhas</h2>
      <div class="card"><h3>Nova campanha</h3>
        ${tpls.length === 0 ? '<p class="err">Cadastre um template antes.</p>' : ''}
        <form method="post" action="/painel/campanhas/criar" class="inline">
          <div><label>Nome</label><input name="nome" placeholder="Cobranca junho"></div>
          <div><label>Template</label><select name="templateId">${opts}</select></div>
          <button ${tpls.length === 0 ? 'disabled' : ''}>Criar (rascunho)</button>
        </form>
        <p class="muted">A campanha dispara para <b>todos os contatos</b> cadastrados (${totalContatos}).</p>
      </div>
      <div class="card"><table>
        <thead><tr><th>Nome</th><th>Template</th><th>Status</th><th>Progresso</th><th>Quando</th><th></th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6" class="muted">Nenhuma campanha.</td></tr>'}</tbody></table>
        <p class="muted">Atualize a pagina para acompanhar o progresso do disparo.</p></div>`;
    res.type('html').send(layout('Campanhas', corpo, { ativo: '/painel/campanhas', refresh: itens.some((c) => c.status === 'ENVIANDO') ? 5 : undefined }));
  }

  @Post('criar')
  async criar(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.nome && body?.templateId) await this.campanhas.criar(body.nome, body.templateId);
    res.redirect(303, '/painel/campanhas');
  }

  @Post('executar')
  async executar(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.id) await this.campanhas.executar(body.id).catch(() => undefined);
    res.redirect(303, '/painel/campanhas');
  }
}
