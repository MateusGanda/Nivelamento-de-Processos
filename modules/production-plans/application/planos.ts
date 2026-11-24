import { gerarCodigoPlano } from '../domain/codigo-plano.ts';
import {
  ehIdentificadorValido, ErroCodigoPlanoReservado, ErroDePlano, validarAlteracaoPlano, validarCadastroPlano, validarPeriodo,
  type AlteracaoPlano, type CadastroPlano, type Plano,
} from '../domain/plano.ts';
import type { PlanoRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDePlano('NAO_ENCONTRADO', 'Plano de produção não encontrado.');

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
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = gerarCodigoPlano(await this.planos.codigosReservados());
      try { return await this.planos.criar({ ...dados, codigo }); }
      catch (erro) { if (!(erro instanceof ErroCodigoPlanoReservado)) throw erro; }
    }
    throw new ErroCodigoPlanoReservado();
  }

  async alterar(id: string, input: AlteracaoPlano): Promise<Plano> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoPlano(input);
    const atual = await this.planos.buscarPorId(id);
    if (!atual) throw naoEncontrado();
    // Quando só uma das datas muda, o período é conferido com a outra já gravada.
    validarPeriodo(dados.dataInicio !== undefined ? dados.dataInicio : atual.dataInicio, dados.dataFim !== undefined ? dados.dataFim : atual.dataFim);
    const alterado = await this.planos.alterar(id, dados);
    // O plano pode ter sido removido entre a consulta e a gravação.
    if (!alterado) throw naoEncontrado();
    return alterado;
  }
}
