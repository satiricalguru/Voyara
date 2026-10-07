import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { Destination, User } from './models/index.js';
import { warmCaches } from './services/ai/liveData.service.js';

async function main() {
  const inMemory = await connectDB();
  if (inMemory || (await User.estimatedDocumentCount()) === 0) {
    const { runSeed } = await import('./seed.js');
    await runSeed({ quiet: true });
    console.log('◆ Seeded   demo data (admin@hrms.com / admin123)');
  }
  const server = createApp().listen(env.PORT, () => {
    console.log(`◆ Voyara   API on http://localhost:${env.PORT}/api`);
  });
  if (env.NODE_ENV !== 'test') {
    Destination.find()
      .lean()
      .then((ds) =>
        warmCaches(ds.flatMap((d) => (d.location?.coordinates?.length ? [{ name: d.name, lat: d.location.coordinates[1], lng: d.location.coordinates[0] }] : []))),
      )
      .then(() => console.log('◆ Warmed   live-data caches for curated destinations'))
      .catch(() => undefined);
  }
  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('✖ Failed to start:', err.message);
  if (/ECONNREFUSED|querySrv|Server selection/i.test(err.message)) {
    console.error('  MongoDB is unreachable. Start mongod, point MONGODB_URI at Atlas, or set USE_MEMORY_DB=true.');
  }
  process.exit(1);
});
