import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PORTRAITS = [
  'portrait.jpg',
  'portrait.jpeg',
  'portrait.png',
  'portrait.webp',
];

/** Absolute path of the project root (cwd during `astro dev` / `astro build`). */
function root(...segments: string[]): string {
  return resolve(process.cwd(), ...segments);
}

/** URL of the portrait in `public/`, or null when none exists. */
export function portraitHref(): string | null {
  const file = PORTRAITS.find((name) => existsSync(root('public', name)));
  return file ? `/${file}` : null;
}
