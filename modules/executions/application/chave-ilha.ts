// Chave do terminal da ilha. Vale a última chave gerada pelo painel; enquanto nenhuma for gerada,
// vale a variável ILHA_CHAVE do servidor (transição sem derrubar os terminais já liberados).

export type OrigemChave = 'PAINEL' | 'AMBIENTE';

export type ChaveIlha = {
  configurada: boolean;
  origem: OrigemChave | null;
  // Valor guardado no cookie do terminal: deriva da chave em uso, então trocar a chave bloqueia todos.
  credencial(): string;
  confere(chaveInformada: string): boolean;
  credencialValida(valor: string | undefined): boolean;
};

export type RegistroChaveIlha = { criadaEm: string; criadaPor: { nome: string } };

export interface ChaveIlhaRepository {
  /** A chave mais recente gerada pelo painel, ou null se nenhuma foi gerada. */
  atual(): Promise<(RegistroChaveIlha & { chaveHash: string }) | null>;
  registrar(chaveHash: string, usuarioId: string): Promise<RegistroChaveIlha>;
}

export type FabricaChaveIlha = {
  doAmbiente(): ChaveIlha;
  doPainel(chaveHash: string): ChaveIlha;
  /** Gera uma chave nova e o resumo que vai para o banco. */
  gerar(): { chave: string; chaveHash: string };
};

export type SituacaoChaveIlha = {
  origem: OrigemChave | 'NENHUMA';
  trocadaEm: string | null;
  trocadaPor: string | null;
};

export class ChaveIlhaService {
  private readonly repositorio: ChaveIlhaRepository;
  private readonly fabrica: FabricaChaveIlha;

  constructor(repositorio: ChaveIlhaRepository, fabrica: FabricaChaveIlha) {
    this.repositorio = repositorio;
    this.fabrica = fabrica;
  }

  async atual(): Promise<ChaveIlha> {
    const registro = await this.repositorio.atual();
    return registro ? this.fabrica.doPainel(registro.chaveHash) : this.fabrica.doAmbiente();
  }

  async situacao(): Promise<SituacaoChaveIlha> {
    const registro = await this.repositorio.atual();
    if (registro) return { origem: 'PAINEL', trocadaEm: registro.criadaEm, trocadaPor: registro.criadaPor.nome };
    return { origem: this.fabrica.doAmbiente().configurada ? 'AMBIENTE' : 'NENHUMA', trocadaEm: null, trocadaPor: null };
  }

  /** Gera e grava uma chave nova. A chave só é devolvida aqui: o banco guarda apenas o resumo. */
  async gerarNova(usuarioId: string): Promise<{ chave: string; situacao: SituacaoChaveIlha }> {
    const { chave, chaveHash } = this.fabrica.gerar();
    const registro = await this.repositorio.registrar(chaveHash, usuarioId);
    return { chave, situacao: { origem: 'PAINEL', trocadaEm: registro.criadaEm, trocadaPor: registro.criadaPor.nome } };
  }
}
