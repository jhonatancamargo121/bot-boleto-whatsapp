import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { EvolutionService } from '../evolution/evolution.service';
import { esc, dataBr, layout, exigirAuth } from './view';

/**
 * Painel: login + monitoramento de conversas em tempo real, resposta manual
 * (atendente) e alternancia entre modo BOT e HUMANO.
 */
@Controller('painel')
export class PainelController {
  constructor(
    private readonly auth: AuthService,
    private readonly mensagens: MensagensService,
    private readonly atendimento: AtendimentoService,
    private readonly evolution: EvolutionService,
  ) {}

  // ===== Auth =====
  @Get('login')
  loginForm(@Res() res: Response, @Query('erro') erro?: string) {
    const corpo = `<div style="max-width:320px;margin:50px auto">
      <h2 style="text-align:center">Painel de Atendimento</h2>
      <form method="post" action="/painel/login" class="card">
        ${erro ? '<div class="err">Usuario ou senha invalidos</div>' : ''}
        <p><label>Usuario</label><input name="usuario" style="width:100%"></p>
        <p><label>Senha</label><input name="senha" type="password" style="width:100%"></p>
        <button type="submit" style="width:100%">Entrar</button>
      </form></div>`;
    res.type('html').send(layout('Entrar', corpo, { limpo: true }));
  }

  @Post('login')
  login(@Body() body: any, @Res() res: Response) {
    if (this.auth.validarCredenciais(body?.usuario || '', body?.senha || '')) {
      res.setHeader('Set-Cookie', this.auth.cookieHeader(this.auth.emitirToken()));
      return res.redirect(303, '/painel');
    }
    return res.redirect(303, '/painel/login?erro=1');
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.setHeader('Set-Cookie', this.auth.cookieLimpar());
    res.redirect(303, '/painel/login');
  }

  // ===== Lista de conversas =====
  @Get()
  async home(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    const conversas = await this.mensagens.listarConversas();
    const emHumano = await this.atendimento.telefonesEmHumano();
    const linhas = conversas
      .map((c) => {
        const hum = emHumano.has(c.telefone);
        return `<tr class="click" onclick="location.href='/painel/conversa?telefone=${encodeURIComponent(c.telefone)}'">
          <td>${esc(c.nome || '(nao cadastrado)')}</td>
          <td>${esc(c.telefone)}</td>
          <td>${hum ? '<span class="pill hum">humano</span>' : '<span class="pill bot">bot</span>'}</td>
          <td>${c.total}</td>
          <td class="muted">${esc((c.ultima_msg || '').slice(0, 50))}</td>
          <td class="muted">${esc(dataBr(c.ultima_data))}</td>
        </tr>`;
      })
      .join('');
    const corpo = `<h2>Conversas (${conversas.length})</h2>
      <table><thead><tr><th>Cliente</th><th>Telefone</th><th>Modo</th><th>Msgs</th><th>Ultima</th><th>Quando</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6" class="muted">Nenhuma conversa ainda.</td></tr>'}</tbody></table>`;
    res.type('html').send(layout('Conversas', corpo, { refresh: 15, ativo: '/painel' }));
  }

