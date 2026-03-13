import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
      const res = await db.execute(sql`SELECT id, email, is_admin FROM users LIMIT 10;`);
      console.log('--- DB QUERY RESULT ---');
      console.table(res);
  } catch (err) {
      console.error('Error querying DB:', err);
  }
  process.exit(0);
}

main();
