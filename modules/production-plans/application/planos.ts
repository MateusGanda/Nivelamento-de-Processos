import {
  ehIdentificadorValido, ErroDePlano, validarAlteracaoPlano, validarCadastroPlano, validarPeriodo,
  type AlteracaoPlano, type CadastroPlano, type Plano,
} from '../domain/plano.ts';
import type { PlanoRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDePlano('NAO_ENCONTRADO', 'Plano de produção não encontrado.');
const codigoRepetido = () => new ErroDePlano('CONFLITO', 'Código de plano já cadastrado.');

export class PlanosService {
  private readonly planos: PlanoRepository;

  constructor(planos: PlanoRepository) {
    this.planos = planos;
  }

  async listar(): Promise<Plano[]> {
    return this.planos.listar();
  }

  async criar(input: CadastroPlano): Promise<Plano> {
    const dados = validarCadastroPlano(input);
    if (await this.planos.buscarPorCodigo(dados.codigo)) throw codigoRepetido();
    return this.planos.criar(dados);
  }

  async alterar(id: string, input: AlteracaoPlano): Promise<Plano> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoPlano(input);
    const atual = await this.planos.buscarPorId(id);
    if (!atual) throw naoEncontrado();
    // Quando só uma das datas muda, o período é conferido com a outra já gravada.
    validarPeriodo(dados.dataInicio !== undefined ? dados.dataInicio : atual.dataInicio, dados.dataFim !== undefined ? dados.dataFim : atual.dataFim);
    if (dados.codigo !== undefined) {
      const outro = await this.planos.buscarPorCodigo(dados.codigo);
      if (outro && outro.id !== id) throw codigoRepetido();
    }
    const alterado = await this.planos.alterar(id, dados);
    // O plano pode ter sido removido entre a consulta e a gravação.
    if (!alterado) throw naoEncontrado();
    return alterado;
  }
}
