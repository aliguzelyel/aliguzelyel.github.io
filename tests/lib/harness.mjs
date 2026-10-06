/**
 * Shared CDP harness for the UI and visual test suites.
 * Spawns `astro preview` (if needed) and headless Chrome, exposes a small
 * page API (navigate / eval / viewport / media / mouse / keys / screenshot).
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** Newest mtime (ms) under `dir`, or 0. */
const newestMtime = (dir) => {
  if (!existsSync(dir)) return 0;
  let newest = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  walk(dir);
  return newest;
};

/** True when dist/ is missing or older than the sources it was built from. */
const buildIsStale = () => {
  const out = join(root, 'dist', 'index.html');
  if (!existsSync(out)) return true;
  const built = statSync(out).mtimeMs;
  const sources = [
    newestMtime(join(root, 'src')),
    newestMtime(join(root, 'public')),
    statSync(join(root, 'astro.config.mjs')).mtimeMs,
  ];
  return Math.max(...sources) > built;
};

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const findChrome = () => {
  const path = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!path) throw new Error('Chrome not found; set CHROME_PATH.');
  return path;
};

/** Build dist/ once (tests always run against fresh static output). */
export const ensureBuild = () => {
  if (!buildIsStale()) return;
  const result = spawnSync('npx', ['astro', 'build'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('astro build failed');
};

/** Start (or reuse) `astro preview` on the given port. */
export async function startPreview(port) {
  const origin = `http://localhost:${port}`;
  try {
    if ((await fetch(origin)).ok) return { origin, child: null };
  } catch {
    /* not running yet */
  }
  const child = spawn('npx', ['astro', 'preview', '--port', String(port)], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      if ((await fetch(origin)).ok) return { origin, child };
    } catch {
      /* still starting */
    }
  }
  throw new Error(`astro preview did not start on port ${port}`);
}

export const stopPreview = (preview) => {
  if (!preview?.child) return;
  try {
    process.kill(-preview.child.pid);
  } catch {
    /* already gone */
  }
};

const KEYS = {
  Tab: { code: 'Tab', keyCode: 9 },
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Escape: { code: 'Escape', keyCode: 27 },
  Space: { code: 'Space', keyCode: 32, key: ' ', text: ' ' },
  ArrowDown: { code: 'ArrowDown', keyCode: 40, key: 'ArrowDown' },
  ArrowUp: { code: 'ArrowUp', keyCode: 38, key: 'ArrowUp' },
};

class Page {
  constructor(send, sessionId, targetId) {
    this._send = send;
    this.sessionId = sessionId;
    this.targetId = targetId;
  }

  send(method, params = {}) {
    return this._send(method, params, this.sessionId);
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) {
      const { result } = await this.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true,
      });
      if (result.value === 'complete') return;
      await sleep(150);
    }
    throw new Error(`Load timeout: ${url}`);
  }

  /** Evaluate an expression (may be async); returns the JSON value. */
  async eval(expression) {
    const { result } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `eval failed: ${result.exceptionDetails.text ?? ''} ${
          result.exceptionDetails.exception?.description ?? ''
        }`,
      );
    }
    return result.value;
  }

  async setViewport(width, height = 900) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
  }

  async emulateMedia({ media, reducedMotion } = {}) {
    const features = [];
    if (reducedMotion !== undefined) {
      features.push({
        name: 'prefers-reduced-motion',
        value: reducedMotion ? 'reduce' : 'no-preference',
      });
    }
    await this.send('Emulation.setEmulatedMedia', {
      media: media ?? '',
      features,
    });
  }

  async setScriptEnabled(enabled) {
    await this.send('Emulation.setScriptExecutionDisabled', {
      value: !enabled,
    });
  }

  async mouse(x, y) {
    this._pos = { x, y };
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
      buttons: 0,
      pointerType: 'mouse',
    });
  }

  /** Scroll the wheel at the last mouse position. */
  async wheel(deltaX, deltaY) {
    if (!this._pos) throw new Error('wheel needs a mouse position first');
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: this._pos.x,
      y: this._pos.y,
      deltaX,
      deltaY,
      pointerType: 'mouse',
    });
  }

  async click(x, y) {
    await this.mouse(x, y);
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
      pointerType: 'mouse',
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
      pointerType: 'mouse',
    });
  }

  async pressKey(name) {
    const key = KEYS[name];
    if (!key) throw new Error(`Unknown key: ${name}`);
    for (const type of ['keyDown', 'keyUp']) {
      await this.send('Input.dispatchKeyEvent', {
        type,
        key: key.key ?? name,
        code: key.code,
        // `text` lets Chrome run default actions (Enter/Space activation).
        ...(type === 'keyDown' && key.text ? { text: key.text } : {}),
        windowsVirtualKeyCode: key.keyCode,
        nativeVirtualKeyCode: key.keyCode,
      });
    }
  }

  async fontsReady() {
    await this.eval('document.fonts.ready.then(() => true)');
  }

  /** Full-viewport or full-page PNG. */
  async screenshot({ fullPage = false } = {}) {
    if (fullPage) {
      const { w, h } = await this.eval(
        `({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })`,
      );
      const result = await this.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
      });
      return { data: Buffer.from(result.data, 'base64'), width: w, height: h };
    }
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
    });
    return { data: Buffer.from(result.data, 'base64') };
  }

  async close() {
    try {
      await this._send('Target.closeTarget', { targetId: this.targetId });
    } catch {
      /* already closed */
    }
  }
}

/** Launch headless Chrome with a browser-level CDP connection. */
export async function launchBrowser() {
  const profile = mkdtempSync(join(tmpdir(), 'ui-test-chrome-'));
  const chrome = spawn(
    findChrome(),
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--force-device-scale-factor=1',
      `--user-data-dir=${profile}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );

  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Chrome did not start')),
      20000,
    );
    chrome.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/(ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });

  let closed = false;
  const browser = {
    async newPage() {
      const { targetId } = await send('Target.createTarget', {
        url: 'about:blank',
      });
      const { sessionId } = await send('Target.attachToTarget', {
        targetId,
        flatten: true,
      });
      const page = new Page(send, sessionId, targetId);
      await page.send('Page.enable');
      return page;
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      try {
        chrome.kill();
      } catch {
        /* already dead */
      }
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        /* already removed */
      }
    },
  };

  process.on('exit', () => browser.close());
  return browser;
}
