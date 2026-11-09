import {
  ehIdentificadorValido, ErroDeDispositivo, INTERVALO_MINIMO_REGISTRO_MS, normalizarCodigo, situacaoConexao,
  validarAlteracaoDispositivo, validarCadastroDispositivo,
  type AlteracaoDispositivo, type CadastroDispositivo, type Dispositivo, type DispositivoListado,
} from '../domain/dispositivo.ts';
import type { CodigosDeAcesso, DispositivoRepository } from './contracts.ts';

const naoEncontrado = () => new ErroDeDispositivo('NAO_ENCONTRADO', 'TV não encontrada.');
const nomeRepetido = () => new ErroDeDispositivo('CONFLITO', 'Já existe uma TV com esse nome.');

/** O código só é devolvido no momento em que é gerado; depois disso o sistema guarda apenas o resumo. */
export type DispositivoComCodigo = { dispositivo: Dispositivo; codigo: string };

export class DispositivosService {
  private readonly dispositivos: DispositivoRepository;
  private readonly codigos: CodigosDeAcesso;
  private readonly agora: () => Date;

  constructor(dispositivos: DispositivoRepository, codigos: CodigosDeAcesso, agora: () => Date = () => new Date()) {
    this.dispositivos = dispositivos;
    this.codigos = codigos;
    this.agora = agora;
  }

  async listar(): Promise<DispositivoListado[]> {
    const agoraMs = this.agora().getTime();
    return (await this.dispositivos.listar()).map((d) => ({ ...d, conexao: situacaoConexao(d.ultimaConexaoEm, agoraMs) }));
  }

  async criar(input: CadastroDispositivo): Promise<DispositivoComCodigo> {
    const dados = validarCadastroDispositivo(input);
    if (await this.dispositivos.buscarPorNome(dados.nome)) throw nomeRepetido();
    if (dados.setorId && !await this.dispositivos.setorExiste(dados.setorId)) throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Setor não encontrado.');
    const codigo = this.codigos.gerar();
    return { dispositivo: await this.dispositivos.criar(dados, this.resumo(codigo)), codigo };
  }

  async alterar(id: string, input: AlteracaoDispositivo): Promise<Dispositivo> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const dados = validarAlteracaoDispositivo(input);
    if (!await this.dispositivos.buscarPorId(id)) throw naoEncontrado();
    if (dados.nome !== undefined) {
      const outro = await this.dispositivos.buscarPorNome(dados.nome);
      if (outro && outro.id !== id) throw nomeRepetido();
    }
    if (dados.setorId && !await this.dispositivos.setorExiste(dados.setorId)) throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'Setor não encontrado.');
    const alterado = await this.dispositivos.alterar(id, dados);
    if (!alterado) throw naoEncontrado();
    return alterado;
  }

  // TV inativa perde o acesso na próxima atualização.
  async definirStatus(id: string, ativo: boolean): Promise<Dispositivo> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    if (typeof ativo !== 'boolean') throw new ErroDeDispositivo('ENTRADA_INVALIDA', 'ativo deve ser verdadeiro ou falso.');
    const alterado = await this.dispositivos.definirAtivo(id, ativo);
    if (!alterado) throw naoEncontrado();
    return alterado;
  }

  // O código anterior deixa de valer na hora: a TV precisa receber o novo.
  async gerarNovoCodigo(id: string): Promise<DispositivoComCodigo> {
    if (!ehIdentificadorValido(id)) throw naoEncontrado();
    const codigo = this.codigos.gerar();
    const dispositivo = await this.dispositivos.trocarCodigo(id, this.resumo(codigo));
    if (!dispositivo) throw naoEncontrado();
    return { dispositivo, codigo };
  }

  /** Liberação da TV pelo código. Código errado, de TV inexistente ou inativa: a mesma resposta. */
  async autenticarCodigo(informado: unknown): Promise<Dispositivo> {
    const dispositivo = await this.identificar(informado);
    if (!dispositivo) throw new ErroDeDispositivo('NAO_AUTENTICADO', 'Código inválido ou TV desativada.');
    return dispositivo;
  }

  /** TV ativa dona do código (guardado no cookie), ou null. */
  async identificar(codigo: unknown): Promise<Dispositivo | null> {
    const normalizado = normalizarCodigo(codigo);
    if (!normalizado) return null;
    const dispositivo = await this.dispositivos.buscarPorCodigoHash(this.codigos.resumo(normalizado));
    return dispositivo?.ativo ? dispositivo : null;
  }

  /**
   * Telemetria: a TV informa que está ligada. `dispositivo` vem da leitura feita no mesmo pedido; se a última
   * conexão gravada tem menos de 10 s, não grava de novo, para não escrever no banco a cada atualização.
   */
  async registrarConexao(dispositivo: Dispositivo): Promise<void> {
    const agoraMs = this.agora().getTime();
    if (dispositivo.ultimaConexaoEm && agoraMs - Date.parse(dispositivo.ultimaConexaoEm) < INTERVALO_MINIMO_REGISTRO_MS) return;
    await this.dispositivos.registrarConexao(dispositivo.id, new Date(agoraMs).toISOString());
  }

  private resumo(codigo: string): string {
    const normalizado = normalizarCodigo(codigo);
    if (!normalizado) throw new Error('Código gerado fora do formato.');
    return this.codigos.resumo(normalizado);
  }
}
