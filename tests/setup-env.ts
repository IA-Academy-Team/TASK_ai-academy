import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

process.loadEnvFile(new URL("../.env", import.meta.url));

// Tests run against their own database, never the dev one: tests/setup-db.ts
// wipes all users and projects after every test, which would otherwise erase
// whatever a developer has seeded or created locally with `pnpm dev`.
const devUrl = new URL(process.env.DATABASE_URL as string);
const testDbName = `${devUrl.pathname.slice(1)}_test`;

const admin = new Client({ connectionString: devUrl.toString() });
await admin.connect();
const { rowCount } = await admin.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  [testDbName],
);
if (rowCount === 0) {
  await admin.query(`CREATE DATABASE "${testDbName}"`);
}
await admin.end();

const testUrl = new URL(devUrl.toString());
testUrl.pathname = `/${testDbName}`;
process.env.DATABASE_URL = testUrl.toString();

const testClient = new Client({ connectionString: testUrl.toString() });
await testClient.connect();
await migrate(drizzle(testClient), { migrationsFolder: "./drizzle" });
await testClient.end();
