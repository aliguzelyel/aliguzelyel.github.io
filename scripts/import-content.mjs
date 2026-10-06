#!/usr/bin/env node
/**
 * npm run import -- --file content.json [--force]
 *
 * Bulk-imports portfolio content from a single JSON file (see plan.md §7.3):
 *   { "profile": {...}, "experience": [ {...} ], "projects": [ {...} ] }
 *
 * - profile    -> merged into src/data/profile.json
 * - experience -> merged into src/data/experience.json (by id)
 * - projects   -> written to src/content/projects/<slug>.md
 *
 * Existing entries are skipped unless --force is passed.
 */
import { readFile, writeFile, access } from 'node:fs/promises';

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const url = (relative) => new URL(relative, import.meta.url);
const exists = (fileUrl) =>
  access(fileUrl).then(
    () => true,
    () => false,
  );

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const force = args.includes('--force');
const inputPath = fileIndex !== -1 ? args[fileIndex + 1] : null;

if (!inputPath) {
  console.error('Usage: npm run import -- --file content.json [--force]');
  process.exit(1);
}

const errors = [];
const require = (condition, message) => {
  if (!condition) errors.push(message);
};

let input;
try {
  input = JSON.parse(await readFile(inputPath, 'utf8'));
} catch (error) {
  console.error(`✗ Could not parse ${inputPath}: ${error.message}`);
  process.exit(1);
}

const profile = input.profile ?? {};
const experience = input.experience ?? [];
const projects = input.projects ?? [];

require(typeof input === 'object', 'Root must be a JSON object');
require(Array.isArray(experience), '"experience" must be an array');
require(Array.isArray(projects), '"projects" must be an array');

experience.forEach((entry, i) => {
  require(entry.id, `experience[${i}]: missing "id"`);
  require(entry.role, `experience[${i}]: missing "role"`);
  require(entry.org, `experience[${i}]: missing "org"`);
  require(entry.start, `experience[${i}]: missing "start" (YYYY-MM)`);
});

projects.forEach((project, i) => {
  require(project.title, `projects[${i}]: missing "title"`);
  require(project.summary, `projects[${i}]: missing "summary"`);
  require(project.date, `projects[${i}]: missing "date" (YYYY-MM-DD)`);
  require(['shipped', 'wip', 'archived'].includes(
    project.status ?? 'wip',
  ), `projects[${i}]: "status" must be shipped | wip | archived`);
});

if (errors.length) {
  console.error('✗ Validation failed:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

// 1. profile -> profile.json (merge)
const profilePath = url('../src/data/profile.json');
const currentProfile = JSON.parse(await readFile(profilePath, 'utf8'));
const nextProfile = { ...currentProfile, ...profile };
await writeFile(
  profilePath,
  `${JSON.stringify(nextProfile, null, 2)}\n`,
  'utf8',
);
console.log(
  `✓ src/data/profile.json (${Object.keys(profile).length} field(s) updated)`,
);

// 2. experience -> experience.json (merged by id)
if (experience.length > 0) {
  const expPath = url('../src/data/experience.json');
  const entries = JSON.parse(await readFile(expPath, 'utf8'));

  let added = 0;
  let skipped = 0;
  for (const raw of experience) {
    const id = String(raw.id);
    const index = entries.findIndex((entry) => entry.id === id);
    const next = {
      id,
      role: raw.role,
      org: raw.org,
      start: String(raw.start),
      end: raw.end ? String(raw.end) : null,
      ...(raw.location ? { location: raw.location } : {}),
      bullets: raw.bullets ?? [],
      tags: raw.tags ?? [],
    };

    if (index !== -1) {
      if (!force) {
        skipped += 1;
        continue;
      }
      entries[index] = next;
    } else {
      entries.push(next);
    }
    added += 1;
  }

  await writeFile(expPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  console.log(
    `✓ src/data/experience.json (${added} added${skipped ? `, ${skipped} skipped (use --force to overwrite)` : ''})`,
  );
}

// 3. projects -> content/projects/<slug>.md
if (projects.length > 0) {
  let added = 0;
  let skipped = 0;

  for (const project of projects) {
    const slug = slugify(project.slug ?? project.title);
    if (!slug) {
      errors.push(`project "${project.title}": could not derive a slug`);
      continue;
    }

    const path = url(`../src/content/projects/${slug}.md`);
    if ((await exists(path)) && !force) {
      skipped += 1;
      continue;
    }

    const tags = project.tags ?? [];
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(project.title)}`,
      `summary: ${JSON.stringify(project.summary)}`,
      ...(project.repo ? [`repo: ${project.repo}`] : []),
      ...(project.demo ? [`demo: ${project.demo}`] : []),
      `date: ${project.date}`,
      `status: ${project.status ?? 'wip'}`,
      `tags: [${tags.join(', ')}]`,
      `featured: ${project.featured === true}`,
      ...(project.cover ? [`cover: ${project.cover}`] : []),
      '---',
      '',
    ].join('\n');

    const body =
      project.body ??
      [
        '<!-- Replace with a few short bullets. -->',
        '',
        '- What the project does.',
        '- One thing that made it interesting or hard.',
        '- Result, outcome or current status.',
        '',
      ].join('\n');

    await writeFile(path, `${frontmatter}\n${body}\n`, 'utf8');
    added += 1;
  }

  if (errors.length) {
    console.error('✗ Some projects could not be written:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(
    `✓ src/content/projects/ (${added} added${skipped ? `, ${skipped} skipped (use --force to overwrite)` : ''})`,
  );
}

console.log('\nDone. Preview with `npm run dev`.');
