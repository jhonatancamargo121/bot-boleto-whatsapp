/**
 * Leitura centralizada das variaveis de ambiente.
 * Mantem tipagem e defaults em um unico lugar.
 */
export const env = {
  port: parseInt(process.env.APP_PORT || '3000', 10),

  evolution: {
    apiUrl: (process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/$/, ''),
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || 'boletos',
  },

  webhookToken: process.env.WEBHOOK_TOKEN || '',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  // IA (DeepSeek) - usada apenas para duvidas tecnicas de segunda via/boleto.
  ia: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiUrl: (process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    enabled: !!process.env.DEEPSEEK_API_KEY,
  },

  painel: {
    usuario: process.env.PAINEL_USUARIO || 'admin',
    senha: process.env.PAINEL_SENHA || 'admin',
    secret: process.env.PAINEL_SECRET || 'troque-este-secret',
    cookieSecure: (process.env.COOKIE_SECURE || 'true').toLowerCase() === 'true',
  },

  bot: {
    useButtons: (process.env.USE_BUTTONS || 'false').toLowerCase() === 'true',
    sendPdf: (process.env.SEND_PDF || 'true').toLowerCase() === 'true',
    empresaNome: process.env.EMPRESA_NOME || 'Sua Empresa',
  },
};

export type AppEnv = typeof env;
