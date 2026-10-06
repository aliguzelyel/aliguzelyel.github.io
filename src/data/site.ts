import raw from './profile.json';

export interface Fact {
  label: string;
  value: string;
}

export interface Education {
  id: string;
  degree: string;
  org: string;
  start: string;
  end: string | null;
}

export interface Profile {
  name: string;
  role: string;
  location: string | null;
  tagline: string;
  description: string;
  email: string | null;
  github: string | null;
  linkedin: string | null;
  facts: Fact[];
  education: Education[];
  skills: string[];
}

export const site: Profile = raw;
