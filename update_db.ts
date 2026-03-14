import { db } from './src/lib/db';
import { users } from './src/db/schema/users';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("Updating is_admin for yuhrijul022@gmail.com...");
  try {
      await db.update(users).set({ isAdmin: true }).where(eq(users.email, 'yuhrijul022@gmail.com'));
      console.log("Update successful.");
  } catch (e) {
      console.error("Error updating:", e);
  }
}

main();
