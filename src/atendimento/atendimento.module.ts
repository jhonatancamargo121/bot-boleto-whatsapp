import { Module } from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';

@Module({
  providers: [AtendimentoService],
  exports: [AtendimentoService],
})
export class AtendimentoModule {}
