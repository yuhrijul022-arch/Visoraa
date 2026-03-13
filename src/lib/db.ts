import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as usersSchema from '../db/schema/users.js';
import * as creditsSchema from '../db/schema/credits.js';
import * as infiniteUsageSchema from '../db/schema/infiniteUsage.js';
import * as paymentsSchema from '../db/schema/payments.js';
import * as paymentGatewaySchema from '../db/schema/paymentGateway.js';
import * as apiKeysSchema from '../db/schema/apiKeys.js';
import * as adminLogsSchema from '../db/schema/adminLogs.js';

const schema = {
  ...usersSchema,
  ...creditsSchema,
  ...infiniteUsageSchema,
  ...paymentsSchema,
  ...paymentGatewaySchema,
  ...apiKeysSchema,
  ...adminLogsSchema,
};

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false
});
export const db = drizzle(client, { schema });
