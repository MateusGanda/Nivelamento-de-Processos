import 'dotenv/config';
import { usuariosService } from '../modules/access/composition.ts';

type VariavelDoAdminInicial =
  | 'INITIAL_ADMIN_NOME'
  | 'INITIAL_ADMIN_EMAIL'
  | 'INITIAL_ADMIN_MATRICULA'
  | 'INITIAL_ADMIN_SENHA';

function lerVariavel(nome: VariavelDoAdminInicial): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`A variável ${nome} é obrigatória.`);
  return valor;
}

try {
  await usuariosService.criarPrimeiroAdmin({
    nome: lerVariavel('INITIAL_ADMIN_NOME'),
    email: lerVariavel('INITIAL_ADMIN_EMAIL'),
    matricula: lerVariavel('INITIAL_ADMIN_MATRICULA'),
    senha: lerVariavel('INITIAL_ADMIN_SENHA'),
  });
  console.log('Usuário administrativo inicial criado.');
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : 'Não foi possível criar o usuário administrativo inicial.');
  process.exitCode = 1;
}
