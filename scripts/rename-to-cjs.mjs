import { promises as fs } from 'fs';
import { join } from 'path';

async function renameExtensions(dir, fromExt, toExt) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await renameExtensions(full, fromExt, toExt);
    } else if (entry.isFile() && entry.name.endsWith(fromExt)) {
      const target = full.replace(new RegExp(fromExt.replace('.', '\\.') + '$'), toExt);
      await fs.rename(full, target).catch(async (e) => {
        if (e.code === 'EXDEV') {
          const content = await fs.readFile(full);
          await fs.writeFile(target, content);
          await fs.unlink(full);
        } else {
          throw e;
        }
      });
    }
  }));
}
await renameExtensions(new URL('../dist/cjs', import.meta.url).pathname, '.js', '.cjs');
await renameExtensions(new URL('../dist/esm', import.meta.url).pathname, '.js', '.mjs');
