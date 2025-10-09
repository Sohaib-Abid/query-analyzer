import { rm } from 'fs/promises';
import { resolve } from 'path';
const dist = resolve(process.cwd(), 'dist');
await rm(dist, { recursive: true, force: true });
