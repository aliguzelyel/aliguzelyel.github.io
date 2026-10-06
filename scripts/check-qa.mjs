#!/usr/bin/env node
/**
 * npm run check:qa
 * Headless-Chrome checks against the built site (starts `astro preview`
 * itself if the port is not already serving):
 *
 *   1. No horizontal overflow at 360 / 768 / 1024 / 1440 px (/, /projects, /resume)
 *   2. Content visible with JavaScript disabled
 *   3. Scroll reveals fire as the page is scrolled (JS enabled)
 *   3b. Hovering the project index previews a project (and keeps it)
 *   4. prefers-reduced-motion: content visible immediately, no transforms
 *   5. Skip link is the first tab stop
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4341;
const BASE = `http://localhost:${PORT}`;
const PAGES = ['/', '/projects', '/resume'];
const WIDTHS = [360, 768, 1024, 1440];

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const results = [];
const record = (ok, label, detail = '') => {
  results.push({ ok, label });
  console.log(
    `${ok ? '✓' : '✗'} ${label}${detail && !ok ? ` (${detail})` : ''}`,
  );
};

// ---------------------------------------------------------------- preview
let preview;
try {
  const probe = await fetch(BASE);
  if (!probe.ok) throw new Error(String(probe.status));
} catch {
  preview = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      /* not up yet */
    }
  }
}

// ---------------------------------------------------------------- chrome
const profile = mkdtempSync(join(tmpdir(), 'qa-chrome-'));
const chrome = spawn(
  CHROME,
  [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
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
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true });
  ws.addEventListener('error', rej, { once: true });
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

const createSession = async () => {
  const { targetId } = await send('Target.createTarget', {
    url: 'about:blank',
  });
  const { sessionId } = await send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  return { targetId, sessionId };
};

const navigate = async (sessionId, url) => {
  await send('Page.navigate', { url }, sessionId);
  for (let i = 0; i < 60; i++) {
    const { result } = await send(
      'Runtime.evaluate',
      { expression: 'document.readyState', returnByValue: true },
      sessionId,
    );
    if (result.value === 'complete') return;
    await sleep(200);
  }
  throw new Error(`Load timeout: ${url}`);
};

const evaluate = async (sessionId, expression) => {
  const { result } = await send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.value;
};

const setViewport = (sessionId, width) =>
  send(
    'Emulation.setDeviceMetricsOverride',
    { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 },
    sessionId,
  );

const { sessionId } = await createSession();
await send('Page.enable', {}, sessionId);

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
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
  if (preview) {
    try {
      process.kill(-preview.pid);
    } catch {
      /* already dead */
    }
  }
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* already removed */
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));

// ---------------------------------------------------------- 1. overflow
for (const path of PAGES) {
  for (const width of WIDTHS) {
    await setViewport(sessionId, width);
    await navigate(sessionId, BASE + path);
    const overflow = await evaluate(
      sessionId,
      `Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth`,
    );
    record(
      overflow <= 1,
      `no horizontal overflow: ${path} @ ${width}px`,
      `+${overflow}px`,
    );
  }
}

// -------------------------------------------------- 2. JS-off visibility
await send('Emulation.setScriptExecutionDisabled', { value: true }, sessionId);
await setViewport(sessionId, 1024);
await navigate(sessionId, BASE + '/');
const jsOff = await evaluate(
  sessionId,
  `(() => {
    const reveal = document.querySelector('.reveal');
    return {
      hasJs: document.documentElement.classList.contains('has-js'),
      opacity: reveal ? getComputedStyle(reveal).opacity : null,
      count: document.querySelectorAll('.reveal').length,
    };
  })()`,
);
record(
  jsOff.count > 0 && !jsOff.hasJs && jsOff.opacity === '1',
  'content visible with JavaScript disabled',
  JSON.stringify(jsOff),
);
await send('Emulation.setScriptExecutionDisabled', { value: false }, sessionId);

