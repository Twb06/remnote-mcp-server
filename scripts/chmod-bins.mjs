import { chmod } from 'node:fs/promises';

const bins = ['dist/index.js', 'dist/remnote-cli/index.js'];

await Promise.all(bins.map((bin) => chmod(bin, 0o755)));
