import { ErroDePosto, validarCadastroPosto, type CadastroPosto, type Posto } from '../domain/posto.ts';
import type { PostoRepository } from './contracts.ts';

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
    if (!await this.postos.buscarSetor(dados.setorId)) {
      throw new ErroDePosto('ENTRADA_INVALIDA', 'Setor não encontrado.');
    }
    if (await this.postos.buscarPorCodigo(dados.codigo)) {
      throw new ErroDePosto('CONFLITO', 'Código de posto já cadastrado.');
    }
    return this.postos.criar(dados);
  }
}
