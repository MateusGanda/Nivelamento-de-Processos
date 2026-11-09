import type { AlteracaoDispositivo, DadosDispositivo, Dispositivo } from '../domain/dispositivo.ts';

export type PostoDoPainel = { id: string; codigo: string; nome: string; setor: { id: string; nome: string } };

export interface DispositivoRepository {
  listar(): Promise<Dispositivo[]>;
  buscarPorId(id: string): Promise<Dispositivo | null>;
  buscarPorNome(nome: string): Promise<Dispositivo | null>;
  buscarPorCodigoHash(codigoHash: string): Promise<Dispositivo | null>;
  setorExiste(id: string): Promise<boolean>;
  criar(dados: DadosDispositivo, codigoHash: string): Promise<Dispositivo>;
  alterar(id: string, dados: AlteracaoDispositivo): Promise<Dispositivo | null>;
  definirAtivo(id: string, ativo: boolean): Promise<Dispositivo | null>;
  trocarCodigo(id: string, codigoHash: string): Promise<Dispositivo | null>;
  /** Grava o instante da última conexão (telemetria da TV). */
  registrarConexao(id: string, agora: string): Promise<void>;
  /** Postos ativos com o setor, para os quadros da TV. */
  listarPostosAtivos(): Promise<PostoDoPainel[]>;
}

/** Gera o código de acesso e o resumo (hash) guardado no banco. Fica na infraestrutura (usa criptografia). */
export type CodigosDeAcesso = { gerar(): string; resumo(codigoNormalizado: string): string };
