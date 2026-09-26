import { buildSection, parseEntryHeader, reparseSection, sectionToLines } from './parse/parseResume'
import {
  DEFAULT_LAYOUT,
  emptyEntry,
  STANDARD_HEADINGS,
  uid,
  type Entry,
  type Resume,
  type Section,
  type SectionKind,
  type SectionLayout,
} from './schema'

/**
 * Pure editing operations for the Review screen. Each returns a new Resume.
 * Structural operations never drop words: removed content goes to
 * `unsorted`, and only an explicit "discard" moves it to `discarded`.
 */

function clone(resume: Resume): Resume {
  return structuredClone(resume)
}

function findSection(r: Resume, sectionId: string): Section {
  const s = r.sections.find((x) => x.id === sectionId)
  if (!s) throw new Error(`Section ${sectionId} not found`)
  return s
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function reorderSections(resume: Resume, from: number, to: number): Resume {
  return { ...resume, sections: moveItem(resume.sections, from, to) }
}

export function reorderEntries(resume: Resume, sectionId: string, from: number, to: number): Resume {
  const r = clone(resume)
  const s = findSection(r, sectionId)
  s.entries = moveItem(s.entries, from, to)
  return r
}

export function changeSectionKind(resume: Resume, sectionId: string, kind: SectionKind): Resume {
  const r = clone(resume)
  const idx = r.sections.findIndex((s) => s.id === sectionId)
  const s = r.sections[idx]
  const layout = kind === 'custom' ? s.layout : DEFAULT_LAYOUT[kind]
  const next = layout === s.layout ? { ...s, kind } : reparseSection(s, kind, layout)
  if (kind !== 'custom' && !next.heading) next.heading = STANDARD_HEADINGS[kind]
  r.sections[idx] = next
  return r
}

export function changeSectionLayout(resume: Resume, sectionId: string, layout: SectionLayout): Resume {
  const r = clone(resume)
  const idx = r.sections.findIndex((s) => s.id === sectionId)
  r.sections[idx] = reparseSection(r.sections[idx], r.sections[idx].kind, layout)
  return r
}

export function renameSection(resume: Resume, sectionId: string, heading: string): Resume {
  const r = clone(resume)
  findSection(r, sectionId).heading = heading
  return r
}

export function removeSection(resume: Resume, sectionId: string): Resume {
  const r = clone(resume)
  const s = findSection(r, sectionId)
  r.unsorted.push(...[s.originalHeading, ...sectionToLines(s)].filter(Boolean))
  r.sections = r.sections.filter((x) => x.id !== sectionId)
  return r
}

/** Folds a section that was wrongly detected (e.g. an ALL-CAPS company name) into the one above. */
export function mergeSectionIntoPrevious(resume: Resume, sectionId: string): Resume {
  const r = clone(resume)
  const idx = r.sections.findIndex((s) => s.id === sectionId)
  if (idx <= 0) return resume
  const prev = r.sections[idx - 1]
  const cur = r.sections[idx]
  const lines = [cur.originalHeading, ...sectionToLines(cur)].filter(Boolean)
  prev.entries.push(...buildSection(prev.kind, prev.layout, '', lines).entries)
  r.sections.splice(idx, 1)
  return r
}

export function addSection(resume: Resume, kind: SectionKind = 'custom'): Resume {
  const r = clone(resume)
  const section: Section = {
    id: uid('s'),
    kind,
    layout: DEFAULT_LAYOUT[kind] === 'entries' && kind === 'custom' ? 'list' : DEFAULT_LAYOUT[kind],
    originalHeading: '',
    heading: STANDARD_HEADINGS[kind] || 'Additional Information',
    entries: [],
  }
  r.sections.push(section)
  return r
}

function entryToLines(section: Section, entry: Entry): string[] {
  return sectionToLines({ ...section, entries: [entry] })
}

export function moveEntryToSection(resume: Resume, fromId: string, entryId: string, toId: string): Resume {
  if (fromId === toId) return resume
  const r = clone(resume)
  const from = findSection(r, fromId)
  const to = findSection(r, toId)
  const entry = from.entries.find((e) => e.id === entryId)
  if (!entry) return resume
  from.entries = from.entries.filter((e) => e.id !== entryId)
  if (from.layout === to.layout) to.entries.push(entry)
  else to.entries.push(...buildSection(to.kind, to.layout, '', entryToLines(from, entry)).entries)
  return r
}

export function removeEntry(resume: Resume, sectionId: string, entryId: string): Resume {
  const r = clone(resume)
  const s = findSection(r, sectionId)
  const entry = s.entries.find((e) => e.id === entryId)
  if (!entry) return resume
  r.unsorted.push(...entryToLines(s, entry))
  s.entries = s.entries.filter((e) => e.id !== entryId)
  return r
}

export function mergeEntryWithPrevious(resume: Resume, sectionId: string, entryId: string): Resume {
  const r = clone(resume)
  const s = findSection(r, sectionId)
  const idx = s.entries.findIndex((e) => e.id === entryId)
  if (idx <= 0) return resume
  const prev = s.entries[idx - 1]
  const cur = s.entries[idx]
  const leftovers: string[] = []
  for (const field of ['title', 'subtitle', 'dates', 'location'] as const) {
    if (!cur[field]) continue
    if (!prev[field]) prev[field] = cur[field]
    else leftovers.push(cur[field])
  }
  if (leftovers.length) prev.lines.push(leftovers.join(' | '))
  prev.lines.push(...cur.lines)
  prev.bullets.push(...cur.bullets)
  s.entries.splice(idx, 1)
  return r
}

/** Starts a new entry at a bullet that is really a job/project header line. */
export function splitEntryAtBullet(resume: Resume, sectionId: string, entryId: string, bulletId: string): Resume {
  const r = clone(resume)
  const s = findSection(r, sectionId)
  const idx = s.entries.findIndex((e) => e.id === entryId)
  const entry = s.entries[idx]
  const bIdx = entry.bullets.findIndex((b) => b.id === bulletId)
  if (bIdx < 0) return resume
  const [headerBullet, ...rest] = entry.bullets.slice(bIdx)
  entry.bullets = entry.bullets.slice(0, bIdx)
  const next = emptyEntry({ bullets: rest })
  if (s.layout === 'skills') {
    next.lines = [headerBullet.text]
  } else {
    parseEntryHeader(next, [headerBullet.text])
  }
  s.entries.splice(idx + 1, 0, next)
  return r
}

export function swapTitleSubtitle(resume: Resume, sectionId: string, entryId: string): Resume {
  const r = clone(resume)
  const e = findSection(r, sectionId).entries.find((x) => x.id === entryId)
  if (e) [e.title, e.subtitle] = [e.subtitle, e.title]
  return r
}

export function updateEntry(resume: Resume, sectionId: string, entryId: string, patch: Partial<Entry>): Resume {
  const r = clone(resume)
  const e = findSection(r, sectionId).entries.find((x) => x.id === entryId)
  if (e) Object.assign(e, patch)
  return r
}

export function moveBullet(resume: Resume, sectionId: string, entryId: string, from: number, to: number): Resume {
  const r = clone(resume)
  const e = findSection(r, sectionId).entries.find((x) => x.id === entryId)
  if (!e || to < 0 || to >= e.bullets.length) return resume
  e.bullets = moveItem(e.bullets, from, to)
  return r
}

export function removeBullet(resume: Resume, sectionId: string, entryId: string, bulletId: string): Resume {
  const r = clone(resume)
  const e = findSection(r, sectionId).entries.find((x) => x.id === entryId)
  const b = e?.bullets.find((x) => x.id === bulletId)
  if (!e || !b) return resume
  r.unsorted.push(`• ${b.text}`)
  e.bullets = e.bullets.filter((x) => x.id !== bulletId)
  return r
}

export function placeUnsorted(resume: Resume, index: number, sectionId: string): Resume {
  const r = clone(resume)
  const line = r.unsorted[index]
  if (line === undefined) return resume
  const s = findSection(r, sectionId)
  const text = line.replace(/^\s*[•\-*]\s*/, '')
  if (s.layout === 'entries') {
    const last = s.entries[s.entries.length - 1]
    if (last) last.bullets.push({ id: uid('b'), text })
    else s.entries.push(...buildSection(s.kind, s.layout, '', [line]).entries)
  } else if (s.layout === 'paragraph') {
    if (s.entries[0]) s.entries[0].lines.push(text)
    else s.entries.push(emptyEntry({ lines: [text] }))
  } else {
    s.entries.push(...buildSection(s.kind, s.layout, '', [text]).entries)
  }
  r.unsorted.splice(index, 1)
  return r
}

export function discardUnsorted(resume: Resume, index: number): Resume {
  const r = clone(resume)
  const [line] = r.unsorted.splice(index, 1)
  if (line !== undefined) r.discarded.push(line)
  return r
}
