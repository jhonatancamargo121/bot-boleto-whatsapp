import { Module } from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [EvolutionModule],
  providers: [ContatosService],
  exports: [ContatosService],
})
export class ContatosModule {}
