import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES_TEXTO } from '../../shared/validation.ts';
import { validarAlteracaoProduto, validarCadastroProduto } from '../../modules/products/domain/produto.ts';
import { validarAlteracaoOperacao, validarCadastroOperacao } from '../../modules/operations/domain/operacao.ts';
import { validarAlteracaoSetor, validarCadastroSetor } from '../../modules/sectors/domain/setor.ts';
import { validarCadastroPosto } from '../../modules/workstations/domain/posto.ts';
import { validarCadastroOperador } from '../../modules/operators/domain/operador.ts';
import { validarCadastroMotivoPausa } from '../../modules/pause-reasons/domain/motivoPausa.ts';
import { validarCadastroPlano } from '../../modules/production-plans/domain/plano.ts';
import { validarCadastroOrdem } from '../../modules/production-orders/domain/ordem.ts';
import { validarNomeRoteiro } from '../../modules/routings/domain/roteiro.ts';

const UUID = '00000000-0000-4000-8000-000000000001';
const texto = (n: number) => 'a'.repeat(n);

// Cada caso monta a entrada com o campo no tamanho informado.
const casos: Array<[string, number, string, (valor: string) => unknown]> = [
  ['Produto: código', LIMITES_TEXTO.codigo, 'Código', (v) => validarCadastroProduto({ codigo: v, nome: 'Produto' })],
  ['Produto: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarCadastroProduto({ codigo: 'PRD-1', nome: v })],
  ['Produto: alteração do nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarAlteracaoProduto({ nome: v })],
  ['Operação: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarCadastroOperacao({ nome: v })],
  ['Operação: descrição', LIMITES_TEXTO.descricao, 'Descrição', (v) => validarCadastroOperacao({ nome: 'Corte', descricao: v })],
  ['Operação: alteração da descrição', LIMITES_TEXTO.descricao, 'Descrição', (v) => validarAlteracaoOperacao({ descricao: v })],
  ['Setor: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarCadastroSetor({ nome: v })],
  ['Setor: descrição', LIMITES_TEXTO.descricao, 'Descrição', (v) => validarCadastroSetor({ nome: 'Costura', descricao: v })],
  ['Setor: alteração do nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarAlteracaoSetor({ nome: v })],
  ['Posto: código', LIMITES_TEXTO.codigo, 'Código', (v) => validarCadastroPosto({ codigo: v, nome: 'Posto', setorId: UUID })],
  ['Posto: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarCadastroPosto({ codigo: 'P-1', nome: v, setorId: UUID })],
  ['Operador: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarCadastroOperador({ nome: v, setorPrincipalId: UUID })],
  ['Operador: função', LIMITES_TEXTO.nome, 'Função', (v) => validarCadastroOperador({ nome: 'Ana', setorPrincipalId: UUID, funcao: v })],
  ['Motivo de pausa: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarCadastroMotivoPausa({ nome: v })],
  ['Motivo de pausa: descrição', LIMITES_TEXTO.descricao, 'Descrição', (v) => validarCadastroMotivoPausa({ nome: 'Falta de material', descricao: v })],
  ['Plano: código', LIMITES_TEXTO.codigo, 'Código', (v) => validarCadastroPlano({ codigo: v })],
  ['Plano: descrição', LIMITES_TEXTO.descricao, 'Descrição', (v) => validarCadastroPlano({ codigo: 'PL-1', descricao: v })],
  ['Ordem: número', LIMITES_TEXTO.codigo, 'Número da ordem', (v) => validarCadastroOrdem({ numero: v, planoId: UUID, produtoId: UUID, roteiroId: UUID, quantidade: 10, unidade: 'pares' })],
  ['Ordem: unidade', LIMITES_TEXTO.unidade, 'Unidade', (v) => validarCadastroOrdem({ numero: 'OP-1', planoId: UUID, produtoId: UUID, roteiroId: UUID, quantidade: 10, unidade: v })],
  ['Roteiro: nome', LIMITES_TEXTO.nome, 'Nome', (v) => validarNomeRoteiro(v)],
];

test('limites de texto dos cadastros: 120 para nomes, 500 para descrições, 30 para códigos e 20 para unidade', () => {
  assert.deepEqual(LIMITES_TEXTO, { nome: 120, descricao: 500, codigo: 30, unidade: 20 });
});

for (const [nome, limite, campo, validar] of casos) {
  test(`${nome}: aceita ${limite} caracteres e recusa ${limite + 1}`, () => {
    assert.doesNotThrow(() => validar(texto(limite)));
    // Espaços nas extremidades são removidos antes de contar.
    assert.doesNotThrow(() => validar(`  ${texto(limite)}  `));
    assert.throws(() => validar(texto(limite + 1)), (erro: Error & { codigo?: string }) => {
      assert.equal(erro.codigo, 'ENTRADA_INVALIDA');
      assert.equal(erro.message, `${campo} deve ter no máximo ${limite} caracteres.`);
      return true;
    });
  });
}
