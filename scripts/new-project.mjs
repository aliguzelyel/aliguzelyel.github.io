#!/usr/bin/env node
/**
 * npm run new:project
 * Interactively scaffolds a project file in src/content/projects/<slug>.md
 */
import { access, writeFile } from 'node:fs/promises';
import { createPrompt } from './lib/prompt.mjs';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const fileUrl = (relative) => new URL(relative, import.meta.url);

const exists = (url) =>
  access(url).then(
    () => true,
    () => false,
  );

const prompt = await createPrompt();
const ask = prompt.ask;

try {
  console.log(
    'New project (press Enter to accept the defaults in parentheses).\n',
  );

  const title = await ask('Title', 'My Project');
  const slug = slugify(await ask('Slug', title));
  const summary = await ask(
    'Summary (max 160 chars)',
    'One-line description for cards.',
  );
  const repo = await ask('Repository URL (blank to skip)', '');
  const demo = await ask('Demo URL (blank to skip)', '');
  const tags = await ask('Tags (comma separated)', 'web');
  const featured =
    (await ask('Featured on home page? (y/n)', 'n')).toLowerCase() === 'y';

  const path = fileUrl(`../src/content/projects/${slug}.md`);
  if (await exists(path)) {
    console.error(
      `\n✗ src/content/projects/${slug}.md already exists; nothing written.`,
    );
    process.exitCode = 1;
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `summary: ${JSON.stringify(summary)}`,
      ...(repo ? [`repo: ${repo}`] : []),
      ...(demo ? [`demo: ${demo}`] : []),
      `date: ${today}`,
      'status: wip',
      `tags: [${tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .join(', ')}]`,
      `featured: ${featured}`,
      '---',
      '',
      '<!-- Keep the body simple: a few short bullets (3-6). -->',
      '',
      '- What the project does.',
      '- One thing that made it interesting or hard.',
      '- Result, outcome or current status.',
      '',
    ].join('\n');

    await writeFile(path, frontmatter, 'utf8');
    console.log(`\n✓ Created src/content/projects/${slug}.md`);
    console.log('  Edit the body, then run `npm run dev` to preview.');
  }
} finally {
  prompt.close();
}
