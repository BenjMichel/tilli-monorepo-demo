import pg from 'pg';
import { buildApp } from './http/app';
import { pgDatabase } from './infrastructure/postgres/database';
import { migrate } from './infrastructure/postgres/migrate';
import { createPlatform } from './platform';
import { demoTailors } from './seed';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const databaseUrl = process.env.DATABASE_URL;
const POLL_INTERVAL_MS = 2_000;

// Without DATABASE_URL, the demo keeps everything in memory, as before.
const pool = databaseUrl ? new pg.Pool({ connectionString: databaseUrl, max: 10 }) : null;
const database = pool ? pgDatabase(pool) : undefined;
if (database) {
  const applied = await migrate(database);
  console.log(applied.length > 0 ? `Migrations applied: ${applied.join(', ')}` : 'Database schema up to date');
}

const platform = createPlatform({ candidates: demoTailors(new Date()), ...(database && { database }) });
const app = buildApp(platform);

// Due wave timers fire, and entries whose handler failed (e.g. an event that overtook another) are retried.
let polling = false;
const poller = setInterval(async () => {
  if (polling) return;
  polling = true;
  try {
    await platform.fireDueWaves();
    await platform.pump();
  } catch (error) {
    console.warn('[poller]', error);
  } finally {
    polling = false;
  }
}, POLL_INTERVAL_MS);
// Relays left pending by a previous run are sent at startup.
await platform.pump();

async function shutdown(): Promise<void> {
  clearInterval(poller);
  platform.stop();
  await app.close();
  await pool?.end();
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

await app.listen({ port, host });
console.log(`Tilli demo API listening on http://${host}:${port} (${database ? 'PostgreSQL' : 'in memory'})`);
