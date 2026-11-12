import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

/** Raiz do dominio: leva direto ao painel. */
@Controller()
export class RootController {
  @Get()
  root(@Res() res: Response) {
    res.redirect(302, '/painel');
  }
}
