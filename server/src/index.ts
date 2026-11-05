import Fastify from 'fastify';
import { config, assertConfig } from './config.ts';
import { registerRoutes } from './routes.ts';

/**
 * Entry point for the IslamicGuide sync API.
 *
 * Runs separately from the Expo app: `pnpm --filter @islamicguide/server dev`.
 * The mobile client only ever sees HTTP — it never receives a database URL.
 */
export function buildApp() {
  const app = Fastify({
    logger: config.isProduction
      ? true
      : { transport: undefined, level: 'info' },
    bodyLimit: 1024 * 1024, // 1 MB — a full sync payload is far smaller
  });

  // The mobile app is not a browser, so CORS is only needed for the web build.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', config.publicOrigin);
    reply.header('Access-Control-Allow-Headers', 'authorization,content-type');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  app.register(async instance => {
    await registerRoutes(instance);
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error as Error }, 'unhandled error');
      // Never leak internals (SQL, stack traces) to the client.
      return reply.code(500).send({ error: 'Something went wrong.' });
    }
    return reply.code(status).send({ error: error.message });
  });

  return app;
}

async function start(): Promise<void> {
  assertConfig();
  const app = buildApp();
  try {
    // Open the database (and apply migrations on the PGlite dev path) before
    // accepting traffic, so a request can never race initialisation.
    const { ready } = await import('./db/client.ts');
    await ready();
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`IslamicGuide sync API listening on ${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Only auto-start when run directly (tests import `buildApp` instead).
const isDirectRun = process.argv[1]?.includes('index');
if (isDirectRun) {
  void start();
}
