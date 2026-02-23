import fs from 'fs/promises';
import path from 'path';
import { Thread } from './types.js';

const FILENAME = '.threads.jsonl';

export async function readThreads(dir: string): Promise<Thread[]> {
  const filePath = path.join(dir, FILENAME);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function writeThreads(dir: string, threads: Thread[]): Promise<void> {
  const filePath = path.join(dir, FILENAME);
  const tempPath = filePath + '.tmp';

  await fs.mkdir(dir, { recursive: true });

  const content = threads.map((thread) => JSON.stringify(thread)).join('\n') + '\n';

  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}
