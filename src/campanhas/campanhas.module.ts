import { Module } from '@nestjs/common';
import { CampanhasService } from './campanhas.service';
import { TemplatesModule } from '../templates/templates.module';
import { ContatosModule } from '../contatos/contatos.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { MensagensModule } from '../mensagens/mensagens.module';

@Module({
  imports: [TemplatesModule, ContatosModule, EvolutionModule, MensagensModule],
  providers: [CampanhasService],
  exports: [CampanhasService],
})
export class CampanhasModule {}
