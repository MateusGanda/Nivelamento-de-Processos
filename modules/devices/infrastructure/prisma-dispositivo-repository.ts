import { db } from '../../../src/prisma/db.ts';
import type { DispositivoRepository, PostoDoPainel } from '../application/contracts.ts';
import { ErroDeDispositivo, type AlteracaoDispositivo, type DadosDispositivo, type Dispositivo } from '../domain/dispositivo.ts';

// A constraint continua sendo a garantia contra nome repetido em pedidos simultâneos.
function traduzirErroGravacao(erro: unknown): never {
  let atual = erro;
  const visitados = new Set<object>();
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual);
    const dados = atual as { sqlState?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    if ((dados.sqlState === '23505' || dados.code === '23505') && dados.constraint === 'Dispositivo_nome_key') {
      throw new ErroDeDispositivo('CONFLITO', 'Já existe uma TV com esse nome.');
    }
    atual = dados.cause;
  }
  throw erro;
}

type Linha = {
  id: string; nome: string; local: string | null; ativo: boolean; ultimaConexaoEm: string | null; createdAt: string; updatedAt: string;
  setor: { id: string; nome: string } | null;
};

const mapear = (d: Linha): Dispositivo => ({
  id: d.id, nome: d.nome, local: d.local, setor: d.setor ? { id: d.setor.id, nome: d.setor.nome } : null,
  ativo: d.ativo, ultimaConexaoEm: d.ultimaConexaoEm, createdAt: d.createdAt, updatedAt: d.updatedAt,
});

const CAMPOS = ['id', 'nome', 'local', 'ativo', 'ultimaConexaoEm', 'createdAt', 'updatedAt', 'setorId'] as const;

export class PrismaDispositivoRepository implements DispositivoRepository {
  private consulta() {
    return db.orm.public.Dispositivo.select(...CAMPOS).include('setor', (setor) => setor.select('id', 'nome'));
  }

  private async buscar(filtro: { id: string } | { nome: string } | { codigoHash: string }): Promise<Dispositivo | null> {
    const linha = await this.consulta().where(filtro).first();
    return linha ? mapear(linha) : null;
  }

  async listar(): Promise<Dispositivo[]> {
    return (await this.consulta().orderBy((d) => d.nome.asc()).all()).map(mapear);
  }

  buscarPorId(id: string) { return this.buscar({ id }); }
  buscarPorNome(nome: string) { return this.buscar({ nome }); }
  buscarPorCodigoHash(codigoHash: string) { return this.buscar({ codigoHash }); }

  async setorExiste(id: string): Promise<boolean> {
    return !!await db.orm.public.Setor.where({ id }).select('id').first();
  }

  async criar(dados: DadosDispositivo, codigoHash: string): Promise<Dispositivo> {
    try {
      const criado = await db.orm.public.Dispositivo.create({ nome: dados.nome, local: dados.local, setorId: dados.setorId, codigoHash, ativo: true, ultimaConexaoEm: null });
      return (await this.buscarPorId(criado.id))!;
    } catch (erro) {
      return traduzirErroGravacao(erro);
    }
  }

  async alterar(id: string, dados: AlteracaoDispositivo): Promise<Dispositivo | null> {
    try {
      const alterado = await db.orm.public.Dispositivo.where({ id }).update({ ...dados, updatedAt: new Date().toISOString() });
      return alterado ? this.buscarPorId(id) : null;
    } catch (erro) {
      return traduzirErroGravacao(erro);
    }
  }

  async definirAtivo(id: string, ativo: boolean): Promise<Dispositivo | null> {
    const alterado = await db.orm.public.Dispositivo.where({ id }).update({ ativo, updatedAt: new Date().toISOString() });
    return alterado ? this.buscarPorId(id) : null;
  }

  // O código novo invalida o anterior; a TV volta a aparecer como "nunca conectou" até ser liberada de novo.
  async trocarCodigo(id: string, codigoHash: string): Promise<Dispositivo | null> {
    const alterado = await db.orm.public.Dispositivo.where({ id }).update({ codigoHash, ultimaConexaoEm: null, updatedAt: new Date().toISOString() });
    return alterado ? this.buscarPorId(id) : null;
  }

  async registrarConexao(id: string, agora: string): Promise<void> {
    await db.orm.public.Dispositivo.where({ id }).update({ ultimaConexaoEm: agora });
  }

  async listarPostosAtivos(): Promise<PostoDoPainel[]> {
    const postos = await db.orm.public.Posto.where({ ativo: true }).select('id', 'codigo', 'nome', 'setorId')
      .include('setor', (setor) => setor.select('id', 'nome')).all();
    return postos.flatMap((p) => p.setor ? [{ id: p.id, codigo: p.codigo, nome: p.nome, setor: { id: p.setor.id, nome: p.setor.nome } }] : []);
  }
}
