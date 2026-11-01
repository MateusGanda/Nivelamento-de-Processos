import type { ExecucoesService } from '../application/execucoes.ts';
import { ErroDeExecucao } from '../domain/execucao.ts';
import type { ChaveIlha } from '../infrastructure/chave-ilha.ts';

export const COOKIE_ILHA = 'gunp_ilha';
const DURACAO_COOKIE = 30 * 24 * 60 * 60;

type CodigoAcesso = 'NAO_AUTENTICADO' | 'NAO_CONFIGURADO' | 'ENTRADA_INVALIDA';

export class ErroDeAcessoIlha extends Error {
  readonly codigo: CodigoAcesso;
  constructor(codigo: CodigoAcesso, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeAcessoIlha';
    this.codigo = codigo;
  }
}

const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, NAO_ENCONTRADO: 404, CONFLITO: 409, NAO_CONFIGURADO: 503 } as const;

export function respostaErroIlha(erro: unknown): Response {
  if (erro instanceof ErroDeExecucao || erro instanceof ErroDeAcessoIlha) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo], headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500 });
}

function lerCookie(request: Request, nome: string): string | undefined {
  for (const parte of (request.headers.get('cookie') ?? '').split(';')) {
    const [chave, ...valor] = parte.trim().split('=');
    if (chave === nome) return valor.join('=');
  }
  return undefined;
}

function cookieIlha(valor: string, maxAge: number): string {
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_ILHA}=${valor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${seguro}`;
}

// Lê um objeto JSON aceitando somente os campos listados.
async function lerCorpo(request: Request, campos: readonly string[]): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroDeExecucao('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !campos.includes(campo))) throw new ErroDeExecucao('ENTRADA_INVALIDA', `Informe somente: ${campos.join(', ')}.`);
  return dados;
}

type Dependencias = {
  chave: () => ChaveIlha;
  execucoes: Pick<ExecucoesService, 'identificar' | 'listarOrdensDisponiveis' | 'listarMotivos' | 'iniciar' | 'pausar' | 'retomar' | 'trocar' | 'baixar'>;
  // Atraso depois de uma chave errada, para dificultar tentativas em sequência.
  esperarAposErro?: () => Promise<void>;
};

const DESTINO = ['matricula', 'ordemId', 'etapaId', 'postoId'] as const;

// A ilha não usa a sessão administrativa: só o cookie do terminal liberado pela chave.
export function criarHandlersIlha({ chave, execucoes, esperarAposErro = () => new Promise((ok) => setTimeout(ok, 800)) }: Dependencias) {
  function exigirTerminal(request: Request) {
    const atual = chave();
    if (!atual.configurada) throw new ErroDeAcessoIlha('NAO_CONFIGURADO', 'A ilha ainda não foi configurada no servidor.');
    if (!atual.credencialValida(lerCookie(request, COOKIE_ILHA))) throw new ErroDeAcessoIlha('NAO_AUTENTICADO', 'Este terminal não está liberado para a ilha.');
  }

  async function responder(request: Request, acao: () => Promise<unknown>, status = 200): Promise<Response> {
    try {
      exigirTerminal(request);
      return Response.json(await acao(), { status, headers: { 'Cache-Control': 'no-store' } });
    } catch (erro) { return respostaErroIlha(erro); }
  }

  return {
    ACESSO_GET(request: Request): Response {
      const atual = chave();
      return Response.json({ configurada: atual.configurada, liberado: atual.credencialValida(lerCookie(request, COOKIE_ILHA)) }, { headers: { 'Cache-Control': 'no-store' } });
    },
    async ACESSO_POST(request: Request): Promise<Response> {
      try {
        const atual = chave();
        if (!atual.configurada) throw new ErroDeAcessoIlha('NAO_CONFIGURADO', 'A ilha ainda não foi configurada no servidor.');
        const { chave: informada } = await lerCorpo(request, ['chave']);
        if (typeof informada !== 'string' || !atual.confere(informada)) {
          await esperarAposErro();
          throw new ErroDeAcessoIlha('NAO_AUTENTICADO', 'Chave da ilha incorreta.');
        }
        return new Response(null, { status: 204, headers: { 'Set-Cookie': cookieIlha(atual.credencial(), DURACAO_COOKIE), 'Cache-Control': 'no-store' } });
      } catch (erro) { return respostaErroIlha(erro); }
    },
    ACESSO_DELETE(): Response {
      return new Response(null, { status: 204, headers: { 'Set-Cookie': cookieIlha('', 0), 'Cache-Control': 'no-store' } });
    },
    OPERADOR_GET: (request: Request, matricula: string) => responder(request, () => execucoes.identificar(matricula)),
    ORDENS_GET: (request: Request) => responder(request, () => execucoes.listarOrdensDisponiveis()),
    MOTIVOS_GET: (request: Request) => responder(request, () => execucoes.listarMotivos()),
    INICIAR_POST: (request: Request) => responder(request, async () => {
      const { matricula, ...destino } = await lerCorpo(request, DESTINO);
      return execucoes.iniciar(matricula, destino);
    }, 201),
    PAUSA_POST: (request: Request, id: string) => responder(request, async () => {
      const { matricula, motivoId } = await lerCorpo(request, ['matricula', 'motivoId']);
      return execucoes.pausar(matricula, id, motivoId);
    }),
    RETOMADA_POST: (request: Request, id: string) => responder(request, async () => {
      const { matricula } = await lerCorpo(request, ['matricula']);
      return execucoes.retomar(matricula, id);
    }),
    TROCA_POST: (request: Request, id: string) => responder(request, async () => {
      const { matricula, ...destino } = await lerCorpo(request, DESTINO);
      return execucoes.trocar(matricula, id, destino);
    }),
    BAIXA_POST: (request: Request, id: string) => responder(request, async () => {
      const { matricula, ...baixa } = await lerCorpo(request, ['matricula', 'quantidadeBoa', 'quantidadeRetrabalho', 'quantidadeRefugo']);
      return execucoes.baixar(matricula, id, baixa);
    }),
  };
}
