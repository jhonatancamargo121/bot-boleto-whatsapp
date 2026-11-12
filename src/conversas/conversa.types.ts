/** Estados possiveis da conversa de um numero no WhatsApp. */
export enum EstadoConversa {
  INICIO = 'INICIO',
  AGUARDANDO_NOME = 'AGUARDANDO_NOME',
  AGUARDANDO_CPF = 'AGUARDANDO_CPF',
  MENU = 'MENU',
  AGUARDANDO_SELECAO_BOLETO = 'AGUARDANDO_SELECAO_BOLETO',
}

export interface Conversa {
  telefone: string;
  estado: EstadoConversa;
  // dados temporarios do cadastro em andamento
  rascunhoNome?: string;
  // ids dos boletos listados no ultimo menu de selecao
  boletosListados?: string[];
  updatedAt: Date;
}
