import { Module } from '@nestjs/common';
import { AtendentesService } from './atendentes.service';

@Module({
  providers: [AtendentesService],
  exports: [AtendentesService],
})
export class AtendentesModule {}
