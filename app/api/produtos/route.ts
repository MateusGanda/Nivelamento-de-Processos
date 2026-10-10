import { NextResponse } from 'next/server';
import { currentSession } from '@/modules/access/presentation/http';
import { listProducts } from '@/modules/catalog/infrastructure/products';
export const runtime = 'nodejs';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (!await currentSession()) return NextResponse.json({ error: 'Faça login para continuar.' }, { status: 401, headers });
  try {
    return NextResponse.json({ produtos: await listProducts(), limite: 100 }, { headers });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar os produtos. Verifique a conexão e as tabelas do banco.' }, { status: 503, headers });
  }
}