// ------------------------------------------------- 3. reveals on scroll
await navigate(sessionId, BASE + '/');
const step = await evaluate(
  sessionId,
  `Math.ceil(document.body.scrollHeight / 8)`,
);
for (let i = 1; i <= 8; i++) {
  await evaluate(sessionId, `window.scrollTo(0, ${step * i})`);
  await sleep(300);
}
await sleep(700);
const hidden = await evaluate(
  sessionId,
  `[...document.querySelectorAll('.reveal')].filter((el) => getComputedStyle(el).opacity !== '1').length`,
);
record(
  hidden === 0,
  'scroll reveals fire (all .reveal visible after scroll)',
  `${hidden} hidden`,
);

// ------------------------------------------ 3b. index hover previews a project
await setViewport(sessionId, 1024);
await navigate(sessionId, BASE + '/');
await evaluate(
  sessionId,
  `document.querySelector('[data-project-browser]')?.scrollIntoView({ block: 'center' })`,
);
await sleep(800);
const indexRow = await evaluate(
  sessionId,
  `(() => {
    const el = document.querySelectorAll('[data-project-link]')[1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`,
);
if (!indexRow) {
  record(false, 'hovering the index previews a project', 'no index row found');
} else {
  const slugs = await evaluate(
    sessionId,
    `[...document.querySelectorAll('[data-project-link]')].map((a) => a.dataset.projectLink)`,
  );
  await send(
    'Input.dispatchMouseEvent',
    {
      type: 'mouseMoved',
      x: indexRow.x,
      y: indexRow.y,
      buttons: 0,
      pointerType: 'mouse',
    },
    sessionId,
  );
  await sleep(500);
  const activeAfterHover = await evaluate(
    sessionId,
    `document.querySelector('[data-project-browser]').dataset.active`,
  );
  await send(
    'Input.dispatchMouseEvent',
    { type: 'mouseMoved', x: 5, y: 5, buttons: 0, pointerType: 'mouse' },
    sessionId,
  );
  await sleep(500);
  const activeAfterLeave = await evaluate(
    sessionId,
    `document.querySelector('[data-project-browser]').dataset.active`,
  );
  record(
    slugs.length > 1 &&
      activeAfterHover === slugs[1] &&
      activeAfterLeave === slugs[1],
    'hovering the index previews a project (and keeps it after leave)',
    JSON.stringify({ activeAfterHover, activeAfterLeave, slugs }),
  );
}

// ------------------------------------------ 4. prefers-reduced-motion
await send(
  'Emulation.setEmulatedMedia',
  {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  },
  sessionId,
);
await navigate(sessionId, BASE + '/');
const reduced = await evaluate(
  sessionId,
  `(() => {
    const el = document.querySelector('.reveal');
    if (!el) return { opacity: null, transform: null };
    const style = getComputedStyle(el);
    return { opacity: style.opacity, transform: style.transform };
  })()`,
);
record(
  reduced.opacity === '1' &&
    (reduced.transform === 'none' ||
      reduced.transform === 'matrix(1, 0, 0, 1, 0, 0)'),
  'prefers-reduced-motion: visible immediately, no transform',
  JSON.stringify(reduced),
);
await send('Emulation.setEmulatedMedia', { features: [] }, sessionId);

// ------------------------------------------------------- 5. skip link
await navigate(sessionId, BASE + '/');
await evaluate(sessionId, `document.body.focus()`);
for (let i = 0; i < 1; i++) {
  await send(
    'Input.dispatchKeyEvent',
    {
      type: 'rawKeyDown',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      key: 'Tab',
      code: 'Tab',
    },
    sessionId,
  );
  await send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyUp',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      key: 'Tab',
      code: 'Tab',
    },
    sessionId,
  );
  await sleep(100);
}
const first = await evaluate(
  sessionId,
  `(() => {
    const el = document.activeElement;
    if (!el) return { href: null };
    return { href: el.getAttribute('href'), text: (el.textContent || '').trim() };
  })()`,
);
record(
  first.href === '#main',
  'skip link is the first tab stop',
  JSON.stringify(first),
);

// ----------------------------------------------------------- wrap up
cleanup();

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n✗ ${failed.length} QA check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ All ${results.length} QA checks passed.`);
}
