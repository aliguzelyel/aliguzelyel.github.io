# Portfolio Redesign Plan: aliguzelyel.github.io

Status: **ready to implement**
Decisions locked: **Astro + Tailwind** · **clean light & airy** · **asymmetric editorial layout (no plain top-to-bottom stack)** · **moderate scroll motion** · **Hero / Resume / Projects (index + preview stage) / Contact, HTML resume (no PDF, no print button)** · **copy focused on ML engineering and the PhD (ML, LLMs, large data)** · **"Resume" spelled without accents everywhere** · **project details = short bullets + keywords + GitHub link**

---

## 1. Review of the current site

### 1.1 What exists today

| Item            | State                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| Framework       | None; one hand-written `index.html` (94 lines) + `css/style.css` (221 lines)                  |
| JS              | None                                                                                          |
| Build / tooling | None. No `package.json`, no linting, no tests                                                 |
| Assets          | `images/looking_at_my_code,_are_we.png` (1.0 MB), no headshot                                 |
| Content         | 6 sections: header, navbar, hero, welcome+sidebar, about, projects, contacts, footer          |
| History         | ~60 commits, 2020–2026, mostly "add/delete resume PDF" churn; last meaningful update Feb 2026 |
| Deployment      | GitHub Pages from `master` branch, repo `aliguzelyel/aliguzelyel.github.io`                   |

### 1.2 Bugs and defects found

1. **Broken resume link**: `index.html:57` points to `images/Resume-Ali_Guzelyel_Spring_2024.pdf`, but every resume PDF has been deleted from the repo (commits `651f660`, `f270501`, `281335f`). The button 404s.
2. **Invalid CSS**: `width: %80` (`css/style.css:17`) is a parse error; `.container` has no width, so the whole layout is full-bleed despite the intent.
3. **Invalid CSS**: `position: center` (`css/style.css:198`) is not a valid value; ignored.
4. **No `<meta name="viewport">`**: the page is not responsive on phones; the `@media(max-width: 600px)` rules only help desktop browser resizing.
5. **No SEO / social metadata**: no meta description, no Open Graph, no favicon, generic title ("The Portal to Internships").
6. **Security**: every `target="_blank"` lacks `rel="noopener noreferrer"`.
7. **Accessibility**: `aria-label` on a plain `<div>` (`index.html:30`) does nothing; hero text is decorative-only; color contrast of `#FBBE9D` on the photo and `#EDF1FB` on `#A23E48` is borderline; the floating "Email me" button is hard-positioned at `top: 400px`, overlapping content at some widths; no focus-visible styles anywhere; no skip link.
8. **Semantics**: a `<nav id="projects">` used as a content section; `<nav id="navbar">` outside `<header>`; heading order jumps `h1 → h2 → h3` inconsistently.
9. **Performance**: 1 MB PNG hero used as a CSS background, unoptimized, no `loading`/`decoding` hints, Google Fonts loaded with the full Raleway variable range (18 font files) for one weight usage.
10. **Stale content**: "I'll graduate in Dec 2023", "Copyright © 2021", "placeholder until I switch to a Notion website", "fifth year student". Copy actively contradicts reality.
11. **Maintenance**: no shared components; each new project/section requires hand-editing duplicated markup.

### 1.3 What is worth keeping

- The information architecture is sound: **intro → about → projects → contact**, with a persistent email CTA.
- The project list itself: EMS/Smart-Home, DemProfits, Book Exchange, Pattern Game.
- The repo name/URL (`aliguzelyel.github.io`): must stay for GitHub Pages.
- The general color personality (deep burgundy / warm orange / periwinkle) can survive as a _single_ accent rather than three competing colors.

**Verdict: full refactor.** Nothing in the current markup/CSS is worth porting line-by-line; only content and IA carry over.

---

## 2. Goals

1. A fast, accessible, mobile-first portfolio that reads as "professional, calm, well-crafted".
2. Content lives in data files, not markup: adding a project or job = one file or one script run.
3. Real project details, not bare GitHub links: each project opens in an inline preview stage with a few short bullets, keywords and a GitHub link (no separate detail pages, no long-form write-ups).
4. Deploy on every push to GitHub Pages with zero manual steps.
5. Lighthouse ≥ 95 on Performance / Accessibility / Best Practices / SEO.
6. **Buildable and deployable with zero personal data.** Resume, experience, email, and photo are never required: they are slotted in later, manually or via script (§7), and every component degrades gracefully when they are missing.
7. **Not a plain HTML document.** The layout must be a designed, asymmetric editorial composition (§5.7) with moderate scroll-driven motion (§5.8): no uniform full-width blocks stacked one after another.

Non-goals: CMS, comments, analytics dashboards, i18n, blog (reserved for a later phase).

