import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { usuariosService } from './modules/access/composition.ts';

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
      async authorize(credentials) {
        if (!credentials?.matricula || !credentials.senha) return null;
        let usuario;
        try {
          usuario = await usuariosService.autenticar(credentials.matricula, credentials.senha);
        } catch {
          // Não expor mensagens do banco ou outros detalhes de infraestrutura.
          throw new Error('AuthenticationUnavailable');
        }
        if (!usuario) return null;
        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
        };
      },
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
