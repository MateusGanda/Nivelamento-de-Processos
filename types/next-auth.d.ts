import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      papel: 'ADMIN';
    };
  }

  interface User {
    papel: 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    papel?: 'ADMIN';
  }
}
