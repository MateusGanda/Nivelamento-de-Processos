export async function listProducts() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  const { db } = await import('@/src/prisma/db');
  return db.orm.public.Produto.select('id', 'codigo', 'nome').orderBy(product => product.codigo.asc()).limit(100).all();
}
