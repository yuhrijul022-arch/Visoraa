import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema/index.js';

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle<typeof schema>(client, { schema });
