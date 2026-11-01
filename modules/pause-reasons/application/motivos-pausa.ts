import {
  ehIdentificadorValido, ErroDeMotivoPausa, validarAlteracaoMotivoPausa, validarCadastroMotivoPausa,
  type AlteracaoMotivoPausa, type CadastroMotivoPausa, type MotivoPausa,
} from '../domain/motivoPausa.ts';
import type { MotivoPausaRepository } from './contracts.ts';

const naoEncontrada = () => new ErroDeMotivoPausa('NAO_ENCONTRADO', 'Motivo de pausa não encontrado.');

export class MotivosPausaService {
  private readonly motivosPausa: MotivoPausaRepository;

  constructor(motivosPausa: MotivoPausaRepository) {
    this.motivosPausa = motivosPausa;
  }

  async listar(): Promise<MotivoPausa[]> {
    return this.motivosPausa.listar();
  }

  async criar(input: CadastroMotivoPausa): Promise<MotivoPausa> {
    const dados = validarCadastroMotivoPausa(input);
    if (await this.motivosPausa.buscarPorNome(dados.nome)) {
      throw new ErroDeMotivoPausa('CONFLITO', 'Nome de motivo de pausa já cadastrado.');
    }
    return this.motivosPausa.criar(dados);
  }

  async alterar(id: string, input: AlteracaoMotivoPausa): Promise<MotivoPausa> {
    if (!ehIdentificadorValido(id)) throw naoEncontrada();
    const dados = validarAlteracaoMotivoPausa(input);
    if (!await this.motivosPausa.buscarPorId(id)) throw naoEncontrada();
    if (dados.nome !== undefined) {
      const outra = await this.motivosPausa.buscarPorNome(dados.nome);
      if (outra && outra.id !== id) throw new ErroDeMotivoPausa('CONFLITO', 'Nome de motivo de pausa já cadastrado.');
    }
    const alterada = await this.motivosPausa.alterar(id, dados);
    if (!alterada) throw naoEncontrada();
    return alterada;
  }

  // Inativo sai da lista de motivos da ilha, mas continua nas pausas que já o usam.
  async definirStatus(id: string, ativo: boolean): Promise<MotivoPausa> {
    if (!ehIdentificadorValido(id)) throw naoEncontrada();
    if (typeof ativo !== 'boolean') throw new ErroDeMotivoPausa('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const alterada = await this.motivosPausa.definirAtivo(id, ativo);
    if (!alterada) throw naoEncontrada();
    return alterada;
  }
}
