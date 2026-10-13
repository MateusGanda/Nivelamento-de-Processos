import type { Usuario } from '../domain/usuario.ts';

export type NovoUsuario = {
  nome: string;
  email: string;
  matricula: string;
  senhaHash: string;
};

export type AtualizacaoUsuario = Partial<Pick<Usuario, 'nome' | 'email' | 'matricula'>>;

export interface UsuarioRepository {
  listar(): Promise<Usuario[]>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  buscarPorMatricula(matricula: string): Promise<Usuario | null>;
  criar(usuario: NovoUsuario): Promise<Usuario>;
  atualizar(id: string, dados: AtualizacaoUsuario): Promise<Usuario>;
  definirAtivo(id: string, ativo: boolean): Promise<Usuario>;
  definirSenhaHash(id: string, senhaHash: string): Promise<Usuario>;
  contarAdminsAtivos(): Promise<number>;
}

export interface PasswordHasher {
  gerar(senha: string): Promise<string>;
  verificar(hash: string, senha: string): Promise<boolean>;
}
