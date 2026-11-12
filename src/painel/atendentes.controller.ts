import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AtendentesService } from '../atendentes/atendentes.service';
import { esc, dataBr, layout, exigirAuth } from './view';

@Controller('painel/atendentes')
export class AtendentesPainelController {
  constructor(
    private readonly auth: AuthService,
    private readonly atendentes: AtendentesService,
  ) {}

  @Get()
  async lista(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    const itens = await this.atendentes.listar();
    const linhas = itens
      .map(
        (a) => `<tr>
          <td>${esc(a.nome)}</td><td>${esc(a.telefone)}</td>
          <td>${a.ativo ? '<span class="pill bot">ativo</span>' : '<span class="muted">inativo</span>'}</td>
          <td class="muted">${esc(dataBr(a.created_at))}</td>
          <td><form method="post" action="/painel/atendentes/excluir" onsubmit="return confirm('Remover atendente?')">
            <input type="hidden" name="id" value="${esc(a.id)}"><button class="danger">x</button></form></td>
        </tr>`,
      )
      .join('');
    const corpo = `<h2>Atendentes (${itens.length})</h2>
      <div class="card"><h3>Cadastrar atendente</h3>
        <form method="post" action="/painel/atendentes/criar" class="inline">
          <div><label>Nome</label><input name="nome"></div>
          <div><label>WhatsApp (DDI+DDD+numero)</label><input name="telefone" placeholder="5561999999999"></div>
          <button>Cadastrar</button>
        </form>
        <p class="muted">Quando um cliente pedir atendimento humano, o bot pausa e notifica o
        primeiro atendente ativo (plantao) no WhatsApp dele.</p>
      </div>
      <div class="card"><table>
        <thead><tr><th>Nome</th><th>WhatsApp</th><th>Status</th><th>Criado</th><th></th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="5" class="muted">Nenhum atendente.</td></tr>'}</tbody></table></div>`;
    res.type('html').send(layout('Atendentes', corpo, { ativo: '/painel/atendentes' }));
  }

  @Post('criar')
  async criar(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.nome && body?.telefone) await this.atendentes.criar(body.nome, body.telefone);
    res.redirect(303, '/painel/atendentes');
  }

  @Post('excluir')
  async excluir(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.id) await this.atendentes.excluir(body.id);
    res.redirect(303, '/painel/atendentes');
  }
}
