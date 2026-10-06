#!/usr/bin/env node
/**
 * npm run check:links
 * Crawls the static build in dist/ and verifies that every internal
 * href/src resolves to a real file and every #fragment matches an id in
 * the target document. External links are listed, never fetched.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));

/** Every href/src/srcset value in an HTML document. */
const collectRefs = (html) => {
  const refs = [];
  const attr = /\s(?:href|src)\s*=\s*"([^"]*)"/g;
  for (const [, value] of html.matchAll(attr)) refs.push(value);
  return refs;
};

const isExternal = (ref) =>
  /^(?:https?:)?\/\//.test(ref) ||
  /^(?:mailto|tel|data|javascript):/i.test(ref);

/** dist-relative path of the file a reference points at. */
const resolveTarget = (fromFile, path) => {
  if (!path) return fromFile;
  const clean = path.split('#')[0].split('?')[0];
  if (!clean) return fromFile;
  const target = clean.startsWith('/')
    ? join(dist, clean.slice(1))
    : resolve(dirname(fromFile), clean);
  if (statSafe(target)?.isDirectory()) return join(target, 'index.html');
  if (existsSafe(target)) return target;
  if (existsSafe(`${target}.html`)) return `${target}.html`;
  if (existsSafe(join(target, 'index.html'))) return join(target, 'index.html');
  return target;
};

function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function existsSafe(path) {
  return statSafe(path)?.isFile() ?? false;
}

const idCache = new Map();
const hasId = (file, fragment) => {
  if (!fragment) return true;
  if (!idCache.has(file)) {
    const html = existsSafe(file) ? readFileSync(file, 'utf8') : '';
    idCache.set(file, html);
  }
  const html = idCache.get(file);
  if (!html) return false;
  const id = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:id|name)="${id}"`).test(html);
};

const broken = [];
const external = new Set();

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const page = file.slice(dist.length);

  for (const ref of collectRefs(html)) {
    if (isExternal(ref)) {
      external.add(ref.split('#')[0]);
      continue;
    }
    const [, path, fragment = ''] = ref.match(/^([^#]*)(?:#(.*))?$/) ?? [];
    const target = resolveTarget(file, path);

    if (!existsSafe(target)) {
      broken.push(
        `${page}: missing ${ref} (resolved to ${target.slice(dist.length)})`,
      );
      continue;
    }
    if (fragment && !hasId(target, fragment)) {
      broken.push(`${page}: no #${fragment} in ${target.slice(dist.length)}`);
    }
  }
}

console.log(`Checked ${htmlFiles.length} page(s).`);
if (external.size) {
  console.log(`\nExternal links (not fetched):`);
  for (const link of [...external].sort()) console.log(`  ${link}`);
}

if (broken.length) {
  console.error(`\n✗ ${broken.length} broken internal link(s):`);
  for (const issue of broken) console.error(`  ${issue}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ All internal links and anchors resolve.');
}
