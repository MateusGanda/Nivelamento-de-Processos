import type { DispositivosService } from '../application/dispositivos.ts';
import { montarPainelTv, type FontesDoPainel } from '../application/painel-tv.ts';
import { ErroDeDispositivo, INTERVALO_ATUALIZACAO_MS, normalizarCodigo, type AlteracaoDispositivo, type CadastroDispositivo } from '../domain/dispositivo.ts';
import { ErroDeAcesso } from '../../access/domain/usuario.ts';

export const COOKIE_TV = 'gunp_tv';
// A TV fica liberada até o administrador desativá-la ou gerar outro código; o cookie dura um ano.
const DURACAO_COOKIE = 365 * 24 * 60 * 60;
const STATUS = { ENTRADA_INVALIDA: 400, NAO_AUTENTICADO: 401, SEM_AUTORIZACAO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409 } as const;
const SEM_CACHE = { 'Cache-Control': 'no-store' };

export function respostaErroDispositivos(erro: unknown): Response {
  if (erro instanceof ErroDeDispositivo || erro instanceof ErroDeAcesso) {
    return Response.json({ erro: { codigo: erro.codigo, mensagem: erro.message } }, { status: STATUS[erro.codigo], headers: SEM_CACHE });
  }
  return Response.json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Não foi possível concluir a solicitação.' } }, { status: 500, headers: SEM_CACHE });
}

async function lerObjeto(request: Request, campos: readonly string[]): Promise<Record<string, unknown>> {
  let corpo: unknown;
  try { corpo = await request.json(); }
  catch { throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Corpo JSON inválido.'); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Corpo JSON inválido.');
  const dados = corpo as Record<string, unknown>;
  if (Object.keys(dados).some((campo) => !campos.includes(campo))) throw new ErroDeDispositivo('ENTRADA_INVALIDA', `Informe somente: ${campos.join(', ')}.`);
  return dados;
}

const CAMPOS_CADASTRO = ['nome', 'local', 'setorId'] as const;

// ---------- cadastro, só para o administrador ----------
export function criarHandlersDispositivos({ autorizar, dispositivos }: {
  autorizar: () => Promise<unknown>;
  dispositivos: Pick<DispositivosService, 'listar' | 'criar' | 'alterar' | 'definirStatus' | 'gerarNovoCodigo'>;
}) {
  return {
    async GET(): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await dispositivos.listar(), { headers: SEM_CACHE });
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
    async POST(request: Request): Promise<Response> {
      try {
        await autorizar();
        const dados = await lerObjeto(request, CAMPOS_CADASTRO);
        return Response.json(await dispositivos.criar(dados as CadastroDispositivo), { status: 201, headers: SEM_CACHE });
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
    async PATCH(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        const dados = await lerObjeto(request, CAMPOS_CADASTRO);
        return Response.json(await dispositivos.alterar(id, dados as AlteracaoDispositivo), { headers: SEM_CACHE });
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
    async PATCH_STATUS(request: Request, id: string): Promise<Response> {
      try {
        await autorizar();
        const { ativo } = await lerObjeto(request, ['ativo']);
        return Response.json(await dispositivos.definirStatus(id, ativo as boolean), { headers: SEM_CACHE });
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
    async POST_CODIGO(id: string): Promise<Response> {
      try {
        await autorizar();
        return Response.json(await dispositivos.gerarNovoCodigo(id), { headers: SEM_CACHE });
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
  };
}

// ---------- a própria TV: liberação pelo código e dados da tela ----------
function lerCookie(request: Request, nome: string): string | undefined {
  for (const parte of (request.headers.get('cookie') ?? '').split(';')) {
    const [chave, ...valor] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(valor.join('='));
  }
  return undefined;
}

function cookieTv(valor: string, maxAge: number): string {
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_TV}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${seguro}`;
}

export function criarHandlersTv({ dispositivos, fontes, agora = () => new Date(), esperarAposErro = () => new Promise((ok) => setTimeout(ok, 800)) }: {
  dispositivos: Pick<DispositivosService, 'autenticarCodigo' | 'identificar' | 'registrarConexao'>;
  fontes: FontesDoPainel;
  agora?: () => Date;
  // Atraso depois de um código errado, para dificultar tentativas em sequência (como na chave da ilha).
  esperarAposErro?: () => Promise<void>;
}) {
  async function exigirTv(request: Request) {
    const dispositivo = await dispositivos.identificar(lerCookie(request, COOKIE_TV));
    if (!dispositivo) throw new ErroDeDispositivo('NAO_AUTENTICADO', 'Esta TV não está liberada. Digite o código de acesso.');
    return dispositivo;
  }

  return {
    async ACESSO_POST(request: Request): Promise<Response> {
      try {
        const { codigo } = await lerObjeto(request, ['codigo']);
        try {
          const dispositivo = await dispositivos.autenticarCodigo(codigo);
          await dispositivos.registrarConexao(dispositivo);
          return new Response(null, { status: 204, headers: { 'Set-Cookie': cookieTv(normalizarCodigo(codigo) ?? '', DURACAO_COOKIE), ...SEM_CACHE } });
        } catch (erro) {
          if (erro instanceof ErroDeDispositivo && erro.codigo === 'NAO_AUTENTICADO') await esperarAposErro();
          throw erro;
        }
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
    ACESSO_DELETE(): Response {
      return new Response(null, { status: 204, headers: { 'Set-Cookie': cookieTv('', 0), ...SEM_CACHE } });
    },
    // Cada busca dos dados também é o sinal de "ligada" da TV (telemetria).
    async PAINEL_GET(request: Request): Promise<Response> {
      try {
        const dispositivo = await exigirTv(request);
        await dispositivos.registrarConexao(dispositivo);
        return Response.json(await montarPainelTv(dispositivo, fontes, agora().getTime(), INTERVALO_ATUALIZACAO_MS / 1000), { headers: SEM_CACHE });
      } catch (erro) { return respostaErroDispositivos(erro); }
    },
  };
}
