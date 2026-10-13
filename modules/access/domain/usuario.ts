export const PAPEL_ADMIN = 'ADMIN' as const;
export type PapelUsuario = typeof PAPEL_ADMIN;

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  senhaHash: string;
  papel: PapelUsuario;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UsuarioPublico = Omit<Usuario, 'senhaHash'>;

export class ErroDeAcesso extends Error {
  readonly codigo: 'ENTRADA_INVALIDA' | 'CONFLITO' | 'NAO_ENCONTRADO' | 'NAO_AUTENTICADO' | 'SEM_AUTORIZACAO';

  constructor(
    codigo: 'ENTRADA_INVALIDA' | 'CONFLITO' | 'NAO_ENCONTRADO' | 'NAO_AUTENTICADO' | 'SEM_AUTORIZACAO',
    message: string,
  ) {
    super(message);
    this.codigo = codigo;
    this.name = 'ErroDeAcesso';
  }
}

export function validarNome(nome: string): string {
  const normalizado = nome.trim();
  if (normalizado.length === 0 || normalizado.length > 120) {
    throw new ErroDeAcesso('ENTRADA_INVALIDA', 'Nome deve conter entre 1 e 120 caracteres.');
  }
  return normalizado;
}

export function validarEmail(email: string): string {
  const normalizado = email.trim().toLowerCase();
  if (normalizado.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    throw new ErroDeAcesso('ENTRADA_INVALIDA', 'E-mail inválido.');
  }
  return normalizado;
}

export function validarMatricula(matricula: string): string {
  const normalizada = matricula.trim();
  if (normalizada.length === 0 || normalizada.length > 64) {
    throw new ErroDeAcesso('ENTRADA_INVALIDA', 'Matrícula deve conter entre 1 e 64 caracteres.');
  }
  return normalizada;
}

export function validarSenha(senha: string): string {
  if (senha.length < 8 || senha.length > 128) {
    throw new ErroDeAcesso('ENTRADA_INVALIDA', 'Senha deve conter entre 8 e 128 caracteres.');
  }
  return senha;
}

export function paraUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    matricula: usuario.matricula,
    papel: usuario.papel,
    ativo: usuario.ativo,
    createdAt: usuario.createdAt,
    updatedAt: usuario.updatedAt,
  };
}
