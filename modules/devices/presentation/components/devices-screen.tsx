'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PaginacaoTabela } from '@/shared/presentation/paginacao-tabela';
import { MenuAcoesRegistro } from '@/shared/presentation/menu-acoes-registro';
import { TabelaComRolagem } from '@/shared/presentation/tabela-com-rolagem';
import { usePaginacaoTabela } from '@/shared/presentation/use-paginacao-tabela';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink, KeyRound, LoaderCircle, Pencil, Plus, Power, PowerOff, Tv } from 'lucide-react';
import type { Dispositivo, DispositivoListado, SituacaoConexao } from '../../domain/dispositivo';
import { INTERVALO_ATUALIZACAO_MS, LIMITE_ONLINE_MS } from '../../domain/dispositivo';
import { definirStatusDispositivo, ErroApiDispositivos, listarDispositivos } from '../api-client';
import { listarSetores } from '../../../sectors/presentation/api-client';
import { DeviceFormDialog, type PedidoFormularioDispositivo } from './device-form-dialog';
import { DeviceCodeDialog, type PedidoCodigo } from './device-code-dialog';

const CONEXAO: Record<SituacaoConexao, { rotulo: string; classe: string }> = {
  ONLINE: { rotulo: 'Online', classe: 'border-success-fill/30 bg-success-fill/10 text-success' },
  OFFLINE: { rotulo: 'Offline', classe: 'border-danger-fill/30 bg-danger-fill/10 text-danger' },
  NUNCA_CONECTOU: { rotulo: 'Nunca conectou', classe: 'border-foreground/10 bg-foreground/5 text-muted' },
};
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });

