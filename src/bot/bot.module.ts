import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { ClientesModule } from '../clientes/clientes.module';
import { BoletosModule } from '../boletos/boletos.module';
import { ConversasModule } from '../conversas/conversas.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { IaModule } from '../ia/ia.module';
import { AtendimentoModule } from '../atendimento/atendimento.module';
import { AtendentesModule } from '../atendentes/atendentes.module';

@Module({
  imports: [
    ClientesModule,
    BoletosModule,
    ConversasModule,
    EvolutionModule,
    IaModule,
    AtendimentoModule,
    AtendentesModule,
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
