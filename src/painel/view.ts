import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { env } from '../config/env.config';

export function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function dataBr(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Confere o cookie; se invalido, redireciona para o login e retorna false. */
export function exigirAuth(auth: AuthService, req: Request, res: Response): boolean {
  if (auth.tokenValido(auth.lerCookie(req.headers.cookie))) return true;
  res.redirect('/painel/login');
  return false;
}

const NAV = [
  ['/painel', 'Conversas'],
  ['/painel/contatos', 'Contatos'],
  ['/painel/templates', 'Templates'],
  ['/painel/campanhas', 'Campanhas'],
  ['/painel/atendentes', 'Atendentes'],
  ['/painel/conexao', 'Conexao'],
];

export function layout(
  titulo: string,
  corpo: string,
  opts: { refresh?: number; ativo?: string; limpo?: boolean } = {},
): string {
  const nav = NAV.map(
    ([href, label]) =>
      `<a class="${opts.ativo === href ? 'on' : ''}" href="${href}">${label}</a>`,
  ).join('');
  // Cabecalho completo (area logada) ou nenhum (tela de login limpa).
  const header = opts.limpo
    ? ''
    : `<header><b>${esc(env.bot.empresaNome)}</b><nav>${nav}</nav><span class="sp"></span>
<a href="/painel/logout">sair</a></header>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${opts.refresh ? `<meta http-equiv="refresh" content="${opts.refresh}">` : ''}
<title>${esc(titulo)} - Painel ${esc(env.bot.empresaNome)}</title>
<style>
 :root{--bg:#0b141a;--card:#111b21;--line:#1f2c33;--accent:#00a884;--muted:#8696a0}
 *{box-sizing:border-box} body{font-family:system-ui,Arial,sans-serif;background:var(--bg);color:#e9edef;margin:0}
 header{background:#202c33;padding:10px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
 header b{color:var(--accent)} header nav{display:flex;gap:4px;flex-wrap:wrap}
 header nav a{color:#cdd;text-decoration:none;padding:6px 10px;border-radius:8px;font-size:14px}
 header nav a.on,header nav a:hover{background:#0b3;background:#15212a;color:#fff}
 header .sp{flex:1}
 .wrap{max-width:1000px;margin:0 auto;padding:18px}
 h2{margin:6px 0 14px} a{color:var(--accent)}
 table{width:100%;border-collapse:collapse;font-size:14px}
 th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
 tbody tr.click{cursor:pointer} tbody tr.click:hover{background:#15212a}
 .muted{color:var(--muted)} .pill{padding:2px 8px;border-radius:999px;font-size:12px;background:#223}
 .pill.hum{background:#7a3; color:#012} .pill.bot{background:#234}
 form.inline{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;align-items:flex-end}
 label{display:block;font-size:12px;color:var(--muted);margin-bottom:3px}
 input,select,textarea{padding:9px;border-radius:8px;border:1px solid #2a3942;background:#0d161c;color:#e9edef;font-family:inherit}
 textarea{width:100%;min-height:90px} input,select{min-width:160px}
 button{padding:9px 14px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-weight:600;cursor:pointer}
 button.sec{background:#33454f} button.danger{background:#a33}
 .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
 .row{display:flex;gap:16px;flex-wrap:wrap} .row>*{flex:1;min-width:280px}
 .chat{display:flex;flex-direction:column;gap:8px;max-height:62vh;overflow-y:auto;padding:6px}
 .msg{max-width:75%;padding:8px 12px;border-radius:10px;font-size:14px;white-space:pre-wrap;line-height:1.35}
 .msg time{display:block;font-size:11px;color:var(--muted);margin-top:4px}
 .in{background:#202c33;align-self:flex-start} .out{background:#005c4b;align-self:flex-end}
 .tag{display:inline-block;font-size:10px;background:#0a3;padding:1px 6px;border-radius:6px;margin-bottom:4px}
 .err{color:#ff6b6b} .ok{color:var(--accent)}
</style></head><body>
${header}
<div class="wrap">${corpo}</div></body></html>`;
}
