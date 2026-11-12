import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { env } from './config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  await app.listen(env.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Bot de boletos rodando na porta ${env.port}`);
  logger.log(`Evolution API: ${env.evolution.apiUrl} | instancia: ${env.evolution.instance}`);
  logger.log(`Webhook do WhatsApp: POST /webhook/whatsapp?token=***`);
  logger.log(`Painel de monitoramento: GET /painel (conexao do WhatsApp em /painel/conexao)`);
  logger.log(`Simulador: GET /simular`);
  logger.log(`IA (DeepSeek): ${env.ia.enabled ? 'ativada (' + env.ia.model + ')' : 'desativada'}`);
  if (!env.evolution.apiKey) {
    logger.warn('EVOLUTION_API_KEY vazia - envios para o WhatsApp vao falhar ate configurar o .env');
  }
  if (!env.database.url) {
    logger.warn('DATABASE_URL vazia - persistencia e painel nao funcionarao');
  }
}
bootstrap();
