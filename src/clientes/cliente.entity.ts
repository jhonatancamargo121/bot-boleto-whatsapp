/**
 * Cliente operacional do bot. No MVP de simulacao fica em memoria.
 * Os campos seguem a doc de engenharia (tabela "clientes").
 */
export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefoneWhatsapp: string;
  origem: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}
