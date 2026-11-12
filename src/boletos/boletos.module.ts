import { Module } from '@nestjs/common';
import { BoletosService } from './boletos.service';

@Module({
  providers: [BoletosService],
  exports: [BoletosService],
})
export class BoletosModule {}
