import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env.config';

/**
 * Autenticacao simples do painel: usuario/senha do .env + cookie assinado
 * (HMAC) com validade. Sem dependencias externas (sem JWT/bcrypt).
 */
@Injectable()
export class AuthService {
  readonly cookieName = 'agente01_painel';

  validarCredenciais(usuario: string, senha: string): boolean {
    return usuario === env.painel.usuario && senha === env.painel.senha;
  }

  /** Gera token "expiracaoEpoch.assinatura" valido por ~12h. */
  emitirToken(): string {
    const exp = Date.now() + 12 * 60 * 60 * 1000;
    return `${exp}.${this.assinar(String(exp))}`;
  }

  tokenValido(token?: string): boolean {
    if (!token || !token.includes('.')) return false;
    const [exp, sig] = token.split('.');
    if (!exp || !sig) return false;
    if (Date.now() > Number(exp)) return false;
    const esperado = this.assinar(exp);
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
    } catch {
      return false;
    }
  }

  cookieHeader(token: string): string {
    const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=43200'];
    if (env.painel.cookieSecure) flags.push('Secure');
    return `${this.cookieName}=${token}; ${flags.join('; ')}`;
  }

  cookieLimpar(): string {
    return `${this.cookieName}=; HttpOnly; Path=/; Max-Age=0`;
  }

  lerCookie(header?: string): string | undefined {
    if (!header) return undefined;
    const par = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${this.cookieName}=`));
    return par ? decodeURIComponent(par.split('=').slice(1).join('=')) : undefined;
  }

  private assinar(valor: string): string {
    return createHmac('sha256', env.painel.secret).update(valor).digest('hex');
  }
}
