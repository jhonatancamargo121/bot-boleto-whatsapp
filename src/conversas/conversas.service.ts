import { Injectable } from '@nestjs/common';
import { Conversa, EstadoConversa } from './conversa.types';

/**
 * Estado das conversas EM MEMORIA, por telefone.
 * Controla em que ponto do fluxo cada cliente esta.
 */
@Injectable()
export class ConversasService {
  private readonly conversas = new Map<string, Conversa>();

  obter(telefone: string): Conversa {
    let c = this.conversas.get(telefone);
    if (!c) {
      c = { telefone, estado: EstadoConversa.INICIO, updatedAt: new Date() };
      this.conversas.set(telefone, c);
    }
    return c;
  }

  atualizar(telefone: string, patch: Partial<Conversa>): Conversa {
    const c = this.obter(telefone);
    Object.assign(c, patch, { updatedAt: new Date() });
    this.conversas.set(telefone, c);
    return c;
  }

  resetar(telefone: string): void {
    this.conversas.set(telefone, {
      telefone,
      estado: EstadoConversa.INICIO,
      updatedAt: new Date(),
    });
  }
}