---

## 3. Tech stack

| Layer       | Choice                                                                               | Why                                                                                            |
| ----------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Framework   | **Astro 5** (static output, no client JS by default)                                 | Content collections, file-based routes, ships zero JS                                          |
| Styling     | **Tailwind CSS 4** via `@tailwindcss/vite`                                           | Design tokens in CSS, no config file bloat                                                     |
| Fonts       | `fontsource` packages (`Inter` + `JetBrains Mono`)                                   | Self-hosted, no Google Fonts round-trip, no CLS                                                |
| Content     | `projects` = Astro content collection (Zod); profile/experience = typed JSON modules | Validated frontmatter for projects, type-safe data everywhere, no warnings when a set is empty |
| Icons       | `astro-icon` + `lucide`                                                              | Tree-shaken SVGs, no icon font                                                                 |
| Lint/format | ESLint (astro plugin) + Prettier (astro + tailwind plugins)                          | Consistency                                                                                    |
| Deploy      | GitHub Actions → `astro build` → upload Pages artifact                               | Keeps `master` clean; no `dist` committed                                                      |
| Node        | ≥ 20 LTS (`.nvmrc` pinned)                                                           | Matches Actions runner                                                                         |

Browser JS budget: mobile-nav toggle + scroll-reveal utility (~2–3 KB total, both progressive-enhancement). Nothing critical requires JS.

---

## 4. Information architecture & routing

```
/                    Home: hero, resume (experience/education/skills), selected projects (index + preview stage), contact
/projects            All projects (index + preview stage, one block per project)
/resume              Web resume page (HTML; no PDF, no print button)
/404                 Custom not-found
```

Global chrome on every page: sticky slim header (name + nav + "Email" CTA), footer (email, LinkedIn, GitHub, resume, "built with Astro" credit).

---

## 5. Design system: "clean light & airy, asymmetric editorial"

### 5.1 Principles

- **Anti-template rule:** the page is never a sequence of identical full-width blocks. Every major section gets a different composition (§5.7): offset columns, alternating alignment, overlapping planes, oversized index numerals.
- White/near-white canvas, generous whitespace, one accent color, never more than two typefaces.
- Content width capped at `65ch` for prose, `1200px` for layout grids; grid deliberately _breaks_ alignment at section boundaries (staggered starts, indented blocks, full-bleed rules).
- Cards are borderless or hairline `1px`; shadows are almost invisible (`0 1px 2px rgb(0 0 0 / 0.04)`): depth comes from overlap and spacing, not drop shadows.
- Motion: micro-interactions 150–300 ms ease-out; project stage swaps fade in over 400 ms (height reserved by the stage lock, so nothing jumps); scroll reveals 400–600 ms with gentle stagger (§5.8); everything respects `prefers-reduced-motion`.
- No gradients as backgrounds; at most one subtle accent gradient on the hero keyword.

### 5.2 Color tokens (`@theme` in `src/styles/global.css`)

| Token                  | Value                                                 | Use                                                |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `--color-canvas`       | `#FBFBFA`                                             | Page background                                    |
| `--color-surface`      | `#FFFFFF`                                             | Cards, header                                      |
| `--color-ink`          | `#17171A`                                             | Headings, primary text                             |
| `--color-ink-muted`    | `#5B5B66`                                             | Body, secondary text                               |
| `--color-line`         | `#E7E7E4`                                             | Hairline borders, dividers                         |
| `--color-accent`       | `#6C2E3B` (deep burgundy: heritage from the old site) | Links, buttons, focus rings, active nav            |
| `--color-accent-hover` | `#542430`                                             | Hover state                                        |
| `--color-accent-soft`  | `#F6EFF0`                                             | Tag chips, hover wash                              |
| `--color-warm`         | `#E8873C` (sparingly)                                 | Single highlight: hero underline, availability dot |

Contrast targets: ink/canvas ≥ 15:1, muted/canvas ≥ 7:1, white-on-accent ≥ 7:1. All verified with an automated check (§9 checklist).

### 5.3 Typography

| Role                 | Font                      | Spec                                                                         |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| Display / headings   | Inter, `600`              | `clamp(2.5rem, 6vw, 4rem)` hero, `2rem` h2, `1.25rem` h3, tracking `-0.02em` |
| Body                 | Inter, `400`              | `1.0625rem` / `1.7`, `--color-ink-muted`, max `65ch`                         |
| Code, tags, eyebrows | JetBrains Mono, `400/500` | `0.75rem`, uppercase, `tracking 0.08em` for labels                           |

