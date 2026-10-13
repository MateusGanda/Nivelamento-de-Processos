import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth.ts';
import { usuariosService } from '../composition.ts';
import { ErroDeAcesso, paraUsuarioPublico, type UsuarioPublico } from '../domain/usuario.ts';

// Usado somente em Server Components. Falhas de infraestrutura seguem para
// a error boundary; nunca são interpretadas como autorização ou ausência de sessão.
export async function obterAdminParaPagina(): Promise<UsuarioPublico | null> {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id || sessao.user.papel !== 'ADMIN') return null;

  try {
    return paraUsuarioPublico(await usuariosService.exigirAdminAtivo(sessao.user.id));
  } catch (erro) {
    if (erro instanceof ErroDeAcesso &&
      (erro.codigo === 'NAO_ENCONTRADO' || erro.codigo === 'SEM_AUTORIZACAO')) {
      return null;
    }
    throw erro;
  }
}
