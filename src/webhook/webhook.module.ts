import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { SimuladorController } from './simulador.controller';
import { BotModule } from '../bot/bot.module';
import { ClientesModule } from '../clientes/clientes.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { MensagensModule } from '../mensagens/mensagens.module';

@Module({
  imports: [BotModule, ClientesModule, EvolutionModule, MensagensModule],
  controllers: [WebhookController, SimuladorController],
})
export class WebhookModule {}