Self-hosted via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`: only the weights actually used.

### 5.4 Spacing & layout scale

- Section rhythm: `py-24` desktop / `py-16` mobile between major sections, but sections do **not** all start at `x=0`; see §5.7.
- Container: `mx-auto w-full max-w-6xl px-6`.
- Grid: **12-column** used asymmetrically: spans like `col-start-2 col-span-7`, `col-start-6 col-span-5`, `col-start-1 col-span-4` rotate per section; nothing defaults to `col-span-12` except full-bleed hairlines.
- Editorial dev tools: oversized section index numerals (`01 / 02 / …` in mono), vertical section labels (rotated text on the left rail), hairline rules that run past the container edge, `–rotate-1`/offset accents used sparingly (max 1–2 per page).
- Radius: `rounded-xl` cards, `rounded-full` chips/buttons.
- Breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280`. Asymmetry is a desktop feature: below `md` everything collapses to a single readable column (order preserved, no overlap).

### 5.5 Component inventory (`src/components/`)

| Component              | Notes                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Header.astro`         | Sticky, `backdrop-blur` + `bg-surface/80`, hairline bottom border; desktop inline nav, mobile disclosure menu (details/summary or tiny script); "Email me" pill CTA                                                                                                                                                                                 |
| `Footer.astro`         | Two rows: link groups + copyright line with current year (auto)                                                                                                                                                                                                                                                                                     |
| `Hero.astro`           | Eyebrow (`${role} · ${location}` from `site.ts`) + optional pulsing availability dot, `h1` name, value prop, primary CTA (projects) + resume CTA (`/resume`, always rendered), social icons (only configured ones), portrait slot rendered only if the image exists                                                                                 |
| `SectionHeading.astro` | Mono eyebrow label + `h2` + optional description slot                                                                                                                                                                                                                                                                                               |
| `ProjectBrowser.astro` | Numbered project index (sticky, left) + preview stage (right): hover/focus a row to swap the stage (summary, bullets via `Prose`, keyword chips, GitHub/demo links); ArrowDown/Up move focus; click previews without a hash jump; stage height locked to avoid layout shift; below 768px the index hides and every panel stacks as an anchor target |
| `CvContent.astro`      | Shared resume blocks (experience, education, skills) used by `/` and `/resume`; each block shows an empty state while its data is empty                                                                                                                                                                                                             |
| `Tag.astro`            | `rounded-full bg-accent-soft text-accent font-mono text-xs px-2.5 py-1`                                                                                                                                                                                                                                                                             |
| `Button.astro`         | Variants: `primary` (accent fill), `secondary` (hairline outline), `ghost`                                                                                                                                                                                                                                                                          |
| `Prose.astro`          | Wraps `prose prose-neutral` for markdown bodies (project bullet highlights)                                                                                                                                                                                                                                                                         |
| `Seo.astro`            | Title, description, canonical, OG/Twitter cards, JSON-LD `Person`, favicon set                                                                                                                                                                                                                                                                      |
| `SkipLink.astro`       | First element in `<body>`                                                                                                                                                                                                                                                                                                                           |
| `SectionIndex.astro`   | Oversized mono numeral + label (`01 / INTRO`) for the editorial rail (§5.7)                                                                                                                                                                                                                                                                         |
| `Reveal.astro`         | Wrapper applying the scroll-reveal classes from §5.8 (no-op without JS / with reduced motion)                                                                                                                                                                                                                                                       |

### 5.6 Interaction details

- Focus: `focus-visible:outline-2 outline-accent outline-offset-2` everywhere; never remove outlines.
- Index rows/links: `transition-[border-color,transform,box-shadow] duration-150`; entering stage panel fades in over 400 ms.
- Availability dot: gentle `animate-pulse`, disabled under `prefers-reduced-motion`.
- Forbidden: scroll-jacking, hijacked wheel/keyboard scrolling, custom cursors, animations that delay access to content.

### 5.7 Layout language: asymmetric editorial (replaces the plain up/down stack)

Each section has its own composition; the vertical order remains logical for screen readers (`<main>` order = reading order), but visually the blocks interlock:

| Section               | Composition                                                                                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero**              | Two-plane: text occupies `col 1–7` pushed down from the top; a large mono eyebrow (`01 / INTRO`) sits on the left rail; portrait (if present) overlaps the hero's bottom hairline by `-mb-12` and is offset right, not vertically centered. Hero background: canvas with one full-bleed hairline under it. |
| **Resume**            | Sticky-left / scrolling-right: index `02`, heading, role/location, social icons and a "Full resume →" link pinned with `position: sticky` while the shared CV blocks (experience, education, skills) scroll past.                                                                                          |
| **Selected projects** | Index + preview stage: numbered rows (numeral, title, year, hairline) on a sticky 4/12 column, detail panel swaps into the 7/12 stage on hover/focus and persists. Index `03`.                                                                                                                             |
| **Contact**           | Full-bleed accent-soft band that breaks the container (edge-to-edge background, content still on grid), content block offset right, oversized display heading bleeding toward the left margin. Index `04`.                                                                                                 |
| **Projects index**    | Single browser block under the intro: same numbered index + preview stage as home (all projects, panel titles as `h2` under the page `h1`); stacks per project below 768px.                                                                                                                                |

Cross-cutting devices (used at least once, no more than twice each): section index numerals, one vertical rail label, hairlines extending beyond the container, one rotated accent chip.

Mobile (`< md`): all of the above degrade to a clean single column in logical DOM order (overlap, sticky rails and rotation switched off); nothing depends on visual position for comprehension.

### 5.8 Motion system (moderate)

Progressive-enhancement, CSS-first:

1. **Scroll reveals**: elements enter with `opacity 0→1` + `translateY(16px→0)`, 500 ms `cubic-bezier(0.22, 1, 0.36, 1)`, 60 ms stagger per child. Implementation: CSS scroll-driven animations (`animation-timeline: view()`) where supported, with a ~1 KB `IntersectionObserver` fallback script for older browsers; content is visible by default if JS is off (reveal classes applied only after JS marks `<html>`).
2. **Hero parallax-lite**: portrait/eyebrow shift ≤ 24 px on scroll via `view-timeline`; no per-frame JS.
3. **Section-index counters**: index numerals fade/slide in with the section reveal.
4. **Micro-motion**: magnetic-feel button hover (color + 1 px lift), card border/arrow translate, tag chips fade on reveal only.
5. **Header**: hairline border + blur fade in after 24 px of scroll (CSS-driven).
6. All of the above wrapped in `@media (prefers-reduced-motion: reduce)` kill-switch → instant state, no transforms.

No animation libraries (no Framer Motion / GSAP) in v1, total motion JS budget ≤ 2 KB; revisit only if the reveal system proves insufficient.

---

## 6. Page-by-page specification

### 6.1 Home `/`

Every string below comes from `src/data/site.ts` (§7.4): components never hardcode personal copy. Compositions follow §5.7 (not uniform full-width rows).

1. **Header** (sticky, chrome fades in on scroll).
2. **Hero**: two-plane asymmetric intro (§5.7), min-height ~`70vh`: rail index `01`, eyebrow (`${role} · ${location}`), `h1` name, one-sentence value prop (ML/PhD focus), primary CTA (projects) + secondary CTA (resume → `/resume`, always rendered), social icon row (only icons whose URLs are set), portrait slot overlapping the bottom hairline (omitted entirely when no image is configured); layout must look complete without it.
3. **Resume**: the `/resume` content lives here: sticky left rail (index, heading, role/location, social icons, "Full resume →" link) + the shared `CvContent` blocks (experience, education, skills) scrolling on the right. This section replaces the old About essay. Index `02`.
4. **Selected projects**: the 4–5 newest/featured projects as an index + preview stage (numbered sticky index left, hover/focus swaps the detail stage right) + "All projects →" link to `/projects`; empty state instead of a broken list. Index `03`.
5. **Contact**: full-bleed accent-soft band breaking the container, offset content block, oversized heading. Links rendered only if configured. Index `04`.
6. **Footer.**

### 6.2 Projects `/projects`

- `h1` + one-line intro in an offset header block (index numeral + hairline).
- v1 ships **grouped-by-tag sections** (JS filtering deferred).
- Numbered index rows with hairlines (numeral, title, year), not a uniform card grid (§5.7).
- **Hover/focus drives the preview stage**: on fine-pointer devices (mouse/trackpad) hovering or focusing an index row swaps the stage to that project (a few bullets from the Markdown body, keyword chips, GitHub/demo links) and the preview persists after the pointer leaves; ArrowDown/ArrowUp move focus through the index; a click previews without changing the hash (so no anchor jump). No separate detail pages exist.

### 6.3 Project details (inline, no detail pages)

There is **no `/projects/[slug]` route**. Each project is an index row plus a preview panel inside `ProjectBrowser`; the panel renders:

- **A few short bullets** (the Markdown body, 3–6 `-` items, rendered by `Prose`) saying what the project does and one or two interesting points. No section headings, no long-form narrative.
- **Keywords**: the `tags` frontmatter as chips.
- **Links**: `GitHub` (the `repo` frontmatter, always the primary link) and `Live demo` only when a `demo` URL exists.

Home shows the 4–5 newest/featured projects; `/projects` shows all, grouped by tag.
The stage locks its height to the tallest panel (recomputed on font load and resize) so
swapping never moves the page; the script swaps `is-active`/`aria-current` and fades the
entering panel over 400 ms (skipped under `prefers-reduced-motion`). Without JS every
panel is visible and each row's `#project-<slug>` anchor works natively; below 768px the
index is hidden and panels stack as anchor targets.

