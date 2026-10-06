/**
 * Behavioral UI tests: rendered content, layout chrome, interactions
 * (hover / click / keyboard / Escape), SEO, accessibility basics and
 * copy-regression guards. Run with: npm run test:ui
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  ensureBuild,
  launchBrowser,
  startPreview,
  stopPreview,
} from './lib/harness.mjs';

const PORT = 4361;
const SITE = 'https://aliguzelyel.github.io';

const REPO_BY_TITLE = {
  DemProfits: 'https://github.com/Guz-Ali/Dem-Profits',
  EMS: 'https://github.com/Guz-Ali/Smart-Home',
  'Book Exchange': 'https://github.com/bbennitt/IPRO_Book_Exchange',
  'Color Pattern Game': 'https://github.com/Guz-Ali/Color-Pattern-Game',
};

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'projects', path: '/projects' },
  { name: 'resume', path: '/resume' },
  { name: '404', path: '/404' },
];

let preview;
let browser;
let page;

before(
  async () => {
    ensureBuild();
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

/** Navigate and park the mouse somewhere harmless (no card hovered). */
const at = async (path, width = 1280) => {
  await page.setViewport(width);
  await page.navigate(preview.origin + path);
  await page.mouse(2, 2);
};

// ---------------------------------------------------------------- header

