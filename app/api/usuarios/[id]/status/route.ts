import { usuariosService } from '../../../../../modules/access/composition.ts';
import {
  exigirAdminDaSessao,
  lerObjetoJson,
  respostaDeErro,
  respostaJson,
} from '../../../../../modules/access/presentation/http.ts';
import { ErroDeAcesso } from '../../../../../modules/access/domain/usuario.ts';

export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Contexto): Promise<Response> {
  try {
    const autor = await exigirAdminDaSessao();
    const corpo = await lerObjetoJson(request);
    if (typeof corpo.ativo !== 'boolean') {
      throw new ErroDeAcesso('ENTRADA_INVALIDA', 'ativo deve ser booleano.');
    }
    return respostaJson(await usuariosService.definirStatus(autor.id, (await params).id, corpo.ativo));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
