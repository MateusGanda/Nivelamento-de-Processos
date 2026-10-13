import { usuariosService } from '../../../../../modules/access/composition.ts';
import {
  exigirAdminDaSessao,
  exigirTexto,
  lerObjetoJson,
  respostaDeErro,
} from '../../../../../modules/access/presentation/http.ts';

export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Contexto): Promise<Response> {
  try {
    await exigirAdminDaSessao();
    const corpo = await lerObjetoJson(request);
    await usuariosService.redefinirSenha((await params).id, exigirTexto(corpo, 'novaSenha'));
    return new Response(null, { status: 204 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