describe('header and navigation', () => {
  it('header is sticky with a hairline bottom border', async () => {
    await at('/');
    const cls = await page.eval(`document.querySelector('header').className`);
    assert.match(cls, /\bsticky\b/);
    assert.match(cls, /border-b/);
    assert.match(cls, /\bz-50\b/);
  });

  it('desktop nav lists Home / Projects / Resume / Contact with correct hrefs', async () => {
    await at('/');
    const items = await page.eval(
      `[...document.querySelectorAll('header > div > nav a')].map((a) => ({
        label: a.textContent.trim(),
        href: a.getAttribute('href'),
      }))`,
    );
    assert.deepEqual(items, [
      { label: 'Home', href: '/' },
      { label: 'Projects', href: '/projects' },
      { label: 'Resume', href: '/resume' },
      { label: 'Contact', href: '/#contact' },
    ]);
  });

  it('current route is marked aria-current="page" in desktop and mobile navs', async () => {
    await at('/projects');
    const desktop = await page.eval(
      `[...document.querySelectorAll('header > div > nav a[aria-current="page"]')].map((a) => a.getAttribute('href'))`,
    );
    assert.deepEqual(desktop, ['/projects']);
    const mobile = await page.eval(
      `[...document.querySelectorAll('header details a[aria-current="page"]')].map((a) => a.getAttribute('href'))`,
    );
    assert.deepEqual(mobile, ['/projects']);
  });

  it('home route marks only Home as current (Contact hash link never matches)', async () => {
    await at('/');
    const desktop = await page.eval(
      `[...document.querySelectorAll('header > div > nav a[aria-current="page"]')].map((a) => a.getAttribute('href'))`,
    );
    const mobile = await page.eval(
      `[...document.querySelectorAll('header details a[aria-current="page"]')].map((a) => a.getAttribute('href'))`,
    );
    assert.deepEqual(desktop, ['/']);
    assert.deepEqual(mobile, ['/']);
  });

  it('renders no mailto links when no email is configured', async () => {
    await at('/');
    const count = await page.eval(
      `document.querySelectorAll('a[href^="mailto:"]').length`,
    );
    assert.equal(count, 0);
  });

  it('desktop nav hides and the Menu disclosure appears at 360px', async () => {
    await at('/', 360);
    const state = await page.eval(`(() => {
      const desktop = document.querySelector('header > div > nav');
      const menu = document.querySelector('details[data-nav-menu]');
      return {
        desktop: getComputedStyle(desktop).display,
        summary: getComputedStyle(menu.querySelector('summary')).display,
        open: menu.open,
      };
    })()`);
    assert.equal(state.desktop, 'none');
    assert.notEqual(state.summary, 'none');
    assert.equal(state.open, false);
  });

  it('mobile menu opens on click and closes on Escape', async () => {
    await at('/', 360);
    const rect = await page.eval(`(() => {
      const r = document
        .querySelector('details[data-nav-menu] summary')
        .getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await page.click(rect.x, rect.y);
    await sleep(150);
    assert.equal(
      await page.eval(`document.querySelector('details[data-nav-menu]').open`),
      true,
    );
    await page.pressKey('Escape');
    await sleep(150);
    assert.equal(
      await page.eval(`document.querySelector('details[data-nav-menu]').open`),
      false,
    );
  });

  it('desktop nav is visible again at 1024px', async () => {
    await at('/projects', 1024);
    const display = await page.eval(
      `getComputedStyle(document.querySelector('header > div > nav')).display`,
    );
    assert.notEqual(display, 'none');
  });
});

// ---------------------------------------------------------------- footer

describe('footer', () => {
  it('shows name, role, year and the internal + social links', async () => {
    await at('/');
    const info = await page.eval(`(() => {
      const footer = document.querySelector('footer');
      const links = [...footer.querySelectorAll('nav a')].map((a) => ({
        label: a.textContent.trim(),
        href: a.getAttribute('href'),
      }));
      return { text: footer.textContent, links };
    })()`);
    assert.match(info.text, /Ali Guzelyel/);
    assert.match(info.text, /ML Engineer/);
    assert.match(info.text, new RegExp(String(new Date().getFullYear())));
    assert.deepEqual(
      info.links.map((l) => [l.label, l.href]),
      [
        ['Home', '/'],
        ['Projects', '/projects'],
        ['Resume', '/resume'],
        ['LinkedIn', 'https://www.linkedin.com/in/ali-guzelyel/'],
        ['GitHub', 'https://github.com/Guz-Ali'],
      ],
    );
  });

  it('footer is hidden in print (no-print)', async () => {
    await at('/');
    await page.emulateMedia({ media: 'print' });
    const display = await page.eval(
      `getComputedStyle(document.querySelector('footer')).display`,
    );
    await page.emulateMedia({});
    assert.equal(display, 'none');
  });
});

// ---------------------------------------------------------------- hero

describe('hero', () => {
  it('has exactly one h1 containing the name', async () => {
    await at('/');
    const h1s = await page.eval(
      `[...document.querySelectorAll('h1')].map((h) => h.textContent.trim())`,
    );
    assert.deepEqual(h1s, ['Ali Guzelyel']);
  });

  it('eyebrow shows role and location', async () => {
    await at('/');
    const eyebrow = await page.eval(
      `document.querySelector('p.eyebrow.mt-5').textContent.trim()`,
    );
    assert.equal(eyebrow, 'ML Engineer · Chicago, IL');
  });

  it('tagline leads with the PhD / ML focus', async () => {
    await at('/');
    const tagline = await page.eval(
      `document.querySelector('h1 ~ p, h1 + div + p')?.textContent ?? document.querySelectorAll('main p')[1].textContent`,
    );
    assert.match(tagline, /PhD/);
    assert.match(tagline, /machine learning/);
    assert.match(tagline, /LLMs/);
  });

  it('offers View projects and Resume CTAs', async () => {
    await at('/');
    const ctas = await page.eval(
      `[...document.querySelectorAll('main a')].filter((a) =>
        ['View projects', 'Resume'].includes(a.textContent.trim()),
      ).map((a) => [a.textContent.trim(), a.getAttribute('href')])`,
    );
    assert.deepEqual(ctas.sort(), [
      ['Resume', '/resume'],
      ['View projects', '/projects'],
    ]);
  });

  it('social links open safely in a new tab', async () => {
    await at('/');
    const social = await page.eval(
      `[...document.querySelectorAll('header ~ * a[target="_blank"], main a[target="_blank"]')]
        .map((a) => ({ href: a.getAttribute('href'), rel: a.rel }))
        .filter((a) => a.href?.includes('github.com') || a.href?.includes('linkedin.com'))`,
    );
    assert.ok(social.length >= 2, 'expected GitHub + LinkedIn links');
    for (const link of social) {
      assert.match(link.rel, /noopener/);
      assert.match(link.rel, /noreferrer/);
    }
  });

  it('renders the placeholder slot when no portrait image exists', async () => {
    await at('/');
    const state = await page.eval(`(() => ({
      imgs: document.querySelectorAll('main img').length,
      // .eyebrow uppercases via text-transform, so innerText differs from markup.
      placeholder: /portfolio · selected work/i.test(document.body.innerText),
      warmRule: !!document.querySelector('.bg-warm'),
    }))()`);
    assert.equal(state.imgs, 0);
    assert.equal(state.placeholder, true);
    assert.equal(state.warmRule, true);
  });
});

// ------------------------------------------------------- home: resume

describe('home: resume section', () => {
  it('sections run in order: intro, resume, projects, contact', async () => {
    await at('/');
    const ids = await page.eval(
      `[...document.querySelectorAll('section[id]')].map((s) => s.id)`,
    );
    assert.deepEqual(ids, ['top', 'resume', 'projects', 'contact']);
  });

  it('section indexes read 01 / Intro, 02 / Resume, 03 / Selected work, 04 / Contact', async () => {
    await at('/');
    const labels = await page.eval(
      `[...document.querySelectorAll('p.eyebrow.flex')].map((p) =>
        p.textContent.replace(/\\s+/g, ''),
      )`,
    );
    assert.deepEqual(labels, [
      '01/Intro',
      '02/Resume',
      '03/Selectedwork',
      '04/Contact',
    ]);
  });

  it('shares the CV blocks (Experience, Education, Skills) with empty states', async () => {
    await at('/');
    const blocks = await page.eval(
      `[...document.querySelectorAll('main h2.eyebrow')].map((h) => h.textContent.trim())`,
    );
    assert.deepEqual(blocks, ['Experience', 'Education', 'Skills']);
    const text = await page.eval(`document.querySelector('#resume').innerText`);
    assert.match(text, /experience\.json/);
    assert.match(text, /profile\.json/);
    assert.match(text, /Skills can be added/);
  });

  it('links to the full resume page', async () => {
    await at('/');
    const href = await page.eval(
      `[...document.querySelectorAll('#resume a')].map((a) => a.getAttribute('href')).find((h) => h === '/resume')`,
    );
    assert.equal(href, '/resume');
  });

  it('home page does not duplicate the resume facts (they live on /resume)', async () => {
    await at('/');
    const count = await page.eval(
      `document.querySelectorAll('#resume dl').length`,
    );
    assert.equal(count, 0);
  });
});

// --------------------------------------------------- home: projects

describe('home: projects section', () => {
  it('lists all four projects in the index with titles and years', async () => {
    await at('/');
    const state = await page.eval(`(() => {
      const root = document.querySelector('[data-project-browser]');
      return {
        rows: [...root.querySelectorAll('[data-project-link]')].map((a) => ({
          title: a.querySelector('.title').textContent.trim(),
          href: a.getAttribute('href'),
          year: a.querySelector('.year').textContent.trim(),
        })),
        panels: root.querySelectorAll('[data-project-panel]').length,
        allProjectsLink: [...document.querySelectorAll('#projects a')].some(
          (a) => a.getAttribute('href') === '/projects',
        ),
        heading: document.querySelector('#projects h2').textContent.trim(),
      };
    })()`);
    assert.equal(state.panels, 4);
    assert.deepEqual(state.rows.map((r) => r.title).sort(), [
      'Book Exchange',
      'Color Pattern Game',
      'DemProfits',
      'EMS',
    ]);
    for (const row of state.rows) {
      assert.match(row.href, /^#project-/);
      assert.match(row.year, /^20\d\d$/);
    }
    assert.equal(state.heading, 'Selected projects');
    assert.equal(state.allProjectsLink, true);
  });

  it('tells the user to preview with hover or focus (no click wording)', async () => {
    await at('/');
    const text = await page.eval(
      `document.querySelector('#projects').innerText`,
    );
    assert.match(text, /Hover or focus a project to preview/);
    assert.doesNotMatch(text, /Click a project/);
    assert.doesNotMatch(text, /expand its details/);
  });

  it('renders the contact band with GitHub and LinkedIn buttons only', async () => {
    await at('/');
    const state = await page.eval(`(() => {
      const contact = document.querySelector('#contact');
      return {
        heading: contact.querySelector('h2').textContent.trim(),
        links: [...contact.querySelectorAll('a')].map((a) => [
          a.textContent.trim(),
          a.getAttribute('href'),
        ]),
      };
    })()`);
    assert.equal(state.heading, 'Let’s talk');
    assert.deepEqual(state.links.sort(), [
      ['GitHub', 'https://github.com/Guz-Ali'],
      ['LinkedIn', 'https://www.linkedin.com/in/ali-guzelyel/'],
    ]);
  });
});

// ------------------------------------------------------ project browser

describe('project browser', () => {
  const browserState = () =>
    page.eval(`(() => {
      const root = document.querySelector('[data-project-browser]');
      const links = [...root.querySelectorAll('[data-project-link]')];
      const panels = [...root.querySelectorAll('[data-project-panel]')];
      const stage = document.querySelector('[data-stage]');
      return {
        active: root.getAttribute('data-active'),
        slugs: links.map((a) => a.dataset.projectLink),
        current: links
          .filter((a) => a.getAttribute('aria-current') === 'true')
          .map((a) => a.dataset.projectLink),
        display: panels.map((p) => getComputedStyle(p).display),
        hash: location.hash,
        scrollY: Math.round(window.scrollY),
        stageRect:
          Math.round(stage.getBoundingClientRect().height * 100) / 100,
        stageMin: stage.style.minHeight,
      };
    })()`);

  const rowRect = (i) =>
    page.eval(`(() => {
      const r = document
        .querySelectorAll('[data-project-link]')[${i}]
        .getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`);

  const goToBrowser = async () => {
    await at('/');
    await page.eval(
      `document.querySelector('[data-project-browser]').scrollIntoView({ block: 'center' })`,
    );
    await sleep(1000);
  };

  it('previews the first project by default', async () => {
    await at('/');
    const state = await browserState();
    assert.equal(state.slugs.length, 4);
    assert.equal(state.active, state.slugs[0]);
    assert.deepEqual(state.current, [state.slugs[0]]);
    assert.equal(state.display[0], 'block');
    assert.deepEqual(state.display.slice(1), ['none', 'none', 'none']);
    assert.equal(state.hash, '');
  });

  it('hovering a row swaps the stage and keeps it after the pointer leaves', async () => {
    await goToBrowser();
    const r = await rowRect(1);
    await page.mouse(r.x, r.y);
    await sleep(600);
    const hovered = await browserState();
    assert.equal(hovered.active, hovered.slugs[1]);
    assert.deepEqual(hovered.current, [hovered.slugs[1]]);
    assert.equal(hovered.display[1], 'block');
    assert.equal(hovered.display[0], 'none');

    await page.mouse(2, 2);
    await sleep(400);
    const left = await browserState();
    assert.equal(
      left.active,
      left.slugs[1],
      'preview must persist after leave',
    );
    assert.equal(left.hash, '');
  });

  it('stage height and scroll position stay fixed while swapping', async () => {
    await goToBrowser();
    const before = await browserState();
    assert.ok(before.stageMin.endsWith('px'), 'stage height must be locked');
    const r = await rowRect(2);
    await page.mouse(r.x, r.y);
    await sleep(600);
    const after = await browserState();
    assert.equal(after.active, after.slugs[2]);
    assert.ok(
      Math.abs(after.stageRect - before.stageRect) <= 1,
      `stage height changed: ${before.stageRect} -> ${after.stageRect}`,
    );
    assert.equal(after.scrollY, before.scrollY, 'page must not scroll on swap');
  });

  it('focusing a row swaps the stage', async () => {
    await goToBrowser();
    const focused = await page.eval(`(() => {
      const links = document.querySelectorAll('[data-project-link]');
      links[2].focus();
      return document.activeElement === links[2];
    })()`);
    assert.equal(focused, true);
    await sleep(300);
    const state = await browserState();
    assert.equal(state.active, state.slugs[2]);
    assert.deepEqual(state.current, [state.slugs[2]]);
  });

  it('ArrowDown moves focus and preview to the next row', async () => {
    await goToBrowser();
    await page.eval(
      `document.querySelectorAll('[data-project-link]')[0].focus()`,
    );
    await sleep(200);
    await page.pressKey('ArrowDown');
    await sleep(300);
    const state = await browserState();
    const focusedSlug = await page.eval(
      `document.activeElement.dataset.projectLink`,
    );
    assert.equal(focusedSlug, state.slugs[1]);
    assert.equal(state.active, state.slugs[1]);
  });

  it('clicking a row previews it without changing the hash', async () => {
    await goToBrowser();
    const r = await rowRect(3);
    await page.click(r.x, r.y);
    await sleep(500);
    const state = await browserState();
    assert.equal(state.active, state.slugs[3]);
    assert.equal(state.hash, '', 'desktop clicks must not jump to the anchor');
  });

  it('panel shows summary, bullets, keyword chips and the matching GitHub link', async () => {
    await at('/');
    const panel = await page.eval(`(() => {
      const a = document.querySelector('[data-project-panel].is-active');
      const links = [...a.querySelectorAll('.panel-links a')].map((x) => x.href);
      return {
        title: a.querySelector('h2, h3').textContent.trim(),
        summary: a.querySelector('.panel-summary')?.textContent.trim() ?? '',
        bullets: a.querySelectorAll('.panel-body ul li').length,
        chips: a.querySelectorAll('.panel-tags li').length,
        headings: a.querySelectorAll('h1, h2, h3').length,
        links,
      };
    })()`);
    assert.equal(panel.title, 'DemProfits');
    assert.ok(panel.summary.length > 10);
    assert.ok(panel.bullets >= 3, `expected >=3 bullets, got ${panel.bullets}`);
    assert.ok(panel.chips >= 1, 'expected keyword chips');
    assert.equal(panel.headings, 1, 'exactly one heading per panel');
    const expected = REPO_BY_TITLE[panel.title];
    assert.ok(expected, `unknown project ${panel.title}`);
    assert.ok(
      panel.links.includes(expected),
      `expected repo ${expected}, got ${panel.links.join(', ')}`,
    );
  });

  it('hides the index and shows every panel stacked at 360px', async () => {
    await at('/', 360);
    const state = await page.eval(`(() => ({
      index: getComputedStyle(
        document.querySelector('[data-project-browser] .index'),
      ).display,
      panels: [...document.querySelectorAll('[data-project-panel]')].map(
        (p) => getComputedStyle(p).display,
      ),
      stageMin: document.querySelector('[data-stage]').style.minHeight,
    }))()`);
    assert.equal(state.index, 'none');
    assert.deepEqual(state.panels, ['block', 'block', 'block', 'block']);
    assert.equal(state.stageMin, '');
  });

  it('wraps long project names without clipping or page overflow', async () => {
    const LONG =
      'Distributed Real-Time Sensor Fusion and Forecasting Dashboard for Smart-Home Energy Analytics';
    const LONG_TAGS =
      'iot, time-series, machine-learning, energy, forecasting, dashboard, edge-computing';
    for (const width of [1280, 768, 360]) {
      await at('/', width);
      await page.eval(
        `(() => {
          const long = ${JSON.stringify(LONG)};
          const tags = ${JSON.stringify(LONG_TAGS)};
          document
            .querySelectorAll('[data-project-link] .title, .panel-title')
            .forEach((t) => (t.textContent = long));
          document
            .querySelectorAll('[data-project-link] .keywords')
            .forEach((t) => (t.textContent = tags));
        })()`,
      );
      await sleep(300);
      const state = await page.eval(`(() => {
        const de = document.documentElement;
        const index = document.querySelector('[data-project-browser] .index');
        const idx =
          index && getComputedStyle(index).display !== 'none'
            ? index.getBoundingClientRect()
            : null;
        const rows = [...document.querySelectorAll('[data-project-link]')].map(
          (a) => {
            const t = a.querySelector('.title');
            const r = a.getBoundingClientRect();
            return {
              clipped: t.scrollWidth > t.clientWidth + 1,
              inside: !idx || (r.left >= idx.left - 1 && r.right <= idx.right + 1),
            };
          },
        );
        const panelTitles = [...document.querySelectorAll('.panel-title')].map(
          (t) => t.scrollWidth > t.clientWidth + 1,
        );
        return {
          pageOverflow: de.scrollWidth > de.clientWidth + 1,
          rows,
          panelTitles,
        };
      })()`);
      assert.equal(
        state.pageOverflow,
        false,
        `${width}px: page must not scroll horizontally`,
      );
      state.rows.forEach((row, i) => {
        assert.equal(row.clipped, false, `${width}px: row ${i} title clipped`);
        assert.equal(row.inside, true, `${width}px: row ${i} escapes index`);
      });
      state.panelTitles.forEach((clipped, i) => {
        assert.equal(clipped, false, `${width}px: panel ${i} title clipped`);
      });
    }
  });

  it('wheel over the index still scrolls the page', async () => {
    await goToBrowser();
    const r = await rowRect(1);
    await page.mouse(r.x, r.y);
    await sleep(200);
    const before = await page.eval('Math.round(window.scrollY)');
    await page.wheel(0, 300);
    await sleep(600);
    const after = await page.eval('Math.round(window.scrollY)');
    assert.ok(
      after > before,
      `page must scroll while the pointer is over the index (scrollY ${before} -> ${after})`,
    );
  });
});

// -------------------------------------------------------- projects page

describe('projects page', () => {
  it('renders one index row and one panel per project, each exactly once', async () => {
    await at('/projects');
    const state = await page.eval(`(() => {
      const root = document.querySelector('[data-project-browser]');
      const titles = [...root.querySelectorAll('[data-project-link] .title')].map(
        (t) => t.textContent.trim(),
      );
      return {
        rows: titles.length,
        panels: root.querySelectorAll('[data-project-panel]').length,
        titles,
        levels: [
          ...root.querySelectorAll(
            '[data-project-panel] h2, [data-project-panel] h3',
          ),
        ].map((h) => h.tagName),
      };
    })()`);
    assert.equal(state.rows, 4);
    assert.equal(state.panels, 4);
    assert.deepEqual(state.titles.sort(), [
      'Book Exchange',
      'Color Pattern Game',
      'DemProfits',
      'EMS',
    ]);
    assert.deepEqual(
      state.levels,
      ['H2', 'H2', 'H2', 'H2'],
      'panel titles are h2 under the page h1',
    );
  });

  it('page intro mentions keywords, source code and the preview hint', async () => {
    await at('/projects');
    const text = await page.eval(`document.querySelector('main').innerText`);
    assert.match(text, /Keywords, highlights and source code/);
    assert.match(text, /Hover or focus a project to preview/);
    assert.doesNotMatch(text, /Case studies/);
  });
});

// ----------------------------------------------------------- resume page

describe('resume page', () => {
  it('titles and headings use plain "Resume"', async () => {
    await at('/resume');
    const state = await page.eval(`({
      title: document.title,
      h1: document.querySelector('h1').textContent.trim(),
      eyebrow: document.querySelector('p.eyebrow').textContent.trim(),
    })`);
    assert.equal(state.title, 'Resume · Ali Guzelyel');
    assert.equal(state.h1, 'Ali Guzelyel');
    assert.equal(state.eyebrow, 'Resume');
  });

  it('has no print button, no window.print and no PDF links', async () => {
    await at('/resume');
    const state = await page.eval(`({
      buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()),
      printCalls: document.documentElement.innerHTML.includes('window.print'),
      pdfLinks: [...document.querySelectorAll('a')].filter((a) =>
        (a.getAttribute('href') ?? '').toLowerCase().includes('.pdf'),
      ).length,
    })`);
    assert.deepEqual(state.buttons, []);
    assert.equal(state.printCalls, false);
    assert.equal(state.pdfLinks, 0);
  });

  it('shows the three facts from profile.json', async () => {
    await at('/resume');
    const facts = await page.eval(
      `[...document.querySelectorAll('main dl dt')].map((dt, i) => [
        dt.textContent.trim(),
        document.querySelectorAll('main dl dd')[i].textContent.trim(),
      ])`,
    );
    assert.deepEqual(facts, [
      ['Based in', 'Chicago, IL (open to relocate)'],
      ['Focus', 'ML engineering'],
      ['Research', 'Machine learning, LLMs, large-scale data'],
    ]);
  });

  it('keeps header hidden and body black-on-white under print emulation', async () => {
    await at('/resume');
    await page.emulateMedia({ media: 'print' });
    const state = await page.eval(`({
      header: getComputedStyle(document.querySelector('header')).display,
      footer: getComputedStyle(document.querySelector('footer')).display,
      background: getComputedStyle(document.body).backgroundColor,
    })`);
    await page.emulateMedia({});
    assert.equal(state.header, 'none');
    assert.equal(state.footer, 'none');
    assert.equal(state.background, 'rgb(255, 255, 255)');
  });
});

// ---------------------------------------------------------------- 404

describe('404 page', () => {
  it('unknown URLs return HTTP 404', async () => {
    const response = await fetch(`${preview.origin}/definitely-missing`);
    assert.equal(response.status, 404);
  });

  it('renders the custom not-found page with escape links', async () => {
    await page.setViewport(1280);
    await page.navigate(`${preview.origin}/definitely-missing`);
    await page.mouse(2, 2);
    const state = await page.eval(`({
      h1: document.querySelector('h1').textContent.trim(),
      links: [...document.querySelectorAll('main a')].map((a) =>
        a.getAttribute('href'),
      ),
    })`);
    assert.equal(state.h1, 'This page doesn’t exist.');
    assert.ok(state.links.includes('/'));
    assert.ok(state.links.includes('/projects'));
  });
});

// -------------------------------------------------------- SEO and meta

describe('SEO and meta', () => {
  it('every page has a unique title, description and canonical URL', async () => {
    const seen = new Set();
    for (const { path } of PAGES) {
      await at(path);
      const meta = await page.eval(`({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content ?? '',
        canonical: document.querySelector('link[rel="canonical"]')?.href ?? '',
      })`);
      assert.ok(meta.title.length > 0, `empty title on ${path}`);
      assert.ok(meta.description.length > 20, `weak description on ${path}`);
      assert.equal(
        meta.canonical,
        SITE + (path === '/' ? '/' : `${path}/`),
        `canonical mismatch on ${path}`,
      );
      assert.equal(
        seen.has(meta.title),
        false,
        `duplicate title: ${meta.title}`,
      );
      seen.add(meta.title);
    }
  });

  it('emits Open Graph and Twitter tags pointing at the generated card', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const meta = await page.eval(`({
        image: document.querySelector('meta[property="og:image"]')?.content,
        twitterImage: document.querySelector('meta[name="twitter:image"]')?.content,
        card: document.querySelector('meta[name="twitter:card"]')?.content,
        type: document.querySelector('meta[property="og:type"]')?.content,
      })`);
      assert.equal(meta.image, `${SITE}/og.png`);
      assert.equal(meta.twitterImage, `${SITE}/og.png`);
      assert.equal(meta.card, 'summary_large_image');
      assert.equal(meta.type, 'website');
    }
  });

  it('JSON-LD describes the person and role', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const jsonLd = await page.eval(
        `JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)`,
      );
      assert.equal(jsonLd['@type'], 'Person');
      assert.equal(jsonLd.name, 'Ali Guzelyel');
      assert.equal(jsonLd.jobTitle, 'ML Engineer');
      assert.ok(jsonLd.sameAs.includes('https://github.com/Guz-Ali'));
      assert.ok(!('email' in jsonLd), 'email must be absent while unset');
    }
  });

  it('uses one h1 per page and never skips a heading level', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const walk = await page.eval(`(() => {
        const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(
          (h) => Number(h.tagName[1]),
        );
        const skips = [];
        let last = 0;
        for (const level of levels) {
          if (last && level > last + 1) skips.push('h' + last + ' -> h' + level);
          last = level;
        }
        return { h1: levels.filter((l) => l === 1).length, skips, total: levels.length };
      })()`);
      assert.equal(walk.h1, 1, `expected exactly one h1 on ${path}`);
      assert.deepEqual(walk.skips, [], `heading skips on ${path}`);
      assert.ok(walk.total >= 1);
    }
  });

  it('has html lang, viewport, favicon and sitemap wiring', async () => {
    await at('/');
    const state = await page.eval(`({
      lang: document.documentElement.lang,
      viewport: !!document.querySelector('meta[name="viewport"]'),
      favicon: document.querySelector('link[rel="icon"]')?.href,
      sitemap: document.querySelector('link[rel="sitemap"]')?.href,
    })`);
    assert.equal(state.lang, 'en');
    assert.equal(state.viewport, true);
    assert.match(state.favicon, /\/favicon\.svg$/);
    assert.match(state.sitemap, /\/sitemap-index\.xml$/);
  });
});

// ------------------------------------------------- accessibility basics

describe('accessibility basics', () => {
  it('skip link is the first body element and targets #main', async () => {
    await at('/');
    const state = await page.eval(`(() => {
      const first = document.body.querySelector('a, button, input');
      return {
        href: first?.getAttribute('href'),
        text: first?.textContent.trim(),
        mainExists: !!document.getElementById('main'),
      };
    })()`);
    assert.equal(state.href, '#main');
    assert.equal(state.text, 'Skip to content');
    assert.equal(state.mainExists, true);
  });

  it('skip link becomes visible on focus', async () => {
    await at('/');
    await page.pressKey('Tab');
    const visible = await page.eval(`(() => {
      const el = document.activeElement;
      const r = el.getBoundingClientRect();
      return {
        href: el.getAttribute('href'),
        width: r.width,
        height: r.height,
      };
    })()`);
    assert.equal(visible.href, '#main');
    assert.ok(
      visible.width > 0 && visible.height > 0,
      'focusable but invisible',
    );
  });

  it('tab stops show a visible accent focus ring', async () => {
    await at('/');
    let found = false;
    for (let i = 0; i < 8 && !found; i++) {
      await page.pressKey('Tab');
      const ring = await page.eval(`(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          width: style.outlineWidth,
          style: style.outlineStyle,
          color: style.outlineColor,
        };
      })()`);
      if (
        ring &&
        ring.width === '2px' &&
        ring.style !== 'none' &&
        ring.color === 'rgb(108, 46, 59)'
      ) {
        found = true;
      }
    }
    assert.equal(found, true, 'no element showed the 2px accent focus ring');
  });

  it('every link has an accessible name', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const nameless = await page.eval(`[...document.querySelectorAll('a')]
        .filter((a) => !(
          (a.textContent || '').trim() ||
          a.getAttribute('aria-label') ||
          a.querySelector('img[alt]')?.getAttribute('alt')
        ))
        .map((a) => a.getAttribute('href'))`);
      assert.deepEqual(nameless, [], `nameless links on ${path}`);
    }
  });

  it('decorative images are absent; present images would need alt text', async () => {
    await at('/');
    const missingAlt = await page.eval(
      `[...document.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length`,
    );
    assert.equal(missingAlt, 0);
  });
});

// ------------------------------------------------------- copy regression

describe('copy rules (regression guards)', () => {
  it('contains no em dashes in visible text', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const text = await page.eval(`document.body.innerText`);
      assert.equal(text.includes('—'), false, `em dash found on ${path}`);
    }
  });

  it('uses "Resume" without accents and never says "Print this page"', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const text = await page.eval(`document.body.innerText`);
      assert.doesNotMatch(text, /résumé/i, `accented resume on ${path}`);
      assert.doesNotMatch(text, /curriculum vitae/i, `CV wording on ${path}`);
      assert.doesNotMatch(text, /Print this page/i, `print button on ${path}`);
    }
  });

  it('never uses the old case-study section headings', async () => {
    for (const { path } of PAGES) {
      await at(path);
      const text = await page.eval(`document.body.innerText`);
      for (const heading of [
        'Key decisions',
        'What I’d do next',
        "What I'd do next",
        'Approach',
      ]) {
        assert.equal(
          text.includes(heading),
          false,
          `"${heading}" found on ${path}`,
        );
      }
    }
  });
});

// ---------------------------------------------------- static assets

describe('static assets and sitemap', () => {
  it('robots.txt allows crawling and points at the sitemap', async () => {
    const response = await fetch(`${preview.origin}/robots.txt`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /User-agent: \*/);
    assert.match(body, new RegExp(`${SITE}/sitemap-index\\.xml`));
  });

  it('sitemap lists home, projects and resume', async () => {
    const index = await (
      await fetch(`${preview.origin}/sitemap-index.xml`)
    ).text();
    assert.match(index, /sitemap-0\.xml/);
    const urls = await (await fetch(`${preview.origin}/sitemap-0.xml`)).text();
    assert.match(urls, new RegExp(`<loc>${SITE}/</loc>`));
    assert.match(urls, new RegExp(`<loc>${SITE}/projects/</loc>`));
    assert.match(urls, new RegExp(`<loc>${SITE}/resume/</loc>`));
  });

  it('og.png and favicon.svg are served; portrait stays optional', async () => {
    const og = await fetch(`${preview.origin}/og.png`);
    assert.equal(og.status, 200);
    assert.match(og.headers.get('content-type') ?? '', /image\/png/);
    const favicon = await fetch(`${preview.origin}/favicon.svg`);
    assert.equal(favicon.status, 200);
    const portrait = await fetch(`${preview.origin}/portrait.jpg`);
    assert.equal(portrait.status, 404, 'portrait must remain absent for now');
  });
});

// ------------------------------------------------------- JS disabled

describe('javascript disabled', () => {
  it('keeps all content visible and index anchors working without JS', async () => {
    await at('/');
    await page.setScriptEnabled(false);
    await page.navigate(preview.origin + '/');
    await page.mouse(2, 2);
    const state = await page.eval(`(() => {
      const reveal = document.querySelector('.reveal');
      return {
        hasJs: document.documentElement.classList.contains('has-js'),
        opacity: reveal ? getComputedStyle(reveal).opacity : null,
        reveals: document.querySelectorAll('.reveal').length,
        panels: [...document.querySelectorAll('[data-project-panel]')].map(
          (p) => getComputedStyle(p).display,
        ),
        hrefs: [...document.querySelectorAll('[data-project-link]')].map((a) =>
          a.getAttribute('href'),
        ),
      };
    })()`);
    assert.equal(state.hasJs, false);
    assert.ok(state.reveals > 0);
    assert.equal(state.opacity, '1');
    assert.deepEqual(
      state.panels,
      ['block', 'block', 'block', 'block'],
      'all panels visible without JS',
    );
    for (const href of state.hrefs) assert.match(href, /^#project-/);

    // anchor links navigate natively when JS is off
    await page.eval(
      `document.querySelector('[data-project-browser]').scrollIntoView({ block: 'center' })`,
    );
    await sleep(900);
    const row = await page.eval(`(() => {
      const r = document
        .querySelectorAll('[data-project-link]')[1]
        .getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()`);
    await page.click(row.x, row.y);
    await sleep(400);
    const hash = await page.eval(`location.hash`);
    assert.equal(hash, state.hrefs[1], 'index links must work via anchors');

    await page.setScriptEnabled(true);
    await page.navigate(preview.origin + '/');
    await page.mouse(2, 2);
  });
});
