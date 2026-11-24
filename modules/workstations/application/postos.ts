import { gerarCodigoPosto } from '../domain/codigo-posto.ts';
import {
  ehIdentificadorValido, ErroCodigoPostoReservado, ErroDePosto, validarAlteracaoPosto, validarCadastroPosto,
  type AlteracaoPosto, type CadastroPosto, type Posto,
} from '../domain/posto.ts';
import type { PostoRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDePosto('NAO_ENCONTRADO', 'Posto não encontrado.');

export class PostosService {
  private readonly postos: PostoRepository;

  constructor(postos: PostoRepository) {
    this.postos = postos;
  }

  async listar(): Promise<Posto[]> {
    return this.postos.listar();
  }

  async criar(input: CadastroPosto): Promise<Posto> {
    const dados = validarCadastroPosto(input);
    const setor = await this.postos.buscarSetor(dados.setorId);
    if (!setor) throw new ErroDePosto('ENTRADA_INVALIDA', 'Setor não encontrado.');
    if (!setor.ativo) throw new ErroDePosto('ENTRADA_INVALIDA', 'Setor inativo não pode receber postos novos.');
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = gerarCodigoPosto(await this.postos.codigosReservados());
      try { return await this.postos.criar({ ...dados, codigo }); }
      catch (erro) { if (!(erro instanceof ErroCodigoPostoReservado)) throw erro; }
    }
    throw new ErroCodigoPostoReservado();
  }

  async alterar(id: string, input: AlteracaoPosto): Promise<Posto> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoPosto(input);
    const atual = await this.postos.buscarPorId(id);
    if (!atual) throw naoEncontrado();
    // Manter o setor atual é sempre permitido; trocar só para um setor ativo.
    if (dados.setorId !== undefined && dados.setorId !== atual.setor.id) {
      const setor = await this.postos.buscarSetor(dados.setorId);
      if (!setor) throw new ErroDePosto('ENTRADA_INVALIDA', 'Setor não encontrado.');
      if (!setor.ativo) throw new ErroDePosto('ENTRADA_INVALIDA', 'Setor inativo não pode receber postos.');
    }
    const alterado = await this.postos.alterar(id, dados);
    // O posto pode ter sido removido entre a consulta e a gravação.
    if (!alterado) throw naoEncontrado();
    return alterado;
  }

  async definirStatus(id: string, ativo: boolean): Promise<Posto> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    if (typeof ativo !== 'boolean') throw new ErroDePosto('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const alterado = await this.postos.definirAtivo(id, ativo);
    if (!alterado) throw naoEncontrado();
    return alterado;
  }
}
