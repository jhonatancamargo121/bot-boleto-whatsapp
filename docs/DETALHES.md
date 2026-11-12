# Boleto WhatsApp Bot (MVP de simulação)

Chatbot de **cobrança e segunda via de boleto via WhatsApp**, usando a **Evolution API**,
com **IA (DeepSeek)** restrita ao tema e **painel de monitoramento** com **PostgreSQL**.
Ainda **sem integração com o sistema financeiro** (boletos são simulados). O bot:

- Reage quando o cliente manda mensagem no WhatsApp;
- **Cadastra o cliente** (nome + CPF/CNPJ) no **PostgreSQL**;
- Oferece um **menu** (botões interativos ou opções numeradas);
- Emite uma **segunda via simulada** (texto com linha digitável + PDF gerado na hora);
- Para texto livre, usa **DeepSeek** para responder **somente sobre segunda via/boleto**
  (recusa educadamente qualquer outro assunto e nunca inventa dados de boleto);
- Persiste **todas as mensagens** (entrada/saída) para um **painel** monitorar as conversas.

> Os boletos são fictícios e o sistema financeiro não está integrado. Nenhum pagamento é
> válido. É um protótipo de fluxo — clientes e histórico de mensagens, porém, são reais (Postgres).

## Painel de monitoramento

- **https://agente01.natela.exemplo.com/painel** — login (`PAINEL_USUARIO` / `PAINEL_SENHA` do `.env`).
- Lista as conversas (cliente, telefone, nº de mensagens, última mensagem) e abre a transcrição
  completa de cada uma (atualiza a cada 15s).

Baseado na documentação de engenharia (`documentacao_engenharia_chatbot_boletos_whatsapp`) e na
ideia do cliente (`sistema de boletos`).

---

## Por que Evolution API (e não "Evo Go")

A VPS já roda **Evolution API v2.3.7** (`evoapicloud/evolution-api`), madura, com webhook, envio de
mídia/PDF, listas e botões — padrão de mercado no Brasil. O "Evo Go" é mais novo, com menos recursos
e documentação. Para um bot que vai virar cobrança em produção, ficamos na **Evolution API**.

## Stack

- **NestJS + TypeScript** (alinhado à doc de engenharia)
- **PostgreSQL** (`pg`) — clientes + histórico de mensagens
- **DeepSeek** (IA, restrita a segunda via/boleto)
- **axios** (Evolution + DeepSeek) · **pdfkit** (PDF da segunda via)

## Estrutura

```
src/
├── main.ts / app.module.ts
├── config/            # leitura do .env
├── database/          # conexão Postgres (pool) + criação de tabelas
├── evolution/         # cliente da Evolution API (texto, menu, documento)
├── clientes/          # cadastro de clientes (Postgres)
├── boletos/           # boletos SIMULADOS + geração de PDF
├── conversas/         # máquina de estados da conversa (em memória)
├── mensagens/         # persistência + consultas do histórico (painel)
├── ia/                # DeepSeek (escopo travado em segunda via/boleto)
├── bot/               # orquestração do fluxo (cadastro, menu, segunda via, IA)
├── painel/            # painel web de monitoramento (login + conversas)
└── webhook/           # webhook da Evolution + QR + simulador local
```

---

## Como rodar (local, modo simulador — sem WhatsApp)

```bash
npm install
cp .env.example .env      # defina DATABASE_URL (Postgres) e, p/ IA, DEEPSEEK_API_KEY
npm run start:dev
```

> Requer um PostgreSQL acessível pela `DATABASE_URL`. Em produção isso é o container
> `agente01-postgres` (sobe junto via `docker compose up -d`). O simulador também grava no banco.

- Abra **http://localhost:3000/simular** → mini-chat no navegador para testar o fluxo completo.
- Ou via API:
  ```bash
  curl -X POST http://localhost:3000/simular/mensagem \
    -H "Content-Type: application/json" \
    -d '{"telefone":"5561999990000","texto":"oi"}'
  ```
- Ver clientes cadastrados em memória: **GET http://localhost:3000/simular/clientes**

### Roteiro de teste
1. `oi` → bot pede o nome
2. `João Silva` → bot pede CPF/CNPJ
3. `12345678901` → cadastro feito + menu
4. `1` → segunda via (se houver mais de um boleto, ele lista e pede o número)

---

## Como conectar no WhatsApp real (Evolution API)

> ⚠️ **Não reutilize a instância `assistente`** da Evolution: ela é do projeto *assistente-pessoal*
> e já tem um webhook ativo. Apontar o webhook dela para este bot quebraria o outro projeto.
> Crie uma **instância dedicada** (ex.: `boletos`) no mesmo servidor Evolution.

1. **Criar a instância** (uma vez):
   ```bash
   curl -X POST "$EVOLUTION_API_URL/instance/create" \
     -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
     -d '{"instanceName":"boletos","integration":"WHATSAPP-BAILEYS","qrcode":true}'
   ```
   Leia o QR Code retornado (ou no Manager da Evolution) com o WhatsApp do bot.

2. **Configurar o `.env`** (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE=boletos`,
   `WEBHOOK_TOKEN`).

3. **Apontar o webhook da instância** para este bot (a URL precisa ser acessível pela Evolution):
   ```bash
   curl -X POST "$EVOLUTION_API_URL/webhook/set/boletos" \
     -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
     -d '{"webhook":{"enabled":true,"url":"https://SEU_BOT/webhook/whatsapp?token=SEU_WEBHOOK_TOKEN","events":["MESSAGES_UPSERT"]}}'
   ```
   Se o bot rodar como container na **mesma rede docker** da Evolution, a URL pode ser
   `http://boleto-bot:3000/webhook/whatsapp?token=...`.

4. Mande uma mensagem para o número do bot e acompanhe os logs.

### Botões vs opções numeradas
O WhatsApp/Baileys frequentemente **não renderiza botões** interativos. Por isso o padrão é
`USE_BUTTONS=false` (opções numeradas em texto, 100% confiável). Se seu número renderizar botões,
ligue `USE_BUTTONS=true` — em falha, o bot cai automaticamente no texto numerado.

---

## Variáveis de ambiente

Veja `.env.example`. Principais: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`,
`WEBHOOK_TOKEN`, `DATABASE_URL`, `PGPASSWORD`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`,
`PAINEL_USUARIO`, `PAINEL_SENHA`, `PAINEL_SECRET`, `USE_BUTTONS`, `SEND_PDF`, `EMPRESA_NOME`.

## Próximas fases (fora deste MVP)

- Boletos **reais**: `POST /integracoes/boletos/sincronizar` para receber do sistema financeiro
  (hoje os boletos são simulados; clientes e mensagens já são persistidos).
- Campanhas de cobrança (D-3, D0, D+3...) com **Redis/BullMQ**.
- Integrador local para sistema **DOS** (CSV/DBF) — ver doc, seções 10–11.
