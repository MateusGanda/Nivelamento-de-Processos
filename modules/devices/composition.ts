import { DispositivosService } from './application/dispositivos.ts';
import type { FontesDoPainel } from './application/painel-tv.ts';
import { codigosDeAcesso } from './infrastructure/codigos-de-acesso.ts';
import { PrismaDispositivoRepository } from './infrastructure/prisma-dispositivo-repository.ts';
import { execucoesService } from '../executions/composition.ts';
import { indicadoresService } from '../indicators/composition.ts';

const repositorio = new PrismaDispositivoRepository();

export const dispositivosService = new DispositivosService(repositorio, codigosDeAcesso);

// A tela da TV reaproveita o acompanhamento das execuções e os indicadores, sem consultas próprias de produção.
export const fontesDoPainel: FontesDoPainel = {
  postosAtivos: () => repositorio.listarPostosAtivos(),
  execucoesAbertas: () => execucoesService.listarAbertas(),
  indicadores: (periodo) => indicadoresService.consultar(periodo),
};
