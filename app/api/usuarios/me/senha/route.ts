import { usuariosService } from '../../../../../modules/access/composition.ts';
import {
  exigirAdminDaSessao,
  exigirTexto,
  lerObjetoJson,
  respostaDeErro,
} from '../../../../../modules/access/presentation/http.ts';

export const runtime = 'nodejs';

export async function PUT(request: Request): Promise<Response> {
  try {
    const usuario = await exigirAdminDaSessao();
    const corpo = await lerObjetoJson(request);
    await usuariosService.alterarPropriaSenha(
      usuario.id,
      exigirTexto(corpo, 'senhaAtual'),
      exigirTexto(corpo, 'novaSenha'),
    );
    return new Response(null, { status: 204 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
