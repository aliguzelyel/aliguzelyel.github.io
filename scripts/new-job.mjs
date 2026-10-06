#!/usr/bin/env node
/**
 * npm run new:job
 * Interactively appends an entry to src/data/experience.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPrompt } from './lib/prompt.mjs';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const path = fileURLToPath(
  new URL('../src/data/experience.json', import.meta.url),
);

const prompt = await createPrompt();
const ask = prompt.ask;

try {
  console.log('New experience entry (press Enter to accept the defaults).\n');

  const role = await ask('Role', 'Software Engineer');
  const org = await ask('Organisation', 'Example Corp');
  const id = await ask(
    'Entry id',
    `${new Date().getFullYear()}-${slugify(org)}`,
  );
  const start = await ask(
    'Start (YYYY-MM)',
    new Date().toISOString().slice(0, 7),
  );
  const end = await ask('End (YYYY-MM, blank = present)', '');
  const location = await ask('Location (blank to skip)', '');
  const bulletsRaw = await ask('Bullets (separate with "; ")', '');
  const tagsRaw = await ask('Tags (comma separated)', '');

  const entries = JSON.parse(await readFile(path, 'utf8'));

  if (entries.some((entry) => entry.id === id)) {
    console.error(
      `\n✗ Entry "${id}" already exists in experience.json; nothing written.`,
    );
    process.exitCode = 1;
  } else {
    entries.push({
      id,
      role,
      org,
      start,
      end: end || null,
      ...(location ? { location } : {}),
      bullets: bulletsRaw
        .split(';')
        .map((b) => b.trim())
        .filter(Boolean),
      tags: tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });

    await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
    console.log(`\n✓ Added "${id}" to src/data/experience.json`);
    console.log('  Run `npm run dev` to preview.');
  }
} finally {
  prompt.close();
}
