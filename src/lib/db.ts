import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as usersSchema from "../db/schema/users";
import * as creditsSchema from "../db/schema/credits";
import * as infiniteUsageSchema from "../db/schema/infiniteUsage";
import * as paymentsSchema from "../db/schema/payments";
import * as paymentGatewaySchema from "../db/schema/paymentGateway";
import * as apiKeysSchema from "../db/schema/apiKeys";
import * as adminLogsSchema from "../db/schema/adminLogs";

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
