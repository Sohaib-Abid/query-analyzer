import { promises as fs } from 'fs';
import path from 'path';
import { Payload } from './types';

export async function appendCsv(filePath: string, json: Payload) {
  const headers = Object.keys(json);
  try {
    await fs.access(filePath);
  } catch (error: unknown) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, headers.join(',') + '\n');
    } else {
      throw error;
    }
  }

  const values = headers.map(header => {
    const escaped = ('' + json[header as keyof Payload]).replace(/"/g, '""');
    return `"${escaped}"`;
  });

  await fs.appendFile(filePath, values.join(',') + '\n');
}
