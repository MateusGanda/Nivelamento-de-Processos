import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { usuariosService } from './modules/access/composition.ts';
import { criarAutorizacaoLogin } from './modules/access/presentation/login.ts';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: 'Matrícula administrativa',
      credentials: {
        matricula: { label: 'Matrícula', type: 'text' },
        senha: { label: 'Senha', type: 'password' },
      },
      authorize: criarAutorizacaoLogin({ autenticar: (matricula, senha) => usuariosService.autenticar(matricula, senha) }),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.papel = user.papel;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.papel === 'ADMIN') {
        session.user.id = token.sub;
        session.user.papel = token.papel;
      }
      return session;
    },
  },
};
