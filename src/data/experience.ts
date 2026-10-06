import raw from './experience.json';

export interface ExperienceEntry {
  id: string;
  role: string;
  org: string;
  /** YYYY-MM */
  start: string;
  /** YYYY-MM, or null/omitted for "present" */
  end?: string | null;
  location?: string;
  bullets?: string[];
  tags?: string[];
}

/**
 * Work experience, most recent first.
 * Add entries in `experience.json` (copy the shape from experience.example.json),
 * or run `npm run new:job` / `npm run import`.
 */
const entries: ExperienceEntry[] = raw;

export const experience: ExperienceEntry[] = entries
  .slice()
  .sort((a, b) => b.start.localeCompare(a.start));
