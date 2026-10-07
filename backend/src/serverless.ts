/**
 * Vercel entry: one Express app per warm instance, one cached MongoDB connection,
 * and a first-boot auto-seed when the database is empty.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { User } from './models/index.js';

const app = createApp();
let ready: Promise<void> | null = null;

async function init() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 });
  if ((await User.estimatedDocumentCount()) === 0) {
    const { runSeed } = await import('./seed.js');
    await runSeed({ quiet: true });
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= init().catch((e) => {
    ready = null; // retry on the next request
    throw e;
  });
  try {
    await ready;
  } catch (e) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Database unavailable — check MONGODB_URI on the server', detail: (e as Error).message }));
    return;
  }
  return app(req as never, res as never);
}
