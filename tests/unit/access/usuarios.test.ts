import test from 'node:test';
import assert from 'node:assert/strict';
import { UsuariosService } from '../../../modules/access/application/usuarios.ts';
import { ErroDeAcesso, PAPEL_ADMIN, type Usuario } from '../../../modules/access/domain/usuario.ts';
import type { PasswordHasher, UsuarioRepository } from '../../../modules/access/application/contracts.ts';

class RepositorioEmMemoria implements UsuarioRepository {
  usuarios: Usuario[] = [];

  async listar() { return this.usuarios; }
  async buscarPorId(id: string) { return this.usuarios.find((usuario) => usuario.id === id) ?? null; }
  async buscarPorEmail(email: string) { return this.usuarios.find((usuario) => usuario.email === email) ?? null; }
  async buscarPorMatricula(matricula: string) { return this.usuarios.find((usuario) => usuario.matricula === matricula) ?? null; }
  async criar(input: { nome: string; email: string; matricula: string; senhaHash: string }) {
    const usuario: Usuario = { id: String(this.usuarios.length + 1), ...input, papel: PAPEL_ADMIN, ativo: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    this.usuarios.push(usuario);
    return usuario;
  }
  async atualizar(id: string, dados: Partial<Pick<Usuario, 'nome' | 'email' | 'matricula'>>) {
    const usuario = (await this.buscarPorId(id))!;
    Object.assign(usuario, dados);
    return usuario;
  }
  async definirAtivo(id: string, ativo: boolean) {
    const usuario = (await this.buscarPorId(id))!;
    usuario.ativo = ativo;
    return usuario;
  }
  async definirSenhaHash(id: string, senhaHash: string) {
    const usuario = (await this.buscarPorId(id))!;
    usuario.senhaHash = senhaHash;
    return usuario;
  }
  async contarAdminsAtivos() { return this.usuarios.filter((usuario) => usuario.ativo && usuario.papel === PAPEL_ADMIN).length; }
}

class HasherDeTeste implements PasswordHasher {
  async gerar(senha: string) { return `hash:${senha}`; }
  async verificar(hash: string, senha: string) { return hash === `hash:${senha}`; }
}

function criarServico() {
  return new UsuariosService(new RepositorioEmMemoria(), new HasherDeTeste());
}

test('cria ADMIN com hash e sem expor senhaHash', async () => {
  const service = criarServico();
  const usuario = await service.criar({ nome: 'Ana', email: 'ANA@EXEMPLO.COM', matricula: 'ADM-01', senha: 'senha-segura' });
  assert.deepEqual(usuario, {
    id: '1', nome: 'Ana', email: 'ana@exemplo.com', matricula: 'ADM-01', papel: 'ADMIN', ativo: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });
});

test('rejeita e-mail ou matrícula duplicados e senha inválida', async () => {
  const service = criarServico();
  await service.criar({ nome: 'Ana', email: 'ana@exemplo.com', matricula: 'ADM-01', senha: 'senha-segura' });
  await assert.rejects(() => service.criar({ nome: 'Bia', email: 'ana@exemplo.com', matricula: 'ADM-02', senha: 'senha-segura' }), (erro: unknown) => erro instanceof ErroDeAcesso && erro.codigo === 'CONFLITO');
  await assert.rejects(() => service.criar({ nome: 'Bia', email: 'bia@exemplo.com', matricula: 'ADM-01', senha: 'senha-segura' }), (erro: unknown) => erro instanceof ErroDeAcesso && erro.codigo === 'CONFLITO');
  await assert.rejects(() => service.criar({ nome: 'Bia', email: 'bia@exemplo.com', matricula: 'ADM-02', senha: 'curta' }), /8 e 128/);
});

test('autentica somente ADMIN ativo com matrícula e senha corretas', async () => {
  const service = criarServico();
  const usuario = await service.criar({ nome: 'Ana', email: 'ana@exemplo.com', matricula: 'ADM-01', senha: 'senha-segura' });
  assert.equal((await service.autenticar('ADM-01', 'senha-segura'))?.id, usuario.id);
  assert.equal(await service.autenticar('ADM-01', 'senha-incorreta'), null);
  await service.definirStatus('outro-admin', usuario.id, false);
  assert.equal(await service.autenticar('ADM-01', 'senha-segura'), null);
  await assert.rejects(() => service.exigirAdminAtivo(usuario.id), (erro: unknown) => erro instanceof ErroDeAcesso && erro.codigo === 'SEM_AUTORIZACAO');
});

test('impede auto-desativação e exige a senha atual para troca própria', async () => {
  const service = criarServico();
  const usuario = await service.criar({ nome: 'Ana', email: 'ana@exemplo.com', matricula: 'ADM-01', senha: 'senha-segura' });
  await assert.rejects(() => service.definirStatus(usuario.id, usuario.id, false), /própria conta/);
  await assert.rejects(() => service.alterarPropriaSenha(usuario.id, 'errada', 'nova-senha-segura'), /Senha atual inválida/);
  await service.alterarPropriaSenha(usuario.id, 'senha-segura', 'nova-senha-segura');
  assert.equal((await service.autenticar('ADM-01', 'nova-senha-segura'))?.id, usuario.id);
});

test('bootstrap só permite o primeiro ADMIN ativo', async () => {
  const service = criarServico();
  await service.criarPrimeiroAdmin({ nome: 'Ana', email: 'ana@exemplo.com', matricula: 'ADM-01', senha: 'senha-segura' });
  await assert.rejects(() => service.criarPrimeiroAdmin({ nome: 'Bia', email: 'bia@exemplo.com', matricula: 'ADM-02', senha: 'senha-segura' }), /Já existe/);
});

test('matrícula vazia é rejeitada sem autenticar', async () => {
  assert.equal(await criarServico().autenticar('   ', 'senha-segura'), null);
});

test('falha de persistência no login não é confundida com credenciais inválidas', async () => {
  class RepositorioIndisponivel extends RepositorioEmMemoria {
    async buscarPorMatricula(): Promise<Usuario | null> {
      throw new Error('Persistência indisponível');
    }
  }
  const service = new UsuariosService(new RepositorioIndisponivel(), new HasherDeTeste());
  await assert.rejects(() => service.autenticar('ADM-01', 'senha-segura'), /Persistência indisponível/);
});
