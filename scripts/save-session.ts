import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { isValidSessionName } from '../src/domain/session-name.js';

const [name, loginUrl] = process.argv.slice(2);

if (!name || !loginUrl || !isValidSessionName(name)) {
  console.error('Uso: pnpm save-session <nombre> <url-de-login>');
  console.error('El nombre solo admite letras, números, - y _ (máx. 50).');
  process.exit(1);
}

const dir = path.resolve(process.env.SESSIONS_DIR ?? 'sessions');
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(loginUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question('Inicia sesión en el navegador y presiona Enter aquí para guardar... ');
rl.close();

const file = path.join(dir, `${name}.json`);
await context.storageState({ path: file });
await browser.close();
console.log(`Sesión guardada en ${file} (no la subas a Git)`);