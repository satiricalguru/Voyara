import fs from 'node:fs';
import path from 'node:path';

/** Writable upload directory: the project folder locally, /tmp on serverless (read-only bundle). */
export const UPLOAD_DIR = process.env.VERCEL ? '/tmp/uploads' : path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
