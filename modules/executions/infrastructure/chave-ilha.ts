import { createHmac, timingSafeEqual } from 'node:crypto';

// Chaves curtas são fáceis de adivinhar; abaixo disso a ilha fica desativada.
export const TAMANHO_MINIMO_CHAVE = 16;

export type ChaveIlha = {
  configurada: boolean;
  // Valor guardado no cookie do terminal: deriva da chave, então trocar a chave bloqueia todos.
  credencial(): string;
  confere(chaveInformada: string): boolean;
  credencialValida(valor: string | undefined): boolean;
};

const assinar = (chave: string, texto: string) => createHmac('sha256', chave).update(texto).digest();

function iguais(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function criarChaveIlha(chave: string | undefined): ChaveIlha {
  const configurada = typeof chave === 'string' && chave.length >= TAMANHO_MINIMO_CHAVE;
  const credencial = () => {
    if (!configurada) throw new Error('Chave da ilha não configurada.');
    return assinar(chave, 'gunp-ilha-v1').toString('base64url');
  };
  return {
    configurada,
    credencial,
    // Compara as assinaturas, de mesmo tamanho, em tempo constante.
    confere: (chaveInformada) => configurada && iguais(assinar('gunp-ilha-conferencia', chaveInformada), assinar('gunp-ilha-conferencia', chave)),
    credencialValida: (valor) => configurada && typeof valor === 'string' && iguais(Buffer.from(valor), Buffer.from(credencial())),
  };
}
