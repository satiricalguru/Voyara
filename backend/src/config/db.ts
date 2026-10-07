import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer: { stop: () => Promise<boolean> } | null = null;

/** Connects to MongoDB. Returns true when an in-memory instance was started (caller may auto-seed). */
export async function connectDB(): Promise<boolean> {
  mongoose.set('strictQuery', true);
  if (env.USE_MEMORY_DB) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    await mongoose.connect(server.getUri('hrms'));
    console.log('◆ MongoDB  in-memory instance (data resets on restart)');
    return true;
  }
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`◆ MongoDB  ${env.MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);
  return false;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
