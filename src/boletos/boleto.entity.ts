export type StatusBoleto = 'ABERTO' | 'VENCIDO' | 'PAGO' | 'CANCELADO' | 'ENVIADO';

/**
 * Boleto operacional. No MVP os boletos sao SIMULADOS (gerados em memoria),
 * pois ainda nao ha acesso ao banco/sistema financeiro oficial.
 * Campos seguem a doc de engenharia (tabela "boletos").
 */
export interface Boleto {
  id: string;
  codigoExterno: string; // ex: CT001-04
  clienteId: string;
  numeroContrato: string;
  numeroParcela: string;
  dataVencimento: string; // ISO yyyy-mm-dd
  valor: number;
  linhaDigitavel: string;
  status: StatusBoleto;
}