export function DevicesScreen() {
  const router = useRouter();
  const [dispositivos, setDispositivos] = useState<DispositivoListado[]>([]);
  const paginacao = usePaginacaoTabela(dispositivos);
  const [setores, setSetores] = useState<{ id: string; nome: string; ativo: boolean }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [alterando, setAlterando] = useState<string | null>(null);
  const [pedidoForm, setPedidoForm] = useState<PedidoFormularioDispositivo | null>(null);
  const [pedidoCodigo, setPedidoCodigo] = useState<PedidoCodigo | null>(null);
  const formRef = useRef<HTMLDialogElement>(null);
  const codigoRef = useRef<HTMLDialogElement>(null);
  const origemFoco = useRef<HTMLButtonElement | null>(null);

  const sairSeSemAcesso = useCallback((falha: unknown) => {
    if (falha instanceof ErroApiDispositivos && (falha.status === 401 || falha.status === 403)) { router.replace('/login'); router.refresh(); return true; }
    return false;
  }, [router]);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    try {
      const lista = await listarDispositivos(signal);
      if (signal?.aborted) return;
      setDispositivos(lista);
      setErro('');
    } catch (falha) {
      if (signal?.aborted || sairSeSemAcesso(falha)) return;
      setErro(falha instanceof ErroApiDispositivos ? falha.message : 'Não foi possível carregar as TVs. Verifique sua conexão e tente novamente.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, [sairSeSemAcesso]);

  // A lista se atualiza sozinha, para a situação online/offline acompanhar as TVs.
  useEffect(() => {
    const controller = new AbortController();
    const primeira = setTimeout(() => void carregar(controller.signal), 0);
    const id = setInterval(() => { if (!document.hidden) void carregar(controller.signal); }, INTERVALO_ATUALIZACAO_MS);
    listarSetores(controller.signal).then((lista) => setSetores(lista.map((s) => ({ id: s.id, nome: s.nome, ativo: s.ativo })))).catch(() => {});
    return () => { clearTimeout(primeira); clearInterval(id); controller.abort(); };
  }, [carregar]);

  function abrirFormulario(dispositivo: Dispositivo | null, botao: HTMLButtonElement) {
    if (formRef.current?.open) return;
    origemFoco.current = botao;
    setPedidoForm((atual) => ({ dispositivo, seq: (atual?.seq ?? 0) + 1 }));
  }

  function pedirNovoCodigo(dispositivo: Dispositivo, botao: HTMLButtonElement) {
    if (codigoRef.current?.open) return;
    origemFoco.current = botao;
    setPedidoCodigo((atual) => ({ modo: 'confirmar', dispositivo, seq: (atual?.seq ?? 0) + 1 }));
  }

  function mostrarCodigo(resultado: { dispositivo: Dispositivo; codigo: string }, texto: string) {
    setMensagem(texto);
    setPedidoCodigo((atual) => ({ modo: 'exibir', ...resultado, seq: (atual?.seq ?? 0) + 1 }));
    void carregar();
  }

  async function alternarStatus(dispositivo: Dispositivo) {
    if (alterando) return;
    setAlterando(dispositivo.id);
    setMensagem('');
    try {
      await definirStatusDispositivo(dispositivo.id, !dispositivo.ativo);
      setMensagem(dispositivo.ativo ? 'TV desativada. Ela perde o acesso na próxima atualização.' : 'TV reativada.');
      await carregar();
    } catch (falha) {
      if (!sairSeSemAcesso(falha)) setErro(falha instanceof ErroApiDispositivos ? falha.message : 'Não foi possível alterar a TV. Verifique sua conexão e tente novamente.');
    } finally {
      setAlterando(null);
    }
  }

  return (
    <div className="pagina-com-tabela mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">TVs</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            TVs do chão de fábrica com o painel de gestão à vista. Cada TV é liberada pelo próprio código, mostra em tempo real a situação dos postos do setor, a produção do dia e a carga pendente, e informa ao sistema que está ligada.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <a href="/tv" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <ExternalLink aria-hidden="true" size={18} />Abrir a tela da TV<span className="sr-only"> (abre em uma nova aba)</span>
          </a>
          <button type="button" aria-haspopup="dialog" aria-controls="formulario-dispositivo" onClick={(event) => abrirFormulario(null, event.currentTarget)}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar TV
          </button>
        </div>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-md border border-success-fill/25 bg-success-fill/5 p-4 text-sm leading-6 text-success"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}
      {erro && <p role="alert" className="mt-6 flex items-start gap-2 rounded-md border border-danger-fill/25 bg-danger-fill/5 p-4 text-sm leading-6 text-danger"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}

      <section aria-label="TVs cadastradas" aria-busy={carregando} className="listagem-com-rolagem mt-7 min-w-0 rounded-lg border border-line-soft bg-surface">
        <p className="border-b border-foreground/10 px-5 py-3 text-xs text-muted">Online: a TV conectou nos últimos {LIMITE_ONLINE_MS / 1000} segundos. A lista atualiza sozinha a cada {INTERVALO_ATUALIZACAO_MS / 1000} s.</p>
        {carregando && dispositivos.length === 0 ? (
          <p role="status" className="flex min-h-40 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} className="motion-safe:animate-spin" />Carregando TVs…</p>
        ) : (
          <TabelaComRolagem legenda="TVs cadastradas" chaveRolagem={paginacao.chaveRolagem}>
            <table className="tabela-com-acoes tabular-nums w-full text-left text-sm">
              <caption className="sr-only">TVs cadastradas, com a situação da conexão</caption>
              <thead className="border-b border-foreground/10 bg-foreground/[0.025] text-muted"><tr>
                <th scope="col" className="coluna-action font-medium">Action</th>
                {['TV', 'Setor exibido', 'Conexão', 'Última conexão', 'Status'].map((t) => <th key={t} scope="col" className="px-3 py-3 font-medium">{t}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-foreground/5">
                {paginacao.itens.map((d) => (
                  <tr key={d.id} className="hover:bg-foreground/[0.025]">
                    <td className="coluna-action">
                      <MenuAcoesRegistro key={paginacao.chaveRolagem} registro={d.nome} acoes={[
                        { rotulo: 'Editar', icone: Pencil, executar: (botao) => abrirFormulario(d, botao) },
                        { rotulo: 'Novo código', icone: KeyRound, executar: (botao) => pedirNovoCodigo(d, botao) },
                        { rotulo: d.ativo ? 'Desativar' : 'Ativar', icone: d.ativo ? PowerOff : Power, indisponivel: alterando !== null, motivo: 'Aguarde a alteração em andamento.', executar: () => { void alternarStatus(d); } },
                      ]} />
                    </td>
                    <td className="px-3 py-3"><p className="font-medium [overflow-wrap:anywhere]">{d.nome}</p>{d.local && <p className="text-xs text-muted [overflow-wrap:anywhere]">{d.local}</p>}</td>
                    <td className="px-3 py-3 text-subtle">{d.setor?.nome ?? 'Todos os setores'}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${d.ativo ? CONEXAO[d.conexao].classe : CONEXAO.NUNCA_CONECTOU.classe}`}>{d.ativo ? CONEXAO[d.conexao].rotulo : 'Desativada'}</span></td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted">{d.ultimaConexaoEm ? <time dateTime={d.ultimaConexaoEm}>{DATA_HORA.format(new Date(d.ultimaConexaoEm))}</time> : '—'}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${d.ativo ? 'border-success-fill/20 bg-success-fill/10 text-success' : 'border-foreground/10 bg-foreground/5 text-muted'}`}>{d.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  </tr>
                ))}
                {dispositivos.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted"><Tv aria-hidden="true" size={28} className="mx-auto mb-3" />Nenhuma TV cadastrada. Use Adicionar TV para gerar o código de acesso.</td></tr>}
              </tbody>
            </table>
          </TabelaComRolagem>
        )}
        {dispositivos.length > 0 && <PaginacaoTabela legenda="TVs cadastradas" paginacao={paginacao} />}
      </section>

      <DeviceFormDialog dialogRef={formRef} pedido={pedidoForm} setores={setores}
        aoCadastrar={(resultado) => mostrarCodigo(resultado, 'TV cadastrada. Digite o código na TV para liberá-la.')}
        aoAlterar={() => { setMensagem('TV alterada com sucesso.'); void carregar(); }}
        aoFechar={() => origemFoco.current?.focus()} />
      <DeviceCodeDialog dialogRef={codigoRef} pedido={pedidoCodigo}
        aoGerar={(resultado) => mostrarCodigo(resultado, 'Código novo gerado. A TV precisa receber este código para voltar a funcionar.')}
        aoFechar={() => origemFoco.current?.focus()} />
    </div>
  );
}
