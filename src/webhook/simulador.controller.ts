import { Body, Controller, Get, Post } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import { ClientesService } from '../clientes/clientes.service';
import { MensagensService } from '../mensagens/mensagens.service';
import { CaptureResponder } from '../bot/responder';

/**
 * Simulador local: reproduz "o cliente mandou uma mensagem" sem precisar do
 * WhatsApp real. Util para validar o fluxo de cadastro e segunda via.
 *
 * Ex.: POST /simular/mensagem  { "telefone": "5561999999999", "texto": "oi" }
 * A resposta traz exatamente o que o bot enviaria de volta.
 */
@Controller('simular')
export class SimuladorController {
  constructor(
    private readonly bot: BotService,
    private readonly clientes: ClientesService,
    private readonly mensagens: MensagensService,
  ) {}

  @Post('mensagem')
  async simular(@Body() body: { telefone?: string; texto?: string; pushName?: string }) {
    const telefone = body?.telefone || '5500000000000';
    const texto = body?.texto || '';

    // Persiste tambem no banco para o painel conseguir monitorar (mesmo sem WhatsApp).
    const cli = await this.clientes.buscarPorTelefone(telefone);
    await this.mensagens
      .registrar({ telefone, clienteId: cli?.id || null, direcao: 'RECEBIDA', tipo: 'texto', conteudo: texto })
      .catch(() => undefined);

    const responder = new CaptureResponder();
    await this.bot.processarMensagem(telefone, texto, body?.pushName, responder);

    for (const m of responder.mensagens) {
      await this.mensagens
        .registrar({ telefone, clienteId: cli?.id || null, direcao: 'ENVIADA', tipo: m.tipo, conteudo: m.conteudo })
        .catch(() => undefined);
    }

    return { enviadoPeloCliente: texto, respostasDoBot: responder.mensagens };
  }

  /** Inspeciona os clientes cadastrados em memoria. */
  @Get('clientes')
  listarClientes() {
    return this.clientes.listar();
  }

  /** Mini pagina HTML para testar o bot pelo navegador. */
  @Get()
  pagina(): string {
    return PAGINA_HTML;
  }
}

const PAGINA_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Simulador - Bot de Boletos</title>
<style>
 body{font-family:system-ui,Arial,sans-serif;background:#0b141a;color:#e9edef;margin:0;display:flex;justify-content:center}
 .wrap{width:100%;max-width:480px;height:100vh;display:flex;flex-direction:column;background:#111b21}
 header{background:#202c33;padding:14px 16px;font-weight:600}
 #chat{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
 .msg{max-width:80%;padding:8px 12px;border-radius:10px;white-space:pre-wrap;line-height:1.35;font-size:14px}
 .bot{background:#202c33;align-self:flex-start;border-top-left-radius:2px}
 .me{background:#005c4b;align-self:flex-end;border-top-right-radius:2px}
 .doc{background:#182229;border:1px dashed #3b4a54;align-self:flex-start;font-size:13px;color:#8696a0}
 form{display:flex;gap:8px;padding:12px;background:#202c33}
 input{flex:1;padding:10px;border-radius:8px;border:none;background:#2a3942;color:#e9edef}
 button{padding:10px 16px;border:none;border-radius:8px;background:#00a884;color:#fff;font-weight:600;cursor:pointer}
 small{color:#8696a0;padding:0 16px 8px}
</style></head><body><div class="wrap">
<header>Simulador - Bot de Boletos</header>
<small>Numero simulado: 5561999990000 - digite "oi" para comecar</small>
<div id="chat"></div>
<form id="f"><input id="t" placeholder="Digite uma mensagem..." autocomplete="off"><button>Enviar</button></form>
</div><script>
const chat=document.getElementById('chat'),f=document.getElementById('f'),t=document.getElementById('t');
const tel='5561999990000';
function add(cls,txt){const d=document.createElement('div');d.className='msg '+cls;d.textContent=txt;chat.appendChild(d);chat.scrollTop=chat.scrollHeight;}
f.onsubmit=async e=>{e.preventDefault();const texto=t.value.trim();if(!texto)return;add('me',texto);t.value='';
 const r=await fetch('/simular/mensagem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({telefone:tel,texto})});
 const j=await r.json();
 for(const m of j.respostasDoBot){ if(m.tipo==='documento'){add('doc','PDF: '+(m.arquivo||'')+(m.conteudo?(' - '+m.conteudo):''));} else {add('bot',m.conteudo);} }
};
</script></body></html>`;
