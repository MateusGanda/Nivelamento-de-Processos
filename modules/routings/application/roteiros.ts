import {
  ehIdentificadorValido, ErroDeRoteiro, validarEtapasInformadas, validarNomeRoteiro, validarPostosInformados, validarTemposInformados,
  type OperacaoDoRoteiro, type ProdutoDoRoteiro, type RoteiroDetalhe, type RoteiroResumo,
} from '../domain/roteiro.ts';
import type { RoteiroRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDeRoteiro('NAO_ENCONTRADO', 'Roteiro não encontrado.');
const MENSAGEM_TEMPOS_TRAVADOS = 'Este produto já tem ordens com esta versão do roteiro. Para mudar os tempos padrão, crie uma nova versão.';

function produtoLigado(roteiro: RoteiroDetalhe, produtoId: string): ProdutoDoRoteiro {
  const produto = roteiro.produtos.find((item) => item.id === produtoId);
  if (!produto) throw new ErroDeRoteiro('NAO_ENCONTRADO', 'Produto não está ligado a este roteiro.');
  return produto;
}

export class RoteirosService {
  private readonly roteiros: RoteiroRepository;

  constructor(roteiros: RoteiroRepository) {
    this.roteiros = roteiros;
  }

  async listar(): Promise<RoteiroResumo[]> {
    return this.roteiros.listar();
  }

  async listarOperacoes(): Promise<OperacaoDoRoteiro[]> {
    return this.roteiros.listarOperacoes();
  }

  async buscar(id: string): Promise<RoteiroDetalhe> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const roteiro = await this.roteiros.buscar(id);
    if (!roteiro) throw naoEncontrado();
    return roteiro;
  }

  // Um roteiro novo começa na versão 1; versões seguintes saem de criarVersao.
  async criar(input: { nome: string }): Promise<RoteiroDetalhe> {
    const nome = validarNomeRoteiro(input.nome);
    if (await this.roteiros.existeNome(nome)) {
      throw new ErroDeRoteiro('CONFLITO', 'Já existe um roteiro com esse nome. Abra-o e use Nova versão.');
    }
    return this.buscar(await this.roteiros.criar(nome));
  }

  async definirStatus(id: string, ativo: boolean): Promise<RoteiroDetalhe> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    if (typeof ativo !== 'boolean') throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const roteiro = await this.buscar(id);
    if (!ativo && roteiro.produtos.some((produto) => produto.vigente)) {
      throw new ErroDeRoteiro('CONFLITO', 'Este roteiro é o vigente de algum produto. Torne outra versão vigente antes de inativar.');
    }
    if (!await this.roteiros.definirAtivo(id, ativo)) throw naoEncontrado();
    return this.buscar(id);
  }

  async salvarEtapas(id: string, input: unknown): Promise<RoteiroDetalhe> {
    const roteiro = await this.buscar(id);
    const etapas = validarEtapasInformadas(input);
    if (roteiro.travado) {
      throw new ErroDeRoteiro('CONFLITO', 'Este roteiro já tem ordens de produção. Para mudar as etapas, crie uma nova versão.');
    }
    const atuais = new Map(roteiro.etapas.map((etapa) => [etapa.id, etapa]));
    for (const etapa of etapas) {
      if (etapa.id === undefined) continue;
      const atual = atuais.get(etapa.id);
      if (!atual) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Etapa não pertence a este roteiro.');
      if (atual.operacao.id !== etapa.operacaoId) {
        throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Para trocar a operação, remova a etapa e adicione outra.');
      }
    }
    const operacoes = [...new Set(etapas.map((etapa) => etapa.operacaoId))];
    if ((await this.roteiros.buscarOperacoes(operacoes)).length !== operacoes.length) {
      throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Operação não encontrada.');
    }
    await this.roteiros.substituirEtapas(id, etapas);
    return this.buscar(id);
  }

  // Os postos compatíveis podem mudar mesmo com ordens: não alteram a versão nem os tempos registrados.
  async definirPostosDaEtapa(id: string, etapaId: string, input: unknown): Promise<RoteiroDetalhe> {
    const roteiro = await this.buscar(id);
    const etapa = ehIdentificadorValido(etapaId) ? roteiro.etapas.find((item) => item.id === etapaId) : undefined;
    if (!etapa) throw new ErroDeRoteiro('NAO_ENCONTRADO', 'Etapa não encontrada neste roteiro.');
    const postoIds = validarPostosInformados(input);
    const encontrados = new Map((await this.roteiros.buscarPostos(postoIds)).map((posto) => [posto.id, posto]));
    if (encontrados.size !== postoIds.length) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Posto não encontrado.');
    const jaLigados = new Set(etapa.postos.map((posto) => posto.id));
    if (postoIds.some((postoId) => !encontrados.get(postoId)!.ativo && !jaLigados.has(postoId))) {
      throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Posto inativo não pode ser adicionado à etapa.');
    }
    await this.roteiros.definirPostos(etapa.id, postoIds);
    return this.buscar(id);
  }

  async associarProduto(id: string, produtoId: unknown): Promise<RoteiroDetalhe> {
    const roteiro = await this.buscar(id);
    if (!ehIdentificadorValido(produtoId)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Selecione um produto válido.');
    if (!await this.roteiros.existeProduto(produtoId)) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Produto não encontrado.');
    if (roteiro.produtos.some((produto) => produto.id === produtoId)) throw new ErroDeRoteiro('CONFLITO', 'Este produto já está ligado a este roteiro.');
    await this.roteiros.associarProduto(id, produtoId);
    return this.buscar(id);
  }

  // A vigente é a versão usada por padrão nas próximas ordens do produto; só uma por produto.
  async definirVigente(id: string, produtoId: string): Promise<RoteiroDetalhe> {
    const roteiro = await this.buscar(id);
    if (produtoLigado(roteiro, produtoId).vigente) return roteiro;
    if (!roteiro.ativo) throw new ErroDeRoteiro('CONFLITO', 'Um roteiro inativo não pode ser o vigente. Ative-o antes.');
    await this.roteiros.definirVigente(id, produtoId);
    return this.buscar(id);
  }

  async removerProduto(id: string, produtoId: string): Promise<RoteiroDetalhe> {
    const roteiro = await this.buscar(id);
    if (produtoLigado(roteiro, produtoId).quantidadeOrdens > 0) {
      throw new ErroDeRoteiro('CONFLITO', 'Este produto tem ordens com esta versão do roteiro, por isso a ligação não pode ser removida.');
    }
    await this.roteiros.removerProduto(id, produtoId);
    return this.buscar(id);
  }

  async salvarTempos(id: string, produtoId: string, input: unknown): Promise<RoteiroDetalhe> {
    const roteiro = await this.buscar(id);
    const produto = produtoLigado(roteiro, produtoId);
    const tempos = validarTemposInformados(input);
    if (produto.travado) throw new ErroDeRoteiro('CONFLITO', MENSAGEM_TEMPOS_TRAVADOS);
    const etapas = new Set(roteiro.etapas.map((etapa) => etapa.id));
    if (tempos.some((tempo) => !etapas.has(tempo.etapaId))) throw new ErroDeRoteiro('ENTRADA_INVALIDA', 'Etapa não pertence a este roteiro.');
    await this.roteiros.salvarTempos(id, produtoId, tempos);
    return this.buscar(id);
  }

  // Copia as etapas, os postos, os produtos ligados (sem vigência) e os tempos padrão para a
  // próxima versão do mesmo nome; a versão de origem não muda.
  async criarVersao(id: string): Promise<RoteiroDetalhe> {
    await this.buscar(id);
    return this.buscar(await this.roteiros.criarVersao(id));
  }
}
