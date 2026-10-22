import { gerarCodigoSetor } from '../domain/codigo-setor.ts';
import { ehIdentificadorValido, ErroCodigoSetorReservado, ErroDeSetor, validarCadastroSetor, type CadastroSetor, type Setor } from '../domain/setor.ts';
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
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = gerarCodigoSetor(dados.nome, await this.setores.codigosReservados());
      try { return await this.setores.criar({ ...dados, codigo }); }
      catch (erro) { if (!(erro instanceof ErroCodigoSetorReservado)) throw erro; }
    }
    throw new ErroCodigoSetorReservado();
  }

  // Inativo sai da escolha de setor para postos e operadores novos; quem já está nele continua.
  async definirStatus(id: string, ativo: boolean): Promise<Setor> {
    const naoEncontrado = () => new ErroDeSetor('NAO_ENCONTRADO', 'Setor não encontrado.');
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    if (typeof ativo !== 'boolean') throw new ErroDeSetor('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const alterado = await this.setores.definirAtivo(id, ativo);
    if (!alterado) throw naoEncontrado();
    return alterado;
  }
}
