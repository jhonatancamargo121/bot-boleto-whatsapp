import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TemplatesService, TIPOS_TEMPLATE } from '../templates/templates.service';
import { esc, dataBr, layout, exigirAuth } from './view';

@Controller('painel/templates')
export class TemplatesPainelController {
  constructor(
    private readonly auth: AuthService,
    private readonly templates: TemplatesService,
  ) {}

  @Get()
  async lista(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    const itens = await this.templates.listar();
    const linhas = itens
      .map(
        (t) => `<tr>
          <td>${esc(t.nome)}</td><td class="muted">${esc(t.tipo)}</td>
          <td class="muted" style="max-width:380px">${esc(t.conteudo.slice(0, 120))}</td>
          <td class="muted">${esc(dataBr(t.created_at))}</td>
          <td><form method="post" action="/painel/templates/excluir" onsubmit="return confirm('Excluir template?')">
            <input type="hidden" name="id" value="${esc(t.id)}"><button class="danger">x</button></form></td>
        </tr>`,
      )
      .join('');
    const opts = TIPOS_TEMPLATE.map((t) => `<option value="${t}">${t}</option>`).join('');
    const corpo = `<h2>Templates de cobranca (${itens.length})</h2>
      <div class="card"><h3>Novo template</h3>
        <form method="post" action="/painel/templates/criar">
          <div class="row">
            <p style="flex:1"><label>Nome</label><input name="nome" style="width:100%"></p>
            <p style="flex:1"><label>Tipo</label><select name="tipo" style="width:100%">${opts}</select></p>
          </div>
          <label>Conteudo (variaveis: {{nome}}, {{telefone}}, {{empresa}})</label>
          <textarea name="conteudo" placeholder="Ola {{nome}}, identificamos uma parcela em aberto..."></textarea>
          <button style="margin-top:8px">Salvar template</button>
        </form>
      </div>
      <div class="card"><table>
        <thead><tr><th>Nome</th><th>Tipo</th><th>Conteudo</th><th>Criado</th><th></th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="5" class="muted">Nenhum template.</td></tr>'}</tbody></table></div>`;
    res.type('html').send(layout('Templates', corpo, { ativo: '/painel/templates' }));
  }

  @Post('criar')
  async criar(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.nome && body?.conteudo) {
      await this.templates.criar(body.nome, body.tipo || 'COBRANCA_VENCIDA', body.conteudo);
    }
    res.redirect(303, '/painel/templates');
  }

  @Post('excluir')
  async excluir(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.id) await this.templates.excluir(body.id);
    res.redirect(303, '/painel/templates');
  }
}
