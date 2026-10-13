import { usuariosService } from '../../../../modules/access/composition.ts';
import {
  exigirAdminDaSessao,
  lerObjetoJson,
  respostaDeErro,
  respostaJson,
  textoOpcional,
} from '../../../../modules/access/presentation/http.ts';

export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Contexto): Promise<Response> {
  try {
    await exigirAdminDaSessao();
    return respostaJson(await usuariosService.buscar((await params).id));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function PATCH(request: Request, { params }: Contexto): Promise<Response> {
  try {
    await exigirAdminDaSessao();
    const corpo = await lerObjetoJson(request);
    return respostaJson(await usuariosService.atualizar((await params).id, {
      nome: textoOpcional(corpo, 'nome'),
      email: textoOpcional(corpo, 'email'),
      matricula: textoOpcional(corpo, 'matricula'),
    }));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
