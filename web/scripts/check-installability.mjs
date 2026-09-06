/**
 * Reports whether Chrome considers this app installable as a real app
 * (WebAPK / standalone), rather than only a home-screen bookmark.
 *
 *   npm run check:install                     # checks http://localhost:5173
 *   npm run check:install http://localhost:5050
 *
 * Requires Chrome to be reachable through puppeteer:
 *   npx puppeteer browsers install chrome
 */
const TARGET = process.argv[2] || process.env.TARGET || 'http://localhost:5173';

let puppeteer;
try {
  puppeteer = (await import('puppeteer')).default;
} catch {
  console.error('This check needs puppeteer:  npm i -D puppeteer');
  process.exit(2);
}

const REQUIRED = [
  ['display', (m) => m.display === 'standalone', 'must be "standalone" for an app window'],
  ['id', (m) => typeof m.id === 'string' && m.id, 'a stable id keeps it the same installed app'],
  ['start_url', (m) => Boolean(m.start_url), 'required'],
  ['icons 192+512', (m) => ['192x192', '512x512'].every((s) => (m.icons || []).some((i) => String(i.sizes).includes(s))), 'required'],
  ['maskable icon', (m) => (m.icons || []).some((i) => String(i.purpose || '').includes('maskable')), 'recommended for a clean launcher icon'],
  ['narrow screenshot', (m) => (m.screenshots || []).some((s) => s.form_factor === 'narrow'), 'upgrades Chrome to the full "Install app" dialog'],
];

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const cdp = await page.target().createCDPSession();
await cdp.send('Page.enable');

console.log(`\nChecking ${TARGET}\n`);
await page.goto(TARGET, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1200));

const res = await cdp.send('Page.getAppManifest');
if (!res.url) {
  console.error('  x No manifest served at all - Chrome can only offer a bookmark shortcut.');
  await browser.close();
  process.exit(1);
}
const manifest = JSON.parse(res.data || '{}');

let ok = true;
for (const [label, test, why] of REQUIRED) {
  const good = test(manifest);
  if (!good) ok = false;
  console.log(`  ${good ? 'ok' : ' x'}  ${label.padEnd(20)} ${good ? '' : '- ' + why}`);
}

const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
console.log('');
if (installabilityErrors.length === 0) {
  console.log('  Chrome reports: INSTALLABLE - installs as a real app, not a shortcut.');
} else {
  ok = false;
  console.log('  Chrome reports these blockers:');
  for (const e of installabilityErrors) console.log(`    - ${e.errorId} ${JSON.stringify(e.errorArguments)}`);
}

if (!TARGET.startsWith('https://') && !/localhost|127\.0\.0\.1/.test(TARGET)) {
  ok = false;
  console.log('\n  ! Not a secure origin. Chrome will offer only "Add to Home screen".');
  console.log('    Use npm run dev:https, or serve over HTTPS.');
}

console.log('');
await browser.close();
process.exit(ok ? 0 : 1);
