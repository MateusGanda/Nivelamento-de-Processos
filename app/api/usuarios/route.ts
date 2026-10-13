import { usuariosService } from '../../../modules/access/composition.ts';
import {
  exigirAdminDaSessao,
  exigirTexto,
  lerObjetoJson,
  respostaDeErro,
  respostaJson,
} from '../../../modules/access/presentation/http.ts';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    await exigirAdminDaSessao();
    return respostaJson(await usuariosService.listar());
  } catch (erro) {
    return respostaDeErro(erro);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await exigirAdminDaSessao();
    const corpo = await lerObjetoJson(request);
    const usuario = await usuariosService.criar({
      nome: exigirTexto(corpo, 'nome'),
      email: exigirTexto(corpo, 'email'),
      matricula: exigirTexto(corpo, 'matricula'),
      senha: exigirTexto(corpo, 'senha'),
    });
    return respostaJson(usuario, 201);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
