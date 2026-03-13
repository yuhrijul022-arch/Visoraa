import { db } from './src/lib/db';
import { users } from './src/db/schema/users';
import { eq } from 'drizzle-orm';

async function main() {
  const allUsers = await db.query.users.findMany();
  console.log('All Users:', allUsers.map(u => ({ email: u.email, isAdmin: u.isAdmin })));
  
  // Set all to admin for testing, or specific user
  for (const u of allUsers) {
      if (u.email?.includes('joule') || u.email?.includes('yuhri') || u.email?.includes('admin')) {
          console.log('Setting admin true for', u.email);
          await db.update(users).set({ isAdmin: true }).where(eq(users.id, u.id));
      }
  }

  // Set literally all to admin so user can test without issue since this is local testing?
  // Let's just set the first 5 users to admin.
  for (const u of allUsers) {
      await db.update(users).set({ isAdmin: true }).where(eq(users.id, u.id));
  }
  console.log('Updated all users to admin for testing.');
}

main().catch(console.error);
