import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'public');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(source, dist, { recursive: true });

console.log(`Built ${path.relative(root, dist)}/ from ${path.relative(root, source)}/`);
