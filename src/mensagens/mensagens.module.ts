import { Module } from '@nestjs/common';
import { MensagensService } from './mensagens.service';

@Module({
  providers: [MensagensService],
  exports: [MensagensService],
})
export class MensagensModule {}