  // ===== Conversa (viewer em tempo real) =====
  @Get('conversa')
  async conversa(@Req() req: Request, @Res() res: Response, @Query('telefone') telefone: string) {
    if (!exigirAuth(this.auth, req, res)) return;
    const tel = telefone || '';
    const modo = await this.atendimento.obterModo(tel);
    const humano = modo === 'HUMANO';
    const corpo = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <h2 style="margin:0">${esc(tel)}
          <span class="pill ${humano ? 'hum' : 'bot'}">${humano ? 'atendimento humano' : 'bot ativo'}</span></h2>
        <div>
          <form method="post" action="/painel/conversa/modo" style="display:inline">
            <input type="hidden" name="telefone" value="${esc(tel)}">
            <input type="hidden" name="modo" value="${humano ? 'BOT' : 'HUMANO'}">
            <button class="${humano ? '' : 'sec'}" type="submit">${humano ? 'Reativar bot' : 'Assumir (pausar bot)'}</button>
          </form>
          <a href="/painel" class="muted" style="margin-left:8px">voltar</a>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="chat" id="chat"></div>
        <form id="resp" style="display:flex;gap:8px;margin-top:10px">
          <input id="texto" placeholder="${humano ? 'Responder como atendente...' : 'Bot ativo - assuma para responder manualmente'}" style="flex:1" ${humano ? '' : 'disabled'}>
          <button type="submit" ${humano ? '' : 'disabled'}>Enviar</button>
        </form>
        ${humano ? '' : '<p class="muted" style="margin:8px 0 0">O bot esta respondendo automaticamente. Clique em "Assumir" para responder manualmente.</p>'}
      </div>
      <script>
       const tel=${JSON.stringify(tel)}; let last=0; const chat=document.getElementById('chat');
       function bolha(m){const d=document.createElement('div');d.className='msg '+(m.direcao==='RECEBIDA'?'in':'out');
         const tag=m.tipo!=='texto'?('<span class="tag">'+m.tipo+'</span>'):'';
         d.innerHTML=tag+'<div></div><time>'+new Date(m.created_at).toLocaleString('pt-BR')+'</time>';
         d.querySelector('div').textContent=m.conteudo;chat.appendChild(d);}
       async function poll(){try{const r=await fetch('/painel/conversa/mensagens?telefone='+encodeURIComponent(tel)+'&after='+last,{cache:'no-store'});
         const j=await r.json();for(const m of j){bolha(m);last=m.seq;}if(j.length)chat.scrollTop=chat.scrollHeight;}catch(e){}
         setTimeout(poll,2500);}
       poll();
       const f=document.getElementById('resp');
       if(f) f.onsubmit=async e=>{e.preventDefault();const t=document.getElementById('texto');const v=t.value.trim();if(!v)return;t.value='';
         await fetch('/painel/conversa/responder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:tel,texto:v})});
         poll();};
      </script>`;
    res.type('html').send(layout('Conversa', corpo, { ativo: '/painel' }));
  }

  /** JSON incremental para o viewer em tempo real. */
  @Get('conversa/mensagens')
  async mensagensApos(@Req() req: Request, @Res() res: Response, @Query('telefone') telefone: string, @Query('after') after?: string) {
    if (!this.auth.tokenValido(this.auth.lerCookie(req.headers.cookie))) {
      return res.status(401).json([]);
    }
    const msgs = await this.mensagens.mensagensApos(telefone || '', parseInt(after || '0', 10) || 0);
    res.json(msgs);
  }

  /** Atendente responde manualmente (envia via Evolution + registra). */
  @Post('conversa/responder')
  async responder(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!this.auth.tokenValido(this.auth.lerCookie(req.headers.cookie))) {
      return res.status(401).json({ ok: false });
    }
    const telefone = body?.telefone;
    const texto = (body?.texto || '').trim();
    if (!telefone || !texto) return res.json({ ok: false });
    try {
      await this.evolution.enviarTexto(telefone, texto);
    } catch {
      /* registra mesmo se o envio falhar (ex.: numero nao conectado) */
    }
    await this.mensagens
      .registrar({ telefone, direcao: 'ENVIADA', tipo: 'atendente', conteudo: texto })
      .catch(() => undefined);
    res.json({ ok: true });
  }

  // ===== Conexao do WhatsApp (QR ao vivo, dentro do painel) =====
  @Get('conexao')
  async conexao(@Req() req: Request, @Res() res: Response) {
    if (!exigirAuth(this.auth, req, res)) return;
    const corpo = `<h2>Conexao do WhatsApp</h2>
      <div class="card" style="text-align:center;max-width:420px;margin:0 auto">
        <p class="muted">No celular do bot: WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho</p>
        <div id="qr" style="width:280px;height:280px;background:#fff;border-radius:10px;margin:14px auto;display:flex;align-items:center;justify-content:center">carregando...</div>
        <p id="st" class="muted">Verificando status...</p>
      </div>
      <script>
       const qr=document.getElementById('qr'),st=document.getElementById('st');
       async function tick(){
        try{const r=await fetch('/painel/conexao/qr',{cache:'no-store'});const j=await r.json();
         if(j.state==='open'){qr.innerHTML='<div style="color:#00a884;font-weight:700;font-size:18px">Conectado!</div>';st.textContent='WhatsApp conectado com sucesso.';return;}
         if(j.base64){const s=j.base64.startsWith('data:')?j.base64:('data:image/png;base64,'+j.base64);
           qr.innerHTML='<img alt="QR" style="width:260px;height:260px" src="'+s+'">';st.textContent='Escaneie o QR (atualiza sozinho).';}
         else if(j.pairingCode){qr.innerHTML='<div style="color:#111;font-size:22px;font-weight:700">'+j.pairingCode+'</div>';st.textContent='Digite este codigo no WhatsApp.';}
         else{st.textContent='Estado: '+(j.state||'?')+(j.erro?(' - '+j.erro):'');}
        }catch(e){st.textContent='Erro: '+e.message;}
        setTimeout(tick,15000);
       } tick();
      </script>`;
    res.type('html').send(layout('Conexao', corpo, { ativo: '/painel/conexao' }));
  }

  /** JSON com o QR/estado da instancia (autenticado). */
  @Get('conexao/qr')
  async conexaoQr(@Req() req: Request, @Res() res: Response) {
    if (!this.auth.tokenValido(this.auth.lerCookie(req.headers.cookie))) {
      return res.status(401).json({ state: 'unauth' });
    }
    try {
      const estado = await this.evolution.estadoConexao();
      const state = estado?.instance?.state || estado?.state || 'unknown';
      if (state === 'open') return res.json({ state: 'open' });
      const conn = await this.evolution.conectar();
      return res.json({ state, base64: conn?.base64 || null, code: conn?.code || null, pairingCode: conn?.pairingCode || null });
    } catch (e) {
      return res.json({ state: 'erro', erro: (e as Error).message });
    }
  }

  /** Alterna o modo da conversa (BOT <-> HUMANO). */
  @Post('conversa/modo')
  async modo(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    if (!exigirAuth(this.auth, req, res)) return;
    const telefone = body?.telefone;
    const modo = body?.modo === 'HUMANO' ? 'HUMANO' : 'BOT';
    if (telefone) await this.atendimento.definirModo(telefone, modo);
    res.redirect(303, `/painel/conversa?telefone=${encodeURIComponent(telefone || '')}`);
  }
}
