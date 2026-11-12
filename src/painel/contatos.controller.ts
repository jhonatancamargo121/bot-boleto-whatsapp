import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ContatosService } from '../contatos/contatos.service';
import { esc, dataBr, layout, exigirAuth } from './view';

@Controller('painel/contatos')
export class ContatosPainelController {
  constructor(
    private readonly auth: AuthService,
    private readonly contatos: ContatosService,
  ) {}

  @Get()
  async lista(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    const itens = await this.contatos.listar();
    const linhas = itens
      .map(
        (c) => `<tr>
          <td>${esc(c.nome || '-')}</td><td>${esc(c.telefone)}</td>
          <td>${esc(c.cpf_cnpj || '-')}</td><td class="muted">${esc(c.origem)}</td>
          <td class="muted">${esc(dataBr(c.created_at))}</td>
          <td><form method="post" action="/painel/contatos/excluir" onsubmit="return confirm('Excluir contato?')">
            <input type="hidden" name="id" value="${esc(c.id)}"><button class="danger">x</button></form></td>
        </tr>`,
      )
      .join('');
    const corpo = `<h2>Contatos (${itens.length})</h2>
      <div class="row">
        <div class="card"><h3>Adicionar manual</h3>
          <form method="post" action="/painel/contatos/criar">
            <p><label>Nome</label><input name="nome" style="width:100%"></p>
            <p><label>Telefone (DDI+DDD+numero)</label><input name="telefone" placeholder="5561999999999" style="width:100%"></p>
            <p><label>CPF/CNPJ (opcional)</label><input name="cpfCnpj" style="width:100%"></p>
            <button>Adicionar</button>
          </form>
        </div>
        <div class="card"><h3>Importar CSV</h3>
          <form method="post" action="/painel/contatos/importar">
            <p class="muted">Uma linha por contato: <code>nome;telefone;cpf_cnpj</code></p>
            <textarea name="csv" placeholder="Joao Silva;5561999999999;12345678901"></textarea>
            <button style="margin-top:8px">Importar</button>
          </form>
          <form method="post" action="/painel/contatos/sincronizar" style="margin-top:10px">
            <button class="sec">Sincronizar do WhatsApp</button>
            <span class="muted">requer numero conectado</span>
          </form>
        </div>
      </div>
      <div class="card"><table>
        <thead><tr><th>Nome</th><th>Telefone</th><th>CPF/CNPJ</th><th>Origem</th><th>Criado</th><th></th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="6" class="muted">Nenhum contato.</td></tr>'}</tbody></table></div>`;
    res.type('html').send(layout('Contatos', corpo, { ativo: '/painel/contatos' }));
  }

  @Post('criar')
  async criar(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.telefone) await this.contatos.upsert({ nome: body.nome, telefone: body.telefone, cpfCnpj: body.cpfCnpj, origem: 'MANUAL' });
    res.redirect(303, '/painel/contatos');
  }

  @Post('importar')
  async importar(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.csv) await this.contatos.importarCsv(body.csv);
    res.redirect(303, '/painel/contatos');
  }

  @Post('sincronizar')
  async sincronizar(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    await this.contatos.sincronizarWhatsapp().catch(() => undefined);
    res.redirect(303, '/painel/contatos');
  }

  @Post('excluir')
  async excluir(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    if (body?.id) await this.contatos.excluir(body.id);
    res.redirect(303, '/painel/contatos');
  }
}
