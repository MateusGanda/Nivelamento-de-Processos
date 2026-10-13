import {
  ErroDeAcesso,
  PAPEL_ADMIN,
  paraUsuarioPublico,
  validarEmail,
  validarMatricula,
  validarNome,
  validarSenha,
  type Usuario,
  type UsuarioPublico,
} from '../domain/usuario.ts';
import type { PasswordHasher, UsuarioRepository } from './contracts.ts';

type CriarUsuarioInput = { nome: string; email: string; matricula: string; senha: string };
type AtualizarUsuarioInput = Partial<Pick<CriarUsuarioInput, 'nome' | 'email' | 'matricula'>>;

export class UsuariosService {
  private readonly usuarios: UsuarioRepository;
  private readonly senhas: PasswordHasher;

  constructor(
    usuarios: UsuarioRepository,
    senhas: PasswordHasher,
  ) {
    this.usuarios = usuarios;
    this.senhas = senhas;
  }

  async listar(): Promise<UsuarioPublico[]> {
    return (await this.usuarios.listar()).map(paraUsuarioPublico);
  }

  async buscar(id: string): Promise<UsuarioPublico> {
    return paraUsuarioPublico(await this.exigirUsuario(id));
  }

  async criar(input: CriarUsuarioInput): Promise<UsuarioPublico> {
    const nome = validarNome(input.nome);
    const email = validarEmail(input.email);
    const matricula = validarMatricula(input.matricula);
    const senha = validarSenha(input.senha);
    await this.exigirIdentificadoresDisponiveis(email, matricula);
    const senhaHash = await this.senhas.gerar(senha);
    return paraUsuarioPublico(await this.usuarios.criar({ nome, email, matricula, senhaHash }));
  }

  async atualizar(id: string, input: AtualizarUsuarioInput): Promise<UsuarioPublico> {
    const existente = await this.exigirUsuario(id);
    const dados: AtualizarUsuarioInput = {};
    if (input.nome !== undefined) dados.nome = validarNome(input.nome);
    if (input.email !== undefined) {
      dados.email = validarEmail(input.email);
      if (dados.email !== existente.email) await this.exigirEmailDisponivel(dados.email, id);
    }
    if (input.matricula !== undefined) {
      dados.matricula = validarMatricula(input.matricula);
      if (dados.matricula !== existente.matricula) await this.exigirMatriculaDisponivel(dados.matricula, id);
    }
    if (Object.keys(dados).length === 0) {
      throw new ErroDeAcesso('ENTRADA_INVALIDA', 'Informe ao menos um dado para atualização.');
    }
    return paraUsuarioPublico(await this.usuarios.atualizar(id, dados));
  }

  async definirStatus(autorId: string, id: string, ativo: boolean): Promise<UsuarioPublico> {
    await this.exigirUsuario(id);
    if (!ativo && autorId === id) {
      throw new ErroDeAcesso('CONFLITO', 'Um usuário não pode desativar a própria conta.');
    }
    return paraUsuarioPublico(await this.usuarios.definirAtivo(id, ativo));
  }

  async redefinirSenha(id: string, novaSenha: string): Promise<void> {
    await this.exigirUsuario(id);
    await this.usuarios.definirSenhaHash(id, await this.senhas.gerar(validarSenha(novaSenha)));
  }

  async alterarPropriaSenha(id: string, senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = await this.exigirUsuario(id);
    if (!(await this.senhas.verificar(usuario.senhaHash, senhaAtual))) {
      throw new ErroDeAcesso('SEM_AUTORIZACAO', 'Senha atual inválida.');
    }
    await this.usuarios.definirSenhaHash(id, await this.senhas.gerar(validarSenha(novaSenha)));
  }

  async autenticar(matricula: string, senha: string): Promise<Usuario | null> {
    try {
      const usuario = await this.usuarios.buscarPorMatricula(validarMatricula(matricula));
      if (!usuario || !usuario.ativo || usuario.papel !== PAPEL_ADMIN) return null;
      return (await this.senhas.verificar(usuario.senhaHash, senha)) ? usuario : null;
    } catch (erro) {
      if (erro instanceof ErroDeAcesso && erro.codigo === 'ENTRADA_INVALIDA') return null;
      throw erro;
    }
  }

  async exigirAdminAtivo(id: string): Promise<Usuario> {
    const usuario = await this.exigirUsuario(id);
    if (!usuario.ativo || usuario.papel !== PAPEL_ADMIN) {
      throw new ErroDeAcesso('SEM_AUTORIZACAO', 'Acesso administrativo não autorizado.');
    }
    return usuario;
  }

  async criarPrimeiroAdmin(input: CriarUsuarioInput): Promise<UsuarioPublico> {
    if ((await this.usuarios.contarAdminsAtivos()) > 0) {
      throw new ErroDeAcesso('CONFLITO', 'Já existe um usuário administrativo ativo.');
    }
    return this.criar(input);
  }

  private async exigirUsuario(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) throw new ErroDeAcesso('NAO_ENCONTRADO', 'Usuário não encontrado.');
    return usuario;
  }

  private async exigirIdentificadoresDisponiveis(email: string, matricula: string): Promise<void> {
    await this.exigirEmailDisponivel(email);
    await this.exigirMatriculaDisponivel(matricula);
  }

  private async exigirEmailDisponivel(email: string, idAtual?: string): Promise<void> {
    const usuario = await this.usuarios.buscarPorEmail(email);
    if (usuario && usuario.id !== idAtual) throw new ErroDeAcesso('CONFLITO', 'E-mail já está em uso.');
  }

  private async exigirMatriculaDisponivel(matricula: string, idAtual?: string): Promise<void> {
    const usuario = await this.usuarios.buscarPorMatricula(matricula);
    if (usuario && usuario.id !== idAtual) throw new ErroDeAcesso('CONFLITO', 'Matrícula já está em uso.');
  }
}
