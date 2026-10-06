/**
 * Visual regression tests: full-page screenshots at four viewports,
 * compared against checked-in baselines pixel by pixel.
 *
 *   npm run test:visual              compare against tests/visual/baseline/
 *   UPDATE_VISUAL=1 npm run test:visual   rewrite baselines
 *   MAX_DIFF_PCT=0.5 npm run test:visual  loosen tolerance (percent)
 *
 * Diffs land in tests/visual/output/ (gitignored).
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  ensureBuild,
  launchBrowser,
  startPreview,
  stopPreview,
} from './lib/harness.mjs';

const PORT = 4362;
const UPDATE = process.env.UPDATE_VISUAL === '1';
const MAX_DIFF_PCT = Number(process.env.MAX_DIFF_PCT ?? 0.1);
const CHANNEL_THRESHOLD = 16;

const root = fileURLToPath(new URL('..', import.meta.url));
const baselineDir = join(root, 'tests', 'visual', 'baseline');
const outputDir = join(root, 'tests', 'visual', 'output');

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'projects', path: '/projects' },
  { name: 'resume', path: '/resume' },
  { name: 'not-found', path: '/404' },
];
const WIDTHS = [360, 768, 1024, 1440];
const HEIGHT = 900;

let preview;
let browser;
let page;

before(
  async () => {
    ensureBuild();
    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    preview = await startPreview(PORT);
    browser = await launchBrowser();
    page = await browser.newPage();
  },
  { timeout: 120000 },
);

after(async () => {
  await page?.close();
  browser?.close();
  stopPreview(preview);
});

/** Deterministic full-page screenshot of `path` at `width`. */
const capture = async (path, width) => {
  await page.setViewport(width, HEIGHT);
  await page.emulateMedia({ media: '', reducedMotion: true });
  await page.navigate(preview.origin + path);
  await page.mouse(2, 2);
  await page.fontsReady();
  await sleep(250);

  const reveals = await page.eval(`(() => {
    const nodes = [...document.querySelectorAll('.reveal')];
    return nodes.filter((el) => getComputedStyle(el).opacity !== '1').length;
  })()`);
  assert.equal(reveals, 0, `${reveals} reveal elements still hidden`);

  const shot = await page.screenshot({ fullPage: true });
  return shot;
};

/** Pixel-diff two PNG data strings inside the page (canvas decode). */
const compare = async (baselineB64, actualB64) =>
  page.eval(`(() => {
    const load = (b64) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image decode failed'));
        img.src = 'data:image/png;base64,' + b64;
      });
    const draw = (img) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return { w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
    };
    return Promise.all([load(${JSON.stringify(baselineB64)}), load(${JSON.stringify(actualB64)})])
      .then(([base, act]) => {
        const a = draw(base);
        const b = draw(act);
        if (a.w !== b.w || a.h !== b.h) {
          return { sizeMismatch: true, base: [a.w, a.h], actual: [b.w, b.h], diffPct: 100 };
        }
        const diff = document.createElement('canvas');
        diff.width = a.w;
        diff.height = a.h;
        const dctx = diff.getContext('2d');
        const out = dctx.createImageData(a.w, a.h);
        let bad = 0;
        for (let i = 0; i < a.data.length; i += 4) {
          const delta = Math.max(
            Math.abs(a.data[i] - b.data[i]),
            Math.abs(a.data[i + 1] - b.data[i + 1]),
            Math.abs(a.data[i + 2] - b.data[i + 2]),
            Math.abs(a.data[i + 3] - b.data[i + 3]),
          );
          if (delta > ${CHANNEL_THRESHOLD}) {
            bad++;
            out.data[i] = 255;
            out.data[i + 1] = 0;
            out.data[i + 2] = 90;
            out.data[i + 3] = 255;
          } else {
            const gray = (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 6 | 0;
            out.data[i] = gray;
            out.data[i + 1] = gray;
            out.data[i + 2] = gray;
            out.data[i + 3] = 255;
          }
        }
        dctx.putImageData(out, 0, 0);
        return {
          diffPct: (bad / (a.w * a.h)) * 100,
          sizeMismatch: false,
          diffPng: diff.toDataURL('image/png').slice('data:image/png;base64,'.length),
        };
      });
  })()`);

for (const { name, path } of PAGES) {
  describe(`visual: ${name}`, () => {
    for (const width of WIDTHS) {
      const id = `${name}-${width}`;
      const baselinePath = join(baselineDir, `${id}.png`);
      const actualPath = join(outputDir, `${id}.png`);
      const diffPath = join(outputDir, `${id}.diff.png`);

      it(`renders ${path} at ${width}px like the baseline`, async () => {
        const shot = await capture(path, width);
        assert.ok(shot.width === width, `shot width ${shot.width} != ${width}`);
        writeFileSync(actualPath, shot.data);
        const actualB64 = shot.data.toString('base64');

        if (UPDATE) {
          writeFileSync(baselinePath, shot.data);
          return;
        }

        let baselineB64;
        try {
          baselineB64 = readFileSync(baselinePath).toString('base64');
        } catch {
          assert.fail(
            `missing baseline ${baselinePath}; create it with: UPDATE_VISUAL=1 npm run test:visual`,
          );
        }

        const result = await compare(baselineB64, actualB64);
        if (result.sizeMismatch) {
          writeFileSync(diffPath, Buffer.from(result.diffPng, 'base64'));
          assert.fail(
            `${id}: size mismatch base=${result.base.join('x')} actual=${result.actual.join('x')}; ` +
              'rewrite with UPDATE_VISUAL=1 npm run test:visual',
          );
        }
        if (result.diffPct > MAX_DIFF_PCT) {
          writeFileSync(diffPath, Buffer.from(result.diffPng, 'base64'));
        }
        assert.ok(
          result.diffPct <= MAX_DIFF_PCT,
          `${id}: ${result.diffPct.toFixed(3)}% pixels differ (max ${MAX_DIFF_PCT}%); ` +
            `see ${diffPath} and ${actualPath}; rewrite with UPDATE_VISUAL=1 npm run test:visual`,
        );
      });
    }
  });
}
