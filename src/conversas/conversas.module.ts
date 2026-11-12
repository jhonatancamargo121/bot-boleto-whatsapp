import { Module } from '@nestjs/common';
import { ConversasService } from './conversas.service';

@Module({
  providers: [ConversasService],
  exports: [ConversasService],
})
export class ConversasModule {}
