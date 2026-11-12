import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import { Boleto } from './boleto.entity';
import { Cliente } from '../clientes/cliente.entity';
import { env } from '../config/env.config';

/**
 * Servico de boletos SIMULADOS.
 *
 * Como ainda nao ha integracao com o sistema financeiro/banco, este servico
 * gera boletos ficticios de forma deterministica por cliente (mesma pessoa =
 * mesmos boletos), apenas para exercitar o fluxo de segunda via no WhatsApp.
 *
 * Para produzir a versao real: trocar `gerarBoletosDoCliente` por uma consulta
 * ao Postgres/integracao, mantendo a mesma estrutura de retorno.
 */
@Injectable()
export class BoletosService {
  private readonly cache = new Map<string, Boleto[]>();

  /** Retorna (gerando na 1a vez) os boletos em aberto/vencidos do cliente. */
  obterBoletosEmAberto(cliente: Cliente): Boleto[] {
    if (this.cache.has(cliente.id)) {
      return this.cache.get(cliente.id)!.filter((b) => b.status !== 'PAGO');
    }
    const boletos = this.gerarBoletosDoCliente(cliente);
    this.cache.set(cliente.id, boletos);
    return boletos.filter((b) => b.status !== 'PAGO');
  }

  /** Marca um boleto como pago (simulacao do "ja paguei"). */
  marcarPago(clienteId: string, boletoId: string): void {
    const lista = this.cache.get(clienteId);
    const b = lista?.find((x) => x.id === boletoId);
    if (b) b.status = 'PAGO';
  }

  private gerarBoletosDoCliente(cliente: Cliente): Boleto[] {
    // Numero de parcelas (1 a 3) derivado do CPF/CNPJ -> deterministico.
    const semente = this.somaDigitos(cliente.cpfCnpj);
    const quantidade = (semente % 3) + 1;
    const contrato = `CT${String((semente % 900) + 100)}`;
    const hoje = new Date();

    const boletos: Boleto[] = [];
    for (let i = 0; i < quantidade; i++) {
      const parcela = String(i + 1).padStart(2, '0');
      // Vencimentos: primeiro vencido, demais futuros (espacados 30 dias).
      const venc = new Date(hoje);
      venc.setDate(venc.getDate() + (i === 0 ? -10 : i * 30));
      const valor = 350 + (semente % 50) + i * 25.5;
      boletos.push({
        id: randomUUID(),
        codigoExterno: `${contrato}-${parcela}`,
        clienteId: cliente.id,
        numeroContrato: contrato,
        numeroParcela: parcela,
        dataVencimento: venc.toISOString().slice(0, 10),
        valor: Math.round(valor * 100) / 100,
        linhaDigitavel: this.gerarLinhaDigitavel(semente + i),
        status: i === 0 ? 'VENCIDO' : 'ABERTO',
      });
    }
    return boletos;
  }

  /** Gera uma linha digitavel ficticia de 47 digitos no formato visual de boleto. */
  private gerarLinhaDigitavel(semente: number): string {
    let s = '';
    let x = semente * 9973 + 12345;
    for (let i = 0; i < 47; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      s += String(x % 10);
    }
    return `${s.slice(0, 5)}.${s.slice(5, 10)} ${s.slice(10, 15)}.${s.slice(15, 21)} ${s.slice(21, 26)}.${s.slice(26, 32)} ${s.slice(32, 33)} ${s.slice(33, 47)}`;
  }

  private somaDigitos(cpfCnpj: string): number {
    return (cpfCnpj.replace(/\D/g, '') || '0')
      .split('')
      .reduce((acc, d) => acc + (parseInt(d, 10) || 0), 0);
  }

  formatarValor(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  /** Gera um PDF (simulado) da segunda via e devolve em base64. */
  async gerarPdfBase64(cliente: Cliente, boleto: Boleto): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));

        doc.fontSize(18).text(env.bot.empresaNome, { align: 'left' });
        doc.fontSize(10).fillColor('gray').text('Segunda via de boleto (DOCUMENTO SIMULADO - SEM VALIDADE BANCARIA)');
        doc.moveDown();
        doc.fillColor('black').fontSize(12);
        doc.text(`Cliente: ${cliente.nome}`);
        doc.text(`CPF/CNPJ: ${cliente.cpfCnpj}`);
        doc.text(`Contrato: ${boleto.numeroContrato}   Parcela: ${boleto.numeroParcela}`);
        doc.text(`Vencimento: ${this.formatarData(boleto.dataVencimento)}`);
        doc.text(`Valor: ${this.formatarValor(boleto.valor)}`);
        doc.text(`Status: ${boleto.status}`);
        doc.moveDown();
        doc.fontSize(11).text('Linha digitavel:');
        doc.font('Courier').fontSize(11).text(boleto.linhaDigitavel);
        doc.moveDown(2);
        doc.font('Helvetica').fontSize(9).fillColor('gray')
          .text('Este e um boleto de demonstracao gerado pelo chatbot em fase de simulacao. Nao efetue pagamento.');

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
