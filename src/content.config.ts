import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(160),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    date: z.coerce.date(),
    status: z.enum(['shipped', 'wip', 'archived']),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

export const collections = { projects };
