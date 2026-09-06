/**
 * GitHub Pages (and most static hosts) have no server-side rewrite, so a deep
 * link like /reports/123 returns 404 instead of the app shell. Pages serves
 * 404.html for any unmatched path, so shipping a copy of index.html there
 * boots the SPA and lets React Router resolve the URL normally.
 */
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const dist = join(process.cwd(), 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.error('spa-fallback: dist/index.html not found - run the build first.');
  process.exit(1);
}

copyFileSync(index, join(dist, '404.html'));
console.log('spa-fallback: wrote dist/404.html');
