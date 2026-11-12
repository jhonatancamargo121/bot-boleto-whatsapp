import { Module } from '@nestjs/common';
import { PainelController } from './painel.controller';
import { ContatosPainelController } from './contatos.controller';
import { TemplatesPainelController } from './templates.controller';
import { CampanhasPainelController } from './campanhas.controller';
import { AtendentesPainelController } from './atendentes.controller';
import { AuthService } from './auth.service';
import { MensagensModule } from '../mensagens/mensagens.module';
import { AtendimentoModule } from '../atendimento/atendimento.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { ContatosModule } from '../contatos/contatos.module';
import { TemplatesModule } from '../templates/templates.module';
import { CampanhasModule } from '../campanhas/campanhas.module';
import { AtendentesModule } from '../atendentes/atendentes.module';

@Module({
  imports: [
    MensagensModule,
    AtendimentoModule,
    EvolutionModule,
    ContatosModule,
    TemplatesModule,
    CampanhasModule,
    AtendentesModule,
  ],
  controllers: [
    PainelController,
    ContatosPainelController,
    TemplatesPainelController,
    CampanhasPainelController,
    AtendentesPainelController,
  ],
  providers: [AuthService],
})
export class PainelModule {}
