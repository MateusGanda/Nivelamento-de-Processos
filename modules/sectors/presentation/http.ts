import type { SetoresService } from '../application/setores.ts';
import { ErroDeSetor, type CadastroSetor } from '../domain/setor.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

export function respostaErroSetores(erro: unknown): Response {
  if (erro instanceof ErroDeSetor) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: erro.codigo === 'CONFLITO' ? 409 : 400 });
  }
  if (erro instanceof ErroDeAcesso) {
    const status = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 }[erro.codigo];
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

export async function lerCadastroSetor(request: Request): Promise<CadastroSetor> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeSetor('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  }
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => campo !== 'nome' && campo !== 'descricao')) {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Informe somente nome e descrição.');
  }
  if (typeof dados.nome !== 'string') throw new ErroDeSetor('ENTRADA_INVALIDA', 'Nome deve ser texto obrigatório.');
  if (dados.descricao !== undefined && dados.descricao !== null && typeof dados.descricao !== 'string') {
    throw new ErroDeSetor('ENTRADA_INVALIDA', 'Descrição deve ser texto ou nula.');
  }
  return { nome: dados.nome, descricao: dados.descricao };
}

// A rota fornece a autorização real; testes substituem dependências sem usar o banco.
export function criarHandlersSetores({ autorizar, setores }: {
  autorizar: () => Promise<unknown>;
  setores: Pick<SetoresService, 'listar' | 'criar'>;
}) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await setores.listar(), { headers: { 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroSetores(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await setores.criar(await lerCadastroSetor(request)), { status: 201 });
      } catch (erro) { return respostaErroSetores(erro); }
    },
  };
}
