import {
  ehIdentificadorValido, ErroDeRoteiro, validarEtapasInformadas, validarNomeRoteiro, validarPostosInformados,
  type OperacaoDoRoteiro, type RoteiroDetalhe, type RoteiroResumo,
} from '../domain/roteiro.ts';
import type { RoteiroRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDeRoteiro('NAO_ENCONTRADO', 'Roteiro não encontrado.');

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

  // Copia as etapas e os postos para a próxima versão do mesmo nome; a versão de origem não muda.
  async criarVersao(id: string): Promise<RoteiroDetalhe> {
    await this.buscar(id);
    return this.buscar(await this.roteiros.criarVersao(id));
  }
}
