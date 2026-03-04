import { rmSync, existsSync } from 'fs';
import { join } from 'path';

const nextDir = join(process.cwd(), '..', '.next');
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log('Deleted .next cache at', nextDir);
} else {
  console.log('.next not found at', nextDir);
}

const nextDir2 = join(process.cwd(), '.next');
if (existsSync(nextDir2)) {
  rmSync(nextDir2, { recursive: true, force: true });
  console.log('Deleted .next cache at', nextDir2);
} else {
  console.log('.next not found at', nextDir2);
}

console.log('Cache cleared successfully');
