import { buildApp } from './http/app';
import { createPlatform } from './platform';
import { demoTailors } from './seed';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const RETRY_INTERVAL_MS = 2_000;

const platform = createPlatform({ candidates: demoTailors(new Date()) });
const app = buildApp(platform);

// Entries whose handler failed (e.g. an event that overtook another) are retried in the background.
const retries = setInterval(() => void platform.pump(), RETRY_INTERVAL_MS);

async function shutdown(): Promise<void> {
  clearInterval(retries);
  platform.stop();
  await app.close();
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

await app.listen({ port, host });
console.log(`Tilli demo API listening on http://${host}:${port}`);
