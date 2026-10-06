# aliguzelyel.github.io

Personal portfolio, rebuilt with **Astro 5 + Tailwind CSS 4** as a static, zero-client-JS site.
Design and architecture are specified in [`plan.md`](./plan.md).

The site ships **without any personal data**: photo, email, experience, education and skills
are optional and slotted in later (manually or via script). See [Adding content](#adding-content).

## Prerequisites

- **Node.js ≥ 20** (see `.nvmrc`; developed on Node 25)
- npm ≥ 10

## Run it

```bash
npm install          # install dependencies
npm run dev          # dev server → http://localhost:4321
```

Production build and local preview:

```bash
npm run build        # static output in dist/
npm run preview      # serve dist/ → http://localhost:4321
```

Quality gates (all must be clean):

```bash
npm run check        # astro check: TypeScript diagnostics
npm run lint         # ESLint (Astro + TS frontmatter)
npm run format:check # Prettier
npm run format       # auto-format everything
npm run check:links  # crawl dist/ and verify internal links (run build first)
npm run check:qa     # headless Chrome: viewports, motion, JS-off, skip link
```

`check:qa` starts `astro preview` itself and needs Chrome installed
(`/Applications/Google Chrome.app`, override with `CHROME_PATH`).

## Tests

Node's built-in `node:test` (no extra dependencies). Both suites boot
`astro preview` and headless Chrome themselves and run against a fresh `dist/`:

```bash
npm test             # everything (runs suites sequentially)
npm run test:ui      # behavior: nav, project browser, SEO, a11y, copy rules, JS-off, 404s
npm run test:visual  # full-page screenshots at 360/768/1024/1440 px vs baselines
```

Visual baselines live in `tests/visual/baseline/` (committed); captured output
and pixel diffs land in `tests/visual/output/` (gitignored). After an
intentional visual change:

```bash
UPDATE_VISUAL=1 npm run test:visual   # rewrite the baselines
MAX_DIFF_PCT=0.5 npm run test:visual  # loosen tolerance (default 0.1%)
```

Like `check:qa`, the tests need Chrome installed. CI runs `test:ui` on every
push; the visual suite runs locally (pixel rendering differs across machines).

## Adding content

Nothing personal is required to build. Every component hides itself when its data is missing
(no dead links, no empty boxes).

Projects use an **index + preview stage**: on `/` and `/projects` a numbered
index lists the projects; hovering or focusing a row swaps the preview stage
right (summary, a few bullets, keywords, GitHub link; no per-project detail
pages) and the preview stays until you pick another. Arrow keys move down the
index; below 768px the index hides and every project renders stacked, anchor
links included. The `/resume` page is plain HTML (there is no PDF and no print
button).

| What                | Where                                               | How                                                                |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| Projects (bullets)  | `src/content/projects/<slug>.md`                    | `npm run new:project`, copy `_template.md.example`, or bulk import |
| Work experience     | `src/data/experience.json`                          | `npm run new:job`, copy `experience.example.json`, or bulk import  |
| Name / links / copy | `src/data/profile.json`                             | edit directly (typed by `src/data/site.ts`)                        |
| Education / skills  | `src/data/profile.json` → `education`, `skills`     | arrays; empty ⇒ section shows an empty state                       |
| Portrait            | `public/portrait.jpg` (or `.png`/`.webp`)           | drop the file in and the hero shows it automatically               |
| Project cover       | `public/projects/<file>.png` + `cover:` frontmatter | optional; page renders fine without it                             |

### Bulk import

Fill in one JSON file (see [`content.json.example`](./content.json.example), format in `plan.md` §7.3)
and push it in a single command:

```bash
npm run import -- --file my-content.json          # skips existing entries
npm run import -- --file my-content.json --force  # overwrite existing entries
```

## Project layout

```
src/
├── pages/         # / , /projects , /resume , /404
├── components/    # Header, Hero, CvContent, ProjectBrowser, Reveal, icons/ …
├── layouts/       # BaseLayout (SEO head, skip link, reveal + nav scripts)
├── data/          # profile.json + experience.json (typed by *.ts modules)
├── content/       # projects collection (Markdown bullet highlights)
├── styles/        # global.css (Tailwind tokens, reveal, print styles)
└── utils/         # portrait helper, date formatting
scripts/           # new:project, new:job, import, check:links, check:qa (zero deps)
tests/             # ui.test, visual.test + CDP harness; baselines in visual/baseline/
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to
`master` (quality gates and `npm run test:ui` run in CI). The repo's
**Settings → Pages → Source** must be set to
**GitHub Actions** for the first deploy to succeed.

Until that workflow has run once, the legacy root `index.html` remains the live site; both
can coexist because the Astro build only outputs to `dist/`.
