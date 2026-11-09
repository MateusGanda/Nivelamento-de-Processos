import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ChaveIlha } from '../application/chave-ilha.ts';

export type { ChaveIlha } from '../application/chave-ilha.ts';

// Chaves curtas são fáceis de adivinhar; abaixo disso a ilha fica desativada.
export const TAMANHO_MINIMO_CHAVE = 16;

const assinar = (chave: string, texto: string) => createHmac('sha256', chave).update(texto).digest();

function iguais(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- chave da variável ILHA_CHAVE (como era antes do painel) ----------
export function criarChaveIlha(chave: string | undefined): ChaveIlha {
  const configurada = typeof chave === 'string' && chave.length >= TAMANHO_MINIMO_CHAVE;
  const credencial = () => {
    if (!configurada) throw new Error('Chave da ilha não configurada.');
    return assinar(chave, 'gunp-ilha-v1').toString('base64url');
  };
  return {
    configurada,
    origem: configurada ? 'AMBIENTE' : null,
    credencial,
    // Compara as assinaturas, de mesmo tamanho, em tempo constante.
    confere: (chaveInformada) => configurada && iguais(assinar('gunp-ilha-conferencia', chaveInformada), assinar('gunp-ilha-conferencia', chave)),
    credencialValida: (valor) => configurada && typeof valor === 'string' && iguais(Buffer.from(valor), Buffer.from(credencial())),
  };
}

// ---------- chave gerada pelo painel ----------
// 20 caracteres sem letras nem números que se confundem (I, O, 0, 1), em quatro blocos: cerca de 100 bits aleatórios.
export const ALFABETO_CHAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TAMANHO_CHAVE_PAINEL = 20;

/** Monta a chave a partir de bytes aleatórios, como "ABCDE-FGH23-JKLMN-PQRS4". */
export function formatarChavePainel(bytes: Uint8Array): string {
  if (bytes.length < TAMANHO_CHAVE_PAINEL) throw new Error('Bytes insuficientes para a chave.');
  // 256 é múltiplo de 32: o resto da divisão não favorece nenhum caractere.
  const letras = Array.from(bytes.slice(0, TAMANHO_CHAVE_PAINEL), (b) => ALFABETO_CHAVE[b % ALFABETO_CHAVE.length]).join('');
  return letras.match(/.{5}/g)!.join('-');
}

export const gerarChavePainel = () => formatarChavePainel(randomBytes(TAMANHO_CHAVE_PAINEL));

/** Aceita a chave com ou sem hífen, espaços e letras minúsculas; devolve null se não tiver o formato. */
export function normalizarChavePainel(informada: unknown): string | null {
  if (typeof informada !== 'string') return null;
  const limpa = informada.toUpperCase().replace(/[\s-]/g, '');
  if (limpa.length !== TAMANHO_CHAVE_PAINEL || [...limpa].some((c) => !ALFABETO_CHAVE.includes(c))) return null;
  return limpa;
}

// A chave é aleatória e longa, então um SHA-256 basta como resumo: com o banco em mãos não dá para recuperá-la.
export const resumoChavePainel = (normalizada: string) => createHash('sha256').update(`gunp-ilha-v2:${normalizada}`).digest('hex');

/**
 * Chave em uso vinda do banco. O cookie do terminal é assinado com o segredo do servidor (NEXTAUTH_SECRET)
 * sobre o resumo: quem só tiver uma cópia do banco não consegue montar um cookie válido.
 */
export function criarChaveIlhaDoPainel(chaveHash: string, segredo: string | undefined): ChaveIlha {
  const configurada = typeof segredo === 'string' && segredo.length > 0;
  const credencial = () => {
    if (!configurada) throw new Error('Segredo do servidor não configurado.');
    return assinar(segredo, `gunp-ilha-v2:${chaveHash}`).toString('base64url');
  };
  return {
    configurada,
    origem: 'PAINEL',
    credencial,
    confere: (chaveInformada) => {
      const normalizada = normalizarChavePainel(chaveInformada);
      return configurada && normalizada !== null && iguais(Buffer.from(resumoChavePainel(normalizada), 'hex'), Buffer.from(chaveHash, 'hex'));
    },
    credencialValida: (valor) => configurada && typeof valor === 'string' && iguais(Buffer.from(valor), Buffer.from(credencial())),
  };
}
