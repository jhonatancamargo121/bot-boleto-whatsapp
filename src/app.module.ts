import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RootController } from './root.controller';
import { DatabaseModule } from './database/database.module';
import { EvolutionModule } from './evolution/evolution.module';
import { ClientesModule } from './clientes/clientes.module';
import { BoletosModule } from './boletos/boletos.module';
import { ConversasModule } from './conversas/conversas.module';
import { MensagensModule } from './mensagens/mensagens.module';
import { IaModule } from './ia/ia.module';
import { AtendimentoModule } from './atendimento/atendimento.module';
import { AtendentesModule } from './atendentes/atendentes.module';
import { ContatosModule } from './contatos/contatos.module';
import { TemplatesModule } from './templates/templates.module';
import { CampanhasModule } from './campanhas/campanhas.module';
import { BotModule } from './bot/bot.module';
import { WebhookModule } from './webhook/webhook.module';
import { PainelModule } from './painel/painel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    EvolutionModule,
    ClientesModule,
    BoletosModule,
    ConversasModule,
    MensagensModule,
    IaModule,
    AtendimentoModule,
    AtendentesModule,
    ContatosModule,
    TemplatesModule,
    CampanhasModule,
    BotModule,
    WebhookModule,
    PainelModule,
  ],
  controllers: [RootController],
})
export class AppModule {}
