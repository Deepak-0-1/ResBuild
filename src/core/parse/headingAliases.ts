import type { SectionKind, SectionLayout } from '../schema'

interface HeadingRule {
  kind: SectionKind
  layout: SectionLayout
  aliases: string[]
}

const RULES: HeadingRule[] = [
  {
    kind: 'summary',
    layout: 'paragraph',
    aliases: [
      'summary',
      'professional summary',
      'career summary',
      'profile',
      'professional profile',
      'about',
      'about me',
      'objective',
      'career objective',
      'overview',
      'executive summary',
      'personal statement',
    ],
  },
  {
    kind: 'skills',
    layout: 'skills',
    aliases: [
      'skills',
      'technical skills',
      'core technical skills',
      'key skills',
      'core skills',
      'core competencies',
      'technical competencies',
      'core technical competencies',
      'competencies',
      'areas of expertise',
      'expertise',
      'skills and tools',
      'skills & tools',
      'tools and technologies',
      'tools & technologies',
      'technologies',
      'tech stack',
      'skill set',
      'skillset',
    ],
  },
  {
    kind: 'experience',
    layout: 'entries',
    aliases: [
      'experience',
      'work experience',
      'professional experience',
      'employment',
      'employment history',
      'work history',
      'career history',
      'relevant experience',
      'internships',
      'internship',
      'internship experience',
      'professional background',
    ],
  },
  {
    kind: 'projects',
    layout: 'entries',
    aliases: [
      'projects',
      'project',
      'personal projects',
      'academic projects',
      'key projects',
      'selected projects',
      'project experience',
      'side projects',
      'key platform & ai projects',
      'key platform and ai projects',
      'platform & ai projects',
      'platform and ai projects',
      'key platform projects',
      'notable projects',
      'selected project work',
    ],
  },
  {
    kind: 'education',
    layout: 'entries',
    aliases: [
      'education',
      'academic background',
      'academics',
      'educational background',
      'education and training',
      'education & training',
      'education & certifications',
      'education and certifications',
      'education and certificates',
      'qualifications',
      'academic qualifications',
    ],
  },
  {
    kind: 'certifications',
    layout: 'list',
    aliases: [
      'certifications',
      'certification',
      'certificates',
      'licenses',
      'licenses and certifications',
      'licenses & certifications',
      'certifications and licenses',
      'courses',
      'training',
    ],
  },
  {
    kind: 'custom',
    layout: 'list',
    aliases: [
      'awards',
      'honors',
      'honors and awards',
      'awards and honors',
      'achievements',
      'accomplishments',
      'languages',
      'interests',
      'hobbies',
      'publications',
      'activities',
      'extracurricular activities',
      'extra curricular activities',
      'references',
      'additional information',
    ],
  },
  {
    kind: 'custom',
    layout: 'entries',
    aliases: [
      'volunteer',
      'volunteering',
      'volunteer experience',
      'leadership',
      'leadership experience',
      'positions of responsibility',
    ],
  },
]

const ALIAS_MAP = new Map<string, { kind: SectionKind; layout: SectionLayout }>()
for (const rule of RULES) {
  for (const alias of rule.aliases) ALIAS_MAP.set(alias, { kind: rule.kind, layout: rule.layout })
}

/** Sorted longest-first so "technical skills" wins over "skills". */
const ALIASES_BY_LENGTH = [...ALIAS_MAP.keys()].sort((a, b) => b.length - a.length)

export function normalizeHeading(text: string): string {
  return text
    .replace(/^[#=*_\-\s]+|[#=*_\-:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Resolves a section heading. Exact match first. Fuzzy match only on short
 * heading-like strings so paragraph text that happens to contain "experience"
 * or "training" is never treated as a section title.
 */
export function lookupHeading(text: string): { kind: SectionKind; layout: SectionLayout } | undefined {
  const n = normalizeHeading(text)
  if (!n) return undefined

  const exact = ALIAS_MAP.get(n)
  if (exact) return exact

  const words = n.split(/\s+/).filter(Boolean).length
  // Paragraphs and achievement lines are not headings.
  if (words > 8 || n.length > 72) return undefined

  for (const alias of ALIASES_BY_LENGTH) {
    if (alias.length < 6) continue
    if (
      n.endsWith(alias) ||
      n.startsWith(`${alias} `) ||
      n.endsWith(` & ${alias}`) ||
      n.endsWith(` and ${alias}`) ||
      n.startsWith(`${alias} &`) ||
      n.startsWith(`${alias} and`)
    ) {
      return ALIAS_MAP.get(alias)
    }
  }

  // Keyword endings for novel but clearly sectional titles.
  if (/\b(technical\s+)?skills\b$|\bcompetencies\b$|\bexpertise\b$/.test(n)) {
    return { kind: 'skills', layout: 'skills' }
  }
  if (/\b(work|professional|employment)\s+experience\b$|\bexperience\b$|\bemployment\b$|\bhistory\b$/.test(n)) {
    return { kind: 'experience', layout: 'entries' }
  }
  if (/\bprojects?\b$/.test(n)) return { kind: 'projects', layout: 'entries' }
  if (/\beducation\b/.test(n)) return { kind: 'education', layout: 'entries' }
  if (/^(certifications?|licenses?|courses)\b/.test(n)) return { kind: 'certifications', layout: 'list' }
  if (/\b(summary|objective|profile)\b$/.test(n)) return { kind: 'summary', layout: 'paragraph' }

  return undefined
}

export function isKnownStandardHeading(text: string): boolean {
  const n = normalizeHeading(text)
  if (ALIAS_MAP.has(n)) return true
  // Fuzzy hits count as known for ATS "standard heading" tips.
  return lookupHeading(text) !== undefined
}