### 6.4 Resume `/resume`

- HTML resume page built from the same `experience` / `education` / `skills` data used elsewhere (shared `CvContent` blocks, also embedded in the home page's Resume section): contact header, facts, experience, education, skills; print-friendly (`@media print` strips nav/footer, sets black-on-white) for Ctrl+P, but **no print button in the UI**.
- **No PDF anywhere**: there is no download button, no `public/resume/` directory and no file-existence check (the old site's dead PDF link was the bug this removes). The HTML page is the single canonical resume.

### 6.5 404

Centered, links back home and to `/projects`.

---

## 7. Content model

### Where content lives (as implemented)

| Content          | File                                    | Mechanism                                                                                       |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Projects         | `src/content/projects/<slug>.md`        | Astro **content collection** with Zod schema (`src/content.config.ts`)                          |
| Experience       | `src/data/experience.json`              | Plain JSON array + `ExperienceEntry` TS interface (`src/data/experience.ts`, sorted by `start`) |
| Profile          | `src/data/profile.json`                 | Plain JSON, typed by the `Profile` interface in `src/data/site.ts`                              |
| Education/Skills | `profile.json` fields (`[]` by default) | Same typed module; empty ⇒ section shows an empty state                                         |

JSON was chosen for experience/profile over YAML collections because an **empty Astro collection logs a misleading warning on every build** ("collection does not exist or is empty"), and typed JSON modules give the same `astro check` safety with zero runtime cost. Projects stay a collection because they need routing, validation and Markdown bodies.

Project frontmatter schema (`src/content.config.ts`):

```ts
{
  title: z.string(),
  summary: z.string().max(160),    // used on cards
  repo: z.string().url().optional(),
  demo: z.string().url().optional(),
  date: z.coerce.date(),
  status: z.enum(['shipped', 'wip', 'archived']),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  cover: z.string().optional(),    // file lives in public/projects/
}
```

Bodies for projects are Markdown files in `src/content/projects/<slug>.md` containing only a few short bullet points (3–6 `-` items); no prescribed section structure.

### 7.1 Placeholder-first policy (no personal data required to build)

The site **ships with generic placeholder content only**: nothing personal, no dates, no employers, no contact details beyond what is already public in this repo (name + public GitHub/LinkedIn URLs). All personal details are added _later_ by editing plain files; the build never blocks on them.

| Placeholder                    | Where it lives                                  | Ships as                                                                                  |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Name, tagline, location string | `src/data/profile.json` (typed by `site.ts`)    | Defaults already filled from the public repo (name, GitHub/LinkedIn); edit as needed      |
| Email                          | `src/data/profile.json`                         | `email: null` → contact buttons/`mailto` hidden                                           |
| Social URLs                    | `src/data/profile.json`                         | GitHub URL (public), others `null` → icon hidden                                          |
| Portrait                       | `public/portrait.jpg`                           | File absent → hero text-only layout                                                       |
| Tagline / role / facts         | `src/data/profile.json`                         | Neutral placeholder copy (ML/PhD focus), edit anytime                                     |
| Experience                     | `src/data/experience.json`                      | 0 entries → empty-state hint in the CV blocks                                             |
| Projects                       | `src/content/projects/`                         | 4 demo entries so the browser and stage are demonstrable; marked `status: 'wip'`          |
| Education, skills              | `src/data/profile.json` → `education`, `skills` | `[]` → empty-state hint in the CV blocks                                                  |
| OG image, favicon              | `public/og.png`, `public/favicon.svg`           | Generated generic card (name + tagline); `og:image`/`twitter:image` emitted on every page |

Rule enforced by components: **missing data ⇒ element not rendered** (never a `null`, empty box, or 404).

### 7.2 How content is added later

Two supported paths: both require no framework knowledge beyond editing a file or running a script.

**A. Manual (edit files directly)**

1. Project → create `src/content/projects/my-project.md`:
   ```md
   ---
   title: My Project
   summary: One-line description shown on cards.
   repo: https://github.com/you/repo
   date: 2026-01-15
   status: shipped
   tags: [TypeScript, ML]
   featured: true
   ---

   - What the project does.
   - One thing that made it interesting or hard.
   - Result, outcome or current status.
   ```
2. Job → append an entry to `src/data/experience.json` (shape in `experience.example.json`), or run `npm run new:job`.
3. Personal details → edit `src/data/profile.json` (email, tagline, role, links, facts, education, skills): `site.ts` only holds the types.
4. Drop assets in place: `public/portrait.jpg`, `public/projects/<slug>.png`.
5. `npm run dev` to preview → commit → CI deploys.

Each data file has a sibling example template (`_template.md.example`, `profile.example.json`, `experience.example.json`) documenting every field inline. The four project repos already linked publicly on the current site (Smart-Home/EMS, DemProfits, Book Exchange, Pattern Game) can be re-created as content files as-is or replaced: nothing else needs to be carried over.

**B. Scripted (scaffolding + bulk import)**

| Command                                 | What it does                                                                                                                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run new:project`                   | Interactive prompt (title, summary, repo, tags) → scaffolds `src/content/projects/<slug>.md` from the bullets template                                                                                                 |
| `npm run new:job`                       | Interactive prompt → appends an entry to `src/data/experience.json`                                                                                                                                                    |
| `npm run import -- --file content.json` | **Bulk import**: reads a single JSON/CSV of `{projects, experience, profile}` and writes all content files (see §7.3 format). Lets an entire portfolio be filled in offline/in one file and pushed in a single command |

`import` is idempotent: it skips slugs that already exist unless `--force` is passed.

### 7.3 Bulk-import format (`content.json`)

```jsonc
{
  "profile": {
    "name": "…",
    "tagline": "…",
    "location": "…",
    "email": "…",
    "github": "…",
    "linkedin": "…",
    "facts": [{ "label": "…", "value": "…" }],
  },
  "experience": [
    {
      "role": "…",
      "org": "…",
      "start": "2024-06",
      "end": null,
      "location": "…",
      "bullets": ["…"],
      "tags": ["…"],
    },
  ],
  "projects": [
    {
      "title": "…",
      "slug": "…",
      "summary": "…",
      "repo": "…",
      "date": "2025-03-01",
      "status": "shipped",
      "tags": ["…"],
      "featured": true,
      "body": "markdown…",
    },
  ],
}
```

Validation before anything is written: required fields checked field-by-field for `profile`/`experience`/`projects`; once written, projects are re-validated by the collection's Zod schema and profile/experience by TypeScript in `astro check`.

### 7.4 Single source of truth

`src/data/site.ts` holds the **types** for profile data; `profile.json` and `experience.json` hold the data. `Seo.astro`, `Hero`, `Contact`, `Footer`, `/resume`, and JSON-LD all read from these two modules: updating a value once updates the whole site.

---

## 8. Performance, SEO, accessibility budgets

**Performance**

- Hero image ≤ 150 KB (WebP/AVIF, `width`/`height` set, `loading="eager"` only for the hero portrait); everything else `loading="lazy"`.
- Runtime JS: mobile-nav `Escape` close + reveal fallback (both `is:inline` in `BaseLayout.astro`, together ≤ 2.5 KB, non-blocking, content visible without them). Reveal/parallax primarily via CSS scroll-driven animations (§5.8).
- Self-hosted fonts, `font-display: swap`, preloaded only for Inter regular/semibold.
- Targets: LCP < 1.5 s, CLS < 0.05, total page weight < 500 KB home.

**SEO / sharing**

- Unique `<title>` + meta description per page (`Seo.astro`).
- Canonical URLs, `og:type`, `og:image` (1200×630 generated card with name + tagline in `public/og.png`), Twitter card.
- `sitemap.xml` via `@astrojs/sitemap`, `robots.txt`, JSON-LD `Person` + `WebSite`.
- Semantic headings: exactly one `h1` per page, no level skips.

**Accessibility**

- WCAG 2.2 AA: contrast, targets ≥ 44×44 px, visible focus, skip link, `lang="en"`.
- All interactive elements keyboard-operable; mobile menu traps nothing and closes on `Escape`.
- `prefers-reduced-motion` honored.
- Verified with `@axe-core/playwright` (§9 checklist).

---

## 9. Target repository structure

```
aliguzelyel.github.io/
├── plan.md
├── README.md                     # what it is, how to run / add content / deploy
├── package.json  package-lock.json
├── astro.config.mjs              # site: 'https://aliguzelyel.github.io', sitemap, tailwind vite plugin
├── tsconfig.json  .nvmrc  .gitignore
├── eslint.config.js  .prettierrc.json  .prettierignore
├── public/
│   ├── favicon.svg  robots.txt
│   ├── portrait.jpg              # optional; hero adapts when absent
│   ├── og.png                    # generated 1200×630 social card (name + tagline)
│   └── projects/                 # optional project covers (not rendered yet)
├── scripts/
│   ├── lib/prompt.mjs            # TTY + piped-stdin prompt helper
│   ├── new-project.mjs           # npm run new:project
│   ├── new-job.mjs               # npm run new:job
│   ├── import-content.mjs        # npm run import -- --file content.json
│   ├── check-links.mjs           # npm run check:links (crawl dist/, verify links)
│   └── check-qa.mjs              # npm run check:qa (headless Chrome: viewport/motion/JS-off)
├── content.json.example          # bulk-import template (§7.3)
├── src/
│   ├── styles/global.css         # @theme tokens, base, reveal, parallax, print
│   ├── content.config.ts         # projects collection (Zod schema)
│   ├── content/projects/         # *.md projects (bullet bodies) + _template.md.example
│   ├── data/
│   │   ├── profile.json          # name, links, tagline, facts, education, skills
│   │   ├── profile.example.json
│   │   ├── experience.json       # work entries ([] = section hidden)
│   │   ├── experience.example.json
│   │   ├── site.ts               # Profile types + `site` export
│   │   └── experience.ts         # ExperienceEntry types + sorted `experience`
│   ├── utils/                    # assets.ts (portrait), dates.ts
│   ├── layouts/BaseLayout.astro  # SEO head, skip link, reveal + nav scripts
│   ├── components/               # §5.5 + icons/ (Github, Linkedin, Mail, Arrow)
│   └── pages/
│       ├── index.astro
│       ├── resume.astro
│       ├── 404.astro
│       └── projects/
│           └── index.astro
└── .github/workflows/deploy.yml  # build + quality gates + Pages upload (phase 10)
```

**Removed:** `css/style.css`, old `images/*.png` hero, the "Portal to Internships" branding, dead resume links.

### Implementation phases

| Phase                  | Work                                                                                                                                                                                                                          | Done when                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **1. Scaffold**        | `npm create astro@latest` + Tailwind 4 + fontsource + icon + sitemap; ESLint/Prettier; `.gitignore`; empty `deploy.yml`; verify `npm run dev` & `npm run build`                                                               | Build green locally                                                                                        |
| **2. Design system**   | `global.css` tokens, base typography, `Button/Tag/SectionHeading/Container` primitives, dark-free light theme, **editorial grid utilities (12-col asymmetric spans, hairline/offset helpers) + motion primitives (§5.7–5.8)** | Primitives render in a test page                                                                           |
| **3. Layout & chrome** | `BaseLayout`, `Seo`, `Header`, `Footer`, `SkipLink`, `SectionIndex`/`Reveal`, reveal script                                                                                                                                   | Nav + footer on all routes, axe clean                                                                      |
| **4. Content model**   | Projects collection + Zod schema; `profile.json`/`experience.json` typed modules + `.example` templates; components tolerate missing data                                                                                     | `astro check` passes with **empty** experience                                                             |
| **5. Home page**       | Hero → Resume → Selected projects → Contact, each with its own asymmetric composition (§5.7), data-driven with empty-state/hidden-section behavior, scroll reveals active                                                     | Matches §6.1 at 3 breakpoints using placeholders only; no two adjacent sections share the same composition |
| **6. Projects**        | Numbered index + preview stage (no `[slug]` route, §6.3); 4 demo entries prove the browser                                                                                                                                    | Hover/focus swaps the stage in place; deleting demo entries leaves a clean empty state                     |
| **7. Resume page**     | `/resume` + home Resume section from data (no PDF, no print button)                                                                                                                                                           | Route verified; page renders from data with empty-state hints                                              |
| **8. Content tooling** | `new:project`, `new:job`, `import` scripts + `content.json.example` + README "adding content" guide                                                                                                                           | Scaffold a project and run a JSON import end-to-end                                                        |
| **9. Polish**          | Favicons, generic OG image, sitemap, robots, JSON-LD, reduced-motion                                                                                                                                                          | §8 checklist green                                                                                         |
| **10. CI/CD**          | `.github/workflows/deploy.yml` created (npm ci → gates → build → link check → Pages artifact); live deploy needs repo **Settings → Pages → Source = GitHub Actions**                                                          | Workflow runs green on push; site live on `aliguzelyel.github.io`                                          |
| **11. Launch QA**      | Full checklist below; rewrite `README.md`; remove legacy files                                                                                                                                                                | Sign-off: site complete **without any personal data**                                                      |

**Prototype status:** phases 1–9 are implemented (design system, chrome, data-driven pages, tooling, favicons/sitemap/robots/JSON-LD/`og.png`). Phase 10's workflow file exists; the live deploy is pending push + repo Pages settings. Phase 11: link crawler (`npm run check:links`), headless-Chrome QA (`npm run check:qa`: viewports, motion, JS-off, skip link), behavioral UI tests (`npm run test:ui`: nav/`aria-current`, project browser hover/focus/arrow/anchor, SEO/JSON-LD, heading order, a11y basics, copy regression, JS-off, static assets) and visual regression tests (`npm run test:visual`: 4 pages × 4 viewports vs committed baselines) implemented and passing; Lighthouse 100/100/100/100 on `/`, `/projects`, `/resume`. Remaining: legacy file removal, OG debugger validation, manual layout/keyboard sign-off, production deploy.

### Verification checklist (Phase 11)

- [x] `npm run build && npm run preview`: zero warnings, **on placeholder-only content**
- [x] `npx astro check`: zero TS errors
- [x] `npm run lint` / `npm run format:check`: clean
- [x] Lighthouse mobile: Perf/AA/Best/SEO ≥ 95 on `/`, `/projects`, `/resume` (run locally: **100 / 100 / 100 / 100** on all three routes)
- [x] Accessibility audit: 0 violations (Lighthouse accessibility category, axe-core based, score 100 on all routes; standalone `@axe-core/playwright` run optional)
- [x] Every internal link + anchor resolves (crawler script: `npm run check:links`); **no 404s**: includes asserting that resume/portrait/social links are _absent_, not broken, when their files/values are absent (this is how the current resume bug slipped through)
- [x] `npm run new:project` scaffolds a project file; `npm run import -- --file sample.json` populates everything; deleting the added files restores the clean placeholder state
- [ ] OG image renders on Twitter/LinkedIn debuggers (`og.png` generated and `og:image`/`twitter:image` tags verified in the build; external validation pending)
- [x] Viewport check at 360 / 768 / 1024 / 1440 px: no horizontal scroll (automated: `npm run check:qa`)
- [x] Behavioral UI tests (automated: `npm run test:ui`, runs in CI): active-nav `aria-current`, project browser (default/hover/focus/ArrowDown/anchor/mobile stack/JS-off), mobile menu, SEO meta + JSON-LD + canonical URLs, heading order, skip link + focus ring, copy regression guards (no em dashes, plain "Resume", no print/PDF wording), JS-disabled content visibility, sitemap/robots/og.png
- [x] Visual regression tests (automated: `npm run test:visual`, local): full-page screenshots of all 4 pages at 360/768/1024/1440 px compared against committed baselines in `tests/visual/baseline/` (≤ 0.1% pixel diff; `UPDATE_VISUAL=1` rewrites)
- [ ] **Layout:** desktop shows the asymmetric compositions of §5.7 (no two adjacent sections share a layout); below `md` everything collapses to one clean column in logical DOM order
- [x] **Motion:** reveals fire on scroll; with `prefers-reduced-motion: reduce` all transforms/opacity transitions are disabled and content is immediately visible; with JS disabled all content is visible (automated: `npm run check:qa`)
- [ ] Keyboard-only pass: skip link → nav → CTAs → footer; visible focus throughout (skip link as first tab stop and 2px accent focus ring automated in `test:ui`; full pass manual)
- [ ] Production deploy verified on the real domain

---

## 10. Risks & open questions

| Risk / question                                                               | Mitigation                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Personal data (resume, jobs, email, photo) never enters the repo during build | Placeholder-first policy (§7.1); everything is opt-in via files/scripts added later                                    |
| Site looks empty on first deploy                                              | Empty-state + hidden-section rules (§6.1) + 1–2 clearly-marked demo project entries                                    |
| User adds content without knowing the schema                                  | `.example` templates, `new:*` scaffolds, Zod validation for projects + `astro check` types for JSON                    |
| GitHub Pages + Astro base path                                                | Astro sets `site` from config; root-serve repo → `base: '/'`, no prefix needed                                         |
| Over-scoping project write-ups                                                | Bodies are restricted to a few short bullets (§6.3); keywords live in tags, links in frontmatter                       |
| Email scraping                                                                | Render as plain text + `mailto:`; accept minor spam risk, or switch to a `hello [at]` visual split if desired          |
| Resume/portrait added but filename mismatches button                          | No file-based resume at all; portrait existence checked at build time so the slot only renders when present            |
| Asymmetric layout breaks on odd content lengths                               | Compositions are grid spans + offsets, not absolute positioning; content overflow reflows naturally; QA at 4 viewports |
| CSS scroll-driven animations unsupported in some browsers                     | `@supports` guard + ~1 KB IntersectionObserver fallback; content visible by default either way (§5.8)                  |
| vite 6 (astro) vs vite 8 (@tailwindcss/vite) plugin type mismatch             | Single `@ts-ignore` in `astro.config.mjs`; build and dev verified working                                              |
| Empty Astro content collections log a misleading build warning                | Experience/profile are typed JSON modules instead of collections (§7)                                                  |

## 11. Explicitly out of scope (v1)

Blog, RSS, dark mode, JS project filtering, i18n, contact form/backend, analytics, MDX components beyond prose, design-system Storybook, animation libraries (GSAP/Framer Motion), scroll-jacking.
