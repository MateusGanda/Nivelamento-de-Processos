import { ErroDeSetor, validarCadastroSetor, type CadastroSetor, type Setor } from '../domain/setor.ts';
import type { SetorRepository } from './contracts.ts';

export class SetoresService {
  private readonly setores: SetorRepository;

  constructor(setores: SetorRepository) {
    this.setores = setores;
  }

  async listar(): Promise<Setor[]> {
    return this.setores.listar();
  }

  async criar(input: CadastroSetor): Promise<Setor> {
    const dados = validarCadastroSetor(input);
    if (await this.setores.buscarPorNome(dados.nome)) {
      throw new ErroDeSetor('CONFLITO', 'Nome de setor já cadastrado.');
    }
    return this.setores.criar(dados);
  }
}
