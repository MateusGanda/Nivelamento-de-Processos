import type { Usuario } from '../domain/usuario.ts';

type Credenciais = Record<'matricula' | 'senha', string> | undefined;
export type UsuarioDaSessao = { id: string; name: string; email: string; papel: Usuario['papel'] };

type Dependencias = {
  autenticar: (matricula: string, senha: string) => Promise<Usuario | null>;
  // Mesma espera usada pela ilha após chave errada: torna lenta a tentativa de várias senhas seguidas.
  esperarAposErro?: () => Promise<void>;
};

export function criarAutorizacaoLogin({ autenticar, esperarAposErro = () => new Promise((ok) => setTimeout(ok, 800)) }: Dependencias) {
  return async function autorizar(credenciais: Credenciais): Promise<UsuarioDaSessao | null> {
    if (!credenciais?.matricula || !credenciais.senha) {
      await esperarAposErro();
      return null;
    }
    let usuario: Usuario | null;
    try {
      usuario = await autenticar(credenciais.matricula, credenciais.senha);
    } catch {
      // Não expor mensagens do banco ou outros detalhes de infraestrutura.
      throw new Error('AuthenticationUnavailable');
    }
    if (!usuario) {
      await esperarAposErro();
      return null;
    }
    return { id: usuario.id, name: usuario.nome, email: usuario.email, papel: usuario.papel };
  };
}
