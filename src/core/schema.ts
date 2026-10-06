export type SectionKind =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'custom'

/**
 * How a section's lines are grouped:
 * - paragraph: free text (summary)
 * - skills: one line per skill group, optional "Category: items"
 * - entries: header lines (title/org/dates/location) followed by bullets
 * - list: one entry per line (certifications, awards, languages...)
 */
export type SectionLayout = 'paragraph' | 'skills' | 'entries' | 'list'

export type ContactKind = 'email' | 'phone' | 'linkedin' | 'github' | 'url' | 'location' | 'other'

export interface ContactField {
  id: string
  kind: ContactKind
  text: string
}

export interface Bullet {
  id: string
  text: string
}

/**
 * All text fields hold the user's words verbatim. Parsing only splits lines
 * into fields and strips list markers / separators; it never rewrites words.
 */
export interface Entry {
  id: string
  title: string
  subtitle: string
  dates: string
  location: string
  /** Non-bullet body text (paragraphs, or the items of a skills group). */
  lines: string[]
  bullets: Bullet[]
}

export interface Section {
  id: string
  kind: SectionKind
  layout: SectionLayout
  /** Heading as the user wrote it (empty if the content had no heading). */
  originalHeading: string
  /** Heading used when "standard headings" is off, or for custom sections. */
  heading: string
  entries: Entry[]
}

export interface Resume {
  name: string
  headline: string
  contact: ContactField[]
  sections: Section[]
  /** Lines the parser could not place. Never rendered, never discarded. */
  unsorted: string[]
  /** Text the user deliberately removed; excluded from "missing words" warnings. */
  discarded: string[]
  /** The exact text the user provided, kept for the verbatim check. */
  sourceText: string
}

export type TemplateId = 'jake' | 'deedy' | 'classic' | 'modern' | 'compact'
export type PageSize = 'letter' | 'a4'
export type FontFamily = 'Calibri' | 'Arial' | 'Garamond' | 'Georgia' | 'Times New Roman'

export interface LayoutSettings {
  template: TemplateId
  font: FontFamily
  pageSize: PageSize
  pageTarget: 1 | 2
  autoFit: boolean
  /** Body font size in points. */
  fontSize: number
  /** Line height multiplier (1.0 = single). */
  lineSpacing: number
  /** Page margin in inches (all sides). */
  marginIn: number
  /** Space before each section heading, in points. */
  sectionSpacingPt: number
  useStandardHeadings: boolean
}

export interface Draft {
  id: string
  title: string
  updatedAt: number
  resume: Resume
  settings: LayoutSettings
}

export const STANDARD_HEADINGS: Record<SectionKind, string> = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  custom: '',
}

export const DEFAULT_LAYOUT: Record<SectionKind, SectionLayout> = {
  summary: 'paragraph',
  skills: 'skills',
  experience: 'entries',
  projects: 'entries',
  education: 'entries',
  certifications: 'list',
  custom: 'entries',
}

/** Recommended ATS order; custom sections go last in their original order. */
export const STANDARD_ORDER: SectionKind[] = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'custom',
]

export const DEFAULT_SETTINGS: LayoutSettings = {
  template: 'jake',
  font: 'Times New Roman',
  pageSize: 'letter',
  pageTarget: 1,
  autoFit: true,
  fontSize: 10.5,
  lineSpacing: 1.08,
  marginIn: 0.55,
  sectionSpacingPt: 8,
  // Keep the user's section headings by default — never replace their wording.
  useStandardHeadings: false,
}

const TEMPLATE_IDS: TemplateId[] = ['jake', 'deedy', 'classic', 'modern', 'compact']
const FONT_IDS: FontFamily[] = ['Calibri', 'Arial', 'Garamond', 'Georgia', 'Times New Roman']

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Coerce draft / untrusted settings into a safe LayoutSettings object. */
export function sanitizeLayoutSettings(raw: Partial<LayoutSettings> | undefined | null): LayoutSettings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  return {
    template: TEMPLATE_IDS.includes(s.template) ? s.template : DEFAULT_SETTINGS.template,
    font: FONT_IDS.includes(s.font) ? s.font : DEFAULT_SETTINGS.font,
    pageSize: s.pageSize === 'a4' ? 'a4' : 'letter',
    pageTarget: s.pageTarget === 2 ? 2 : 1,
    autoFit: Boolean(s.autoFit),
    fontSize: clamp(Number(s.fontSize), 10, 12, DEFAULT_SETTINGS.fontSize),
    lineSpacing: clamp(Number(s.lineSpacing), 1, 1.3, DEFAULT_SETTINGS.lineSpacing),
    marginIn: clamp(Number(s.marginIn), 0.5, 1, DEFAULT_SETTINGS.marginIn),
    sectionSpacingPt: clamp(Number(s.sectionSpacingPt), 4, 16, DEFAULT_SETTINGS.sectionSpacingPt),
    useStandardHeadings: Boolean(s.useStandardHeadings),
  }
}

let idCounter = 0
export function uid(prefix = 'id'): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function emptyEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: uid('e'),
    title: '',
    subtitle: '',
    dates: '',
    location: '',
    lines: [],
    bullets: [],
    ...partial,
  }
}

export function sortSectionsStandard(sections: Section[]): Section[] {
  return sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => STANDARD_ORDER.indexOf(a.s.kind) - STANDARD_ORDER.indexOf(b.s.kind) || a.i - b.i)
    .map(({ s }) => s)
}

export function sectionDisplayHeading(section: Section, useStandard: boolean): string {
  const standard = STANDARD_HEADINGS[section.kind]
  if (useStandard && standard) return standard
  return section.heading || section.originalHeading || standard || 'Additional Information'
}
