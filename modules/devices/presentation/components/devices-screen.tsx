'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink, KeyRound, LoaderCircle, Pencil, Plus, Power, PowerOff, Tv } from 'lucide-react';
import type { Dispositivo, DispositivoListado, SituacaoConexao } from '../../domain/dispositivo';
import { INTERVALO_ATUALIZACAO_MS, LIMITE_ONLINE_MS } from '../../domain/dispositivo';
import { definirStatusDispositivo, ErroApiDispositivos, listarDispositivos } from '../api-client';
import { listarSetores } from '../../../sectors/presentation/api-client';
import { DeviceFormDialog, type PedidoFormularioDispositivo } from './device-form-dialog';
import { DeviceCodeDialog, type PedidoCodigo } from './device-code-dialog';

const CONEXAO: Record<SituacaoConexao, { rotulo: string; classe: string }> = {
  ONLINE: { rotulo: 'Online', classe: 'border-[#7bcba5]/30 bg-[#7bcba5]/10 text-[#a6dfbf]' },
  OFFLINE: { rotulo: 'Offline', classe: 'border-[#f49a8a]/30 bg-[#f49a8a]/10 text-[#ffb4a5]' },
  NUNCA_CONECTOU: { rotulo: 'Nunca conectou', classe: 'border-white/10 bg-white/5 text-muted' },
};
const DATA_HORA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' });
const botaoAcao = 'inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#3b454e] px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-wait aria-disabled:opacity-60';

export function DevicesScreen() {
  const router = useRouter();
  const [dispositivos, setDispositivos] = useState<DispositivoListado[]>([]);
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
    <div className="mx-auto w-full min-w-0 max-w-[1440px]">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">TVs</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            TVs do chão de fábrica com o painel de gestão à vista. Cada TV é liberada pelo próprio código, mostra em tempo real a situação dos postos do setor, a produção do dia e a carga pendente, e informa ao sistema que está ligada.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <a href="/tv" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#3b454e] px-4 py-2 text-sm font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <ExternalLink aria-hidden="true" size={18} />Abrir a tela da TV<span className="sr-only"> (abre em uma nova aba)</span>
          </a>
          <button type="button" aria-haspopup="dialog" aria-controls="formulario-dispositivo" onClick={(event) => abrirFormulario(null, event.currentTarget)}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#171b1f] hover:bg-[#ff8d40] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
            <Plus aria-hidden="true" size={20} strokeWidth={2} />Adicionar TV
          </button>
        </div>
      </header>

      {mensagem && <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-[#7bcba5]/25 bg-[#7bcba5]/5 p-4 text-sm leading-6 text-[#a6dfbf]"><CheckCircle2 aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{mensagem}</p>}
      {erro && <p role="alert" className="mt-6 flex items-start gap-2 rounded-lg border border-[#f49a8a]/25 bg-[#f49a8a]/5 p-4 text-sm leading-6 text-[#ffb4a5]"><AlertCircle aria-hidden="true" size={20} strokeWidth={2} className="mt-0.5 shrink-0" />{erro}</p>}

      <section aria-label="TVs cadastradas" aria-busy={carregando} className="mt-7 min-w-0 rounded-xl border border-[#2b353e] bg-[#192128]/65">
        <p className="border-b border-white/10 px-5 py-3 text-xs text-muted">Online: a TV conectou nos últimos {LIMITE_ONLINE_MS / 1000} segundos. A lista atualiza sozinha a cada {INTERVALO_ATUALIZACAO_MS / 1000} s.</p>
        {carregando && dispositivos.length === 0 ? (
          <p role="status" className="flex min-h-40 items-center justify-center gap-3 p-6 text-sm text-muted"><LoaderCircle aria-hidden="true" size={22} className="motion-safe:animate-spin" />Carregando TVs…</p>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-b-xl">
            <table className="w-full min-w-[900px] text-left text-sm">
              <caption className="sr-only">TVs cadastradas, com a situação da conexão</caption>
              <thead className="border-b border-white/10 bg-white/[0.025] text-muted"><tr>
                {['TV', 'Setor exibido', 'Conexão', 'Última conexão', 'Status'].map((t) => <th key={t} scope="col" className="px-5 py-3 font-medium">{t}</th>)}
                <th scope="col" className="px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {dispositivos.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.025]">
                    <td className="px-5 py-4"><p className="font-medium [overflow-wrap:anywhere]">{d.nome}</p>{d.local && <p className="text-xs text-muted [overflow-wrap:anywhere]">{d.local}</p>}</td>
                    <td className="px-5 py-4 text-[#c1c8cf]">{d.setor?.nome ?? 'Todos os setores'}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${d.ativo ? CONEXAO[d.conexao].classe : CONEXAO.NUNCA_CONECTOU.classe}`}>{d.ativo ? CONEXAO[d.conexao].rotulo : 'Desativada'}</span></td>
                    <td className="px-5 py-4 whitespace-nowrap text-muted">{d.ultimaConexaoEm ? <time dateTime={d.ultimaConexaoEm}>{DATA_HORA.format(new Date(d.ultimaConexaoEm))}</time> : '—'}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${d.ativo ? 'border-[#7bcba5]/20 bg-[#7bcba5]/10 text-[#a6dfbf]' : 'border-white/10 bg-white/5 text-muted'}`}>{d.ativo ? 'Ativa' : 'Inativa'}</span></td>
                    <td className="space-x-2 px-5 py-3 text-right whitespace-nowrap">
                      <button type="button" aria-haspopup="dialog" aria-controls="formulario-dispositivo" aria-label={`Editar ${d.nome}`} onClick={(e) => abrirFormulario(d, e.currentTarget)} className={botaoAcao}><Pencil aria-hidden="true" size={16} />Editar</button>
                      <button type="button" aria-haspopup="dialog" aria-controls="codigo-dispositivo" aria-label={`Gerar novo código para ${d.nome}`} onClick={(e) => pedirNovoCodigo(d, e.currentTarget)} className={botaoAcao}><KeyRound aria-hidden="true" size={16} />Novo código</button>
                      <button type="button" aria-label={`${d.ativo ? 'Desativar' : 'Ativar'} ${d.nome}`} aria-disabled={alterando !== null} onClick={() => void alternarStatus(d)} className={`${botaoAcao} w-32 justify-center`}>
                        {alterando === d.id ? <LoaderCircle aria-hidden="true" size={16} className="motion-safe:animate-spin" /> : d.ativo ? <PowerOff aria-hidden="true" size={16} /> : <Power aria-hidden="true" size={16} />}{d.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {dispositivos.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted"><Tv aria-hidden="true" size={28} className="mx-auto mb-3" />Nenhuma TV cadastrada. Use Adicionar TV para gerar o código de acesso.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
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
