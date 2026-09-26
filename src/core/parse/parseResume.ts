import {
  emptyEntry,
  sortSectionsStandard,
  STANDARD_HEADINGS,
  uid,
  type ContactField,
  type Entry,
  type Resume,
  type Section,
  type SectionKind,
  type SectionLayout,
} from '../schema'
import { lookupHeading, normalizeHeading } from './headingAliases'
import {
  extractContacts,
  extractDates,
  hasContactInfo,
  hasDate,
  isAllCaps,
  isBulletLine,
  isClearEntryHeader,
  isDecorationLine,
  isKeywordTagline,
  isLocation,
  looksIncomplete,
  splitHeaderParts,
  stripBullet,
  trimSeparators,
  wordCount,
} from './patterns'

interface Line {
  text: string
  blankBefore: boolean
}

function toLines(source: string): Line[] {
  const out: Line[] = []
  let blank = true
  for (const raw of source.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n')) {
    const text = raw.replace(/\s+$/, '')
    if (!text.trim() || isDecorationLine(text)) {
      blank = true
      continue
    }
    out.push({ text: text.trim(), blankBefore: blank })
    blank = false
  }
  return out
}

interface HeadingHit {
  kind: SectionKind
  layout: SectionLayout
  heading: string
  /** Text after "Heading:" on the same line, e.g. "Skills: Python, SQL". */
  inline: string
}

function detectHeading(line: Line, current: SectionLayout | undefined): HeadingHit | undefined {
  const text = line.text
  if (isBulletLine(text)) return undefined

  const md = /^#{1,6}\s+(.+)$/.exec(text)
  const candidate = md ? md[1].trim() : text

  const known = lookupHeading(candidate)
  if (known) {
    // Soft headings like "Tech Stack" must not split experience/projects mid-section.
    if (current === 'entries' && known.kind === 'skills') {
      if (/^tech\s*stack$/i.test(normalizeHeading(candidate)) || !line.blankBefore) return undefined
    }
    if (current === 'entries' && known.kind === 'summary' && !line.blankBefore) return undefined
    return { ...known, heading: trimSeparators(candidate.replace(/^#+/, '')), inline: '' }
  }

  // Inside Skills, "Languages: Java, Go" is a skill group, not a new section.
  // Inside entries, "Tech Stack: ..." is project content, not a Skills section.
  const colon = current === 'skills' ? null : /^([^:]{2,40}):\s*(.*)$/.exec(candidate)
  if (colon) {
    const hit = lookupHeading(colon[1])
    if (hit) {
      if (current === 'entries' && hit.kind === 'skills') {
        if (/^tech\s*stack$/i.test(normalizeHeading(colon[1])) || !line.blankBefore) return undefined
      }
      return { ...hit, heading: colon[1].trim(), inline: colon[2].trim() }
    }
  }

  if (md) return { kind: 'custom', layout: 'entries', heading: candidate, inline: '' }

  const words = wordCount(candidate)
  if (words > 6 || candidate.length > 60 || /\d/.test(candidate) || hasContactInfo(candidate)) return undefined
  if (/^[^:]+:$/.test(candidate) && words <= 5) {
    return { kind: 'custom', layout: 'entries', heading: candidate.slice(0, -1).trim(), inline: '' }
  }
  // ALL CAPS section titles often appear without a blank line after the previous paragraph.
  if (isAllCaps(candidate) && words <= 6) {
    const sectionWord = /\b(SKILLS|EXPERIENCE|EDUCATION|PROJECTS|SUMMARY|CERTIFICATIONS|COMPETENCIES|EMPLOYMENT)\b/.test(candidate)
    if (line.blankBefore || sectionWord) {
      return { kind: 'custom', layout: 'entries', heading: candidate, inline: '' }
    }
  }
  return undefined
}

function isSentenceLike(text: string): boolean {
  return text.length > 90 || /[.!?]$/.test(text)
}

function startsLowercase(text: string): boolean {
  return /^[a-z(]/.test(text)
}

// ---------------------------------------------------------------- header

interface HeaderResult {
  name: string
  headline: string
  contact: ContactField[]
  summaryLines: string[]
}

function parseHeader(lines: Line[]): HeaderResult {
  const result: HeaderResult = { name: '', headline: '', contact: [], summaryLines: [] }
  lines.forEach((line, i) => {
    const text = line.text
    const chunks = text.split(/\s*[|•·]\s*|\s{3,}|\t/).filter((c) => c.trim())

    if (i === 0) {
      const first = chunks[0] ?? text
      if (!hasContactInfo(first) && wordCount(first) <= 6 && !isSentenceLike(first)) {
        result.name = stripBullet(first) || first
        chunks.shift()
      }
    }

    // Keep pipe-separated keyword taglines as one contact/other field (or second headline).
    if (isKeywordTagline(text) && !hasContactInfo(text)) {
      if (!result.headline) result.headline = text
      else result.contact.push({ id: uid('c'), kind: 'other', text })
      return
    }

    for (const chunk of chunks) {
      if (hasContactInfo(chunk) || isLocation(chunk) || /^(?:linkedin|github|portfolio|website)$/i.test(chunk.trim())) {
        for (const token of extractContacts(chunk)) result.contact.push({ id: uid('c'), ...token })
      } else if (isSentenceLike(chunk) && wordCount(chunk) > 8) {
        result.summaryLines.push(chunk.trim())
      } else if (!result.headline && result.contact.length === 0) {
        result.headline = trimSeparators(chunk)
      } else {
        result.contact.push({ id: uid('c'), kind: 'other', text: trimSeparators(chunk) })
      }
    }
  })
  return result
}

// ---------------------------------------------------------------- sections

export function parseEntryHeader(entry: Entry, headerLines: string[]): void {
  const parts: string[] = []
  for (const raw of headerLines) {
    let text = raw
    if (!entry.dates) {
      const d = extractDates(text)
      if (d) {
        entry.dates = d.dates
        text = d.rest
      }
    }
    parts.push(...splitHeaderParts(text))
  }
  const remaining: string[] = []
  for (const part of parts) {
    if (!entry.location && isLocation(part)) entry.location = part
    else remaining.push(part)
  }
  entry.title = remaining[0] ?? ''
  entry.subtitle = remaining.slice(1).join(', ')

  // "Company — Job Title" → put the role in title (ATS + common resume convention).
  if (entry.title && entry.subtitle) {
    const roleLike = /\b(engineer|intern|developer|analyst|manager|scientist|architect|consultant|lead|director|specialist)\b/i
    if (roleLike.test(entry.subtitle) && !roleLike.test(entry.title)) {
      ;[entry.title, entry.subtitle] = [entry.subtitle, entry.title]
    }
  }

  // Peel trailing location stuck on title/subtitle: "AI & Data Engineer Indore, India"
  if (!entry.location) {
    for (const field of ['title', 'subtitle'] as const) {
      const peeled = peelTrailingLocation(entry[field])
      if (peeled) {
        entry[field] = peeled.rest
        entry.location = peeled.location
        break
      }
    }
  }
}

/** Pulls a trailing "Remote" / "City, Country" off a title or subtitle. */
function peelTrailingLocation(text: string): { rest: string; location: string } | undefined {
  const t = text.trim()
  if (!t) return undefined
  const remote = /^(.*?)\s+(Remote|Hybrid|On-?site|Work from Home|WFH)$/i.exec(t)
  if (remote && remote[1].trim()) return { rest: remote[1].trim(), location: remote[2] }

  const comma = t.lastIndexOf(',')
  if (comma <= 0) return undefined
  const country = t.slice(comma + 1).trim()
  const before = t.slice(0, comma).trim()
  // Prefer a 1-word city ("Indore, India"), then a 2-word city ("New Delhi, India").
  for (const cityRe of [/^(.*?)\s+(\S+)$/, /^(.*?)\s+(\S+\s+\S+)$/]) {
    const cityMatch = cityRe.exec(before)
    if (!cityMatch || !cityMatch[1].trim()) continue
    const location = `${cityMatch[2]}, ${country}`
    if (wordCount(location) > 4) continue
    if (/\b(engineer|intern|developer|analyst|manager|scientist|architect|consultant)\b/i.test(location)) {
      continue
    }
    if (!isLocation(location) && !/,\s*[A-Z]{2}$/.test(location)) continue
    return { rest: cityMatch[1].trim(), location }
  }
  return undefined
}

function appendContinuation(target: string, text: string): string {
  return target ? `${target} ${text}` : text
}

/** Commas that look like list separators, not thousands (1,000). */
function listCommaCount(text: string): number {
  return (text.match(/,(?!\d)/g) ?? []).length
}

/** "Area Label: What I did..." → keep as one bullet string. */
function labeledAchievement(text: string): string | undefined {
  const m = /^([^:]{3,80}):\s+(.+)$/.exec(text)
  if (!m) return undefined
  const detail = m[2].trim()
  if (detail.length < 25 && !isSentenceLike(detail)) return undefined
  if (/^tech\s*stack$/i.test(m[1]) || /^keywords?$/i.test(m[1])) return undefined
  return text
}

const ACTION_START =
  /^(Architected|Built|Developed|Implemented|Designed|Created|Engineered|Deployed|Integrated|Leveraged|Constructed|Optimized|Delivered|Led|Owned|Fine-tuned|Exposed|Enabled|Automated|Configured|Migrated|Reduced|Improved|Increased|Applied|Trained|Served|Mentored|Containerized|Evaluated|Operated|Orchestrated)\b/i

/** Tech-stack / keyword lines stay as meta text; achievement sentences become bullets. */
function isTechOrMetaLine(line: string): boolean {
  if (/^(tech\s*stack|keywords?)\s*:/i.test(line)) return true
  if (/,\s*Keywords?\s*:/i.test(line) || /\sKeywords?\s*:/i.test(line)) {
    return listCommaCount(line) >= 2 && !ACTION_START.test(line)
  }
  const commas = listCommaCount(line)
  return (
    commas >= 2 &&
    !ACTION_START.test(line) &&
    !labeledAchievement(line) &&
    !/[.!?]$/.test(line.trim()) &&
    wordCount(line) <= 40
  )
}

/** "Project Name — FastAPI, LangGraph, …" (tech glued after em dash). */
function isProjectTitleWithTech(text: string): boolean {
  const m = /^(.+?)\s+[—–]\s+(.+)$/.exec(text.trim())
  if (!m || m[1].trim().length < 8) return false
  const rest = m[2].trim()
  return isTechOrMetaLine(rest) || listCommaCount(rest) >= 2
}

function promoteLinesToBullets(entry: Entry, mode: 'projects' | 'experience'): Entry {
  let { subtitle } = entry
  const seedLines = [...entry.lines]

  // Tech stacks sometimes get stuck on the subtitle during header parsing.
  if (mode === 'projects' && subtitle && isTechOrMetaLine(subtitle)) {
    seedLines.unshift(subtitle)
    subtitle = ''
  }

  if (!seedLines.length) return { ...entry, subtitle }

  const meta: string[] = []
  const bullets = [...entry.bullets]
  for (const line of seedLines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (mode === 'projects' && isTechOrMetaLine(trimmed)) {
      meta.push(trimmed)
      continue
    }
    if (labeledAchievement(trimmed) || ACTION_START.test(trimmed) || (isSentenceLike(trimmed) && trimmed.length > 40)) {
      bullets.push({ id: uid('b'), text: trimmed })
    } else if (mode === 'projects' && wordCount(trimmed) >= 8 && !isTechOrMetaLine(trimmed)) {
      bullets.push({ id: uid('b'), text: trimmed })
    } else {
      meta.push(trimmed)
    }
  }
  return { ...entry, subtitle, lines: meta, bullets }
}

function parseEntries(lines: string[]): Entry[] {
  const entries: Entry[] = []
  let current: Entry | undefined
  let header: string[] = []
  /** Which body part was written last — so wraps attach to Tech Stack lines after bullets, not to the last bullet. */
  let lastBody: 'bullet' | 'line' | undefined

  const finish = () => {
    if (!current) return
    parseEntryHeader(current, header)
    entries.push(current)
    current = undefined
    header = []
    lastBody = undefined
  }

  const hasBody = () => !!current && (current.bullets.length > 0 || current.lines.length > 0)

  const appendToBody = (text: string) => {
    if (!current) return
    if (lastBody === 'line' && current.lines.length) {
      current.lines[current.lines.length - 1] = appendContinuation(current.lines[current.lines.length - 1], text)
    } else if (lastBody === 'bullet' && current.bullets.length) {
      const last = current.bullets[current.bullets.length - 1]
      last.text = appendContinuation(last.text, text)
    } else if (current.lines.length) {
      current.lines[current.lines.length - 1] = appendContinuation(current.lines[current.lines.length - 1], text)
      lastBody = 'line'
    } else if (current.bullets.length) {
      const last = current.bullets[current.bullets.length - 1]
      last.text = appendContinuation(last.text, text)
      lastBody = 'bullet'
    } else {
      current.lines.push(text)
      lastBody = 'line'
    }
  }

  const lastBodyText = () => {
    if (!current) return ''
    if (lastBody === 'line' && current.lines.length) return current.lines[current.lines.length - 1]
    if (lastBody === 'bullet' && current.bullets.length) return current.bullets[current.bullets.length - 1].text
    if (current.lines.length) return current.lines[current.lines.length - 1]
    if (current.bullets.length) return current.bullets[current.bullets.length - 1].text
    return ''
  }

  for (const text of lines) {
    if (isBulletLine(text)) {
      const body = stripBullet(text)
      if (!body) continue // lone "•" markers from PDF/Word dumps
      if (!current) current = emptyEntry()
      current.bullets.push({ id: uid('b'), text: body })
      lastBody = 'bullet'
      continue
    }

    // "Tech Stack: ..." under a project/job is always body content, never a new entry title.
    if (/^tech\s*stack\s*:/i.test(text)) {
      if (!current) current = emptyEntry()
      current.lines.push(text)
      lastBody = 'line'
      continue
    }

    if (current && hasBody()) {
      // Orphan date line after the body (common in education): attach to this entry.
      const onlyDate = extractDates(text)
      if (onlyDate && !onlyDate.rest && !header.some(hasDate)) {
        header.push(text)
        continue
      }
      const prev = lastBodyText()
      const shouldContinue =
        !isClearEntryHeader(text) &&
        !ACTION_START.test(text) &&
        (startsLowercase(text) ||
          looksIncomplete(prev) ||
          (!/[.!?…]$/.test(prev.trim()) && listCommaCount(text) >= 2 && !hasDate(text)))
      if (shouldContinue) {
        appendToBody(text)
        continue
      }
    }

    // "Label: Achievement sentence" under experience/projects → bullet (ATS-friendly).
    const labeled = labeledAchievement(text)
    if (labeled && current && (hasBody() || header.length)) {
      current.bullets.push({ id: uid('b'), text: labeled })
      lastBody = 'bullet'
      continue
    }

    const headerLike = hasDate(text) || !isSentenceLike(text) || isProjectTitleWithTech(text)
    if (!headerLike) {
      if (!current) current = emptyEntry()
      current.lines.push(text)
      lastBody = 'line'
      continue
    }

    if (!current || hasBody()) {
      finish()
      current = emptyEntry()
      header = [text]
      continue
    }

    const headerHasDate = header.some(hasDate)
    if (header.length >= 3 || (headerHasDate && header.length >= 2 && !hasDate(text))) {
      const asBullet = labeledAchievement(text)
      if (asBullet) {
        current.bullets.push({ id: uid('b'), text: asBullet })
        lastBody = 'bullet'
      } else {
        current.lines.push(text)
        lastBody = 'line'
      }
    } else if (isTechOrMetaLine(text)) {
      // Tech stack under a project title is body meta, not part of the title line.
      current.lines.push(text)
      lastBody = 'line'
    } else {
      header.push(text)
    }
  }
  finish()
  return entries
}

function parseList(lines: string[]): Entry[] {
  const entries: Entry[] = []
  for (const raw of lines) {
    const bullet = isBulletLine(raw)
    const text = stripBullet(raw)
    const prev = entries[entries.length - 1]
    if (prev && !bullet && startsLowercase(text)) {
      prev.subtitle = appendContinuation(prev.subtitle, text)
      continue
    }
    // List items keep their own punctuation; only a trailing date is lifted out.
    const d = extractDates(text)
    entries.push(emptyEntry(d && d.rest ? { title: d.rest, dates: d.dates } : { title: text }))
  }
  return entries
}

function parseSkills(lines: string[]): Entry[] {
  // Join wrapped continuations first.
  const joined: string[] = []
  for (const raw of lines) {
    const text = stripBullet(raw)
    const prev = joined[joined.length - 1]
    const nextIsLabeled = /^[^:]{1,40}:\s*.+/.test(text)
    const prevIsShortLabel = !!prev && !prev.includes(',') && wordCount(prev) <= 5 && prev.length <= 40
    // Only join true wraps (incomplete end / lowercase / short capital fragment),
    // or the rest of an open "Category: items..." skill group cut mid-line.
    const prevIsOpenGroup = !!prev && /^[^:]{1,40}:\s*.+/.test(prev) && !/[.!?]$/.test(prev.trim())
    if (
      prev &&
      !nextIsLabeled &&
      !prevIsShortLabel &&
      (startsLowercase(text) ||
        looksIncomplete(prev) ||
        prevIsOpenGroup ||
        (wordCount(text) <= 3 && !text.includes(',') && !/[.!?…:]$/.test(prev.trim()) && /^[\p{Lu}]/u.test(text)))
    ) {
      joined[joined.length - 1] = appendContinuation(prev, text)
      continue
    }
    joined.push(text)
  }

  // Two-column PDF/Word dump: N short category labels, then N value lines.
  const isLabel = (t: string) =>
    !t.includes(',') && wordCount(t) <= 5 && t.length <= 40 && !/^[^:]{1,40}:\s*.+/.test(t)
  const isValue = (t: string) => t.includes(',') || /^[^:]{1,40}:\s*.+/.test(t) || wordCount(t) > 5

  let labelCount = 0
  while (labelCount < joined.length && isLabel(joined[labelCount])) labelCount++
  const values = joined.slice(labelCount)
  if (labelCount >= 3 && values.length === labelCount && values.every(isValue)) {
    return joined.slice(0, labelCount).map((title, i) => emptyEntry({ title, lines: [values[i]] }))
  }

  const entries: Entry[] = []
  for (const text of joined) {
    const m = /^([^:]{1,40}):\s*(.+)$/.exec(text)
    entries.push(m ? emptyEntry({ title: m[1].trim(), lines: [m[2].trim()] }) : emptyEntry({ lines: [text] }))
  }
  return entries
}

function parseParagraph(lines: string[]): Entry[] {
  const entry = emptyEntry()
  for (const raw of lines) {
    if (isBulletLine(raw)) {
      entry.bullets.push({ id: uid('b'), text: stripBullet(raw) })
      continue
    }
    const last = entry.lines[entry.lines.length - 1]
    if (last !== undefined && !/[.!?:]$/.test(last)) entry.lines[entry.lines.length - 1] = `${last} ${raw}`
    else entry.lines.push(raw)
  }
  return entry.lines.length || entry.bullets.length ? [entry] : []
}

function guessCustomLayout(lines: string[]): SectionLayout {
  const bullets = lines.filter(isBulletLine).length
  const dated = lines.filter(hasDate).length
  if (bullets > 0 && bullets < lines.length) return 'entries'
  if (dated > 0 && bullets === 0 && dated < lines.length / 2) return 'entries'
  return 'list'
}

export function buildSection(
  kind: SectionKind,
  layout: SectionLayout,
  heading: string,
  lines: string[],
): Section {
  const parsers: Record<SectionLayout, (l: string[]) => Entry[]> = {
    paragraph: parseParagraph,
    skills: parseSkills,
    entries: parseEntries,
    list: parseList,
  }
  let entries = parsers[layout](lines)
  if (layout === 'entries' && (kind === 'projects' || kind === 'experience')) {
    entries = entries.map((e) => promoteLinesToBullets(e, kind))
  }
  return {
    id: uid('s'),
    kind,
    layout,
    originalHeading: heading,
    heading: heading || STANDARD_HEADINGS[kind],
    entries,
  }
}

/** Re-runs line grouping for a section, e.g. after the user changes its type. */
export function reparseSection(section: Section, kind: SectionKind, layout: SectionLayout): Section {
  const lines = sectionToLines(section)
  return { ...buildSection(kind, layout, section.originalHeading, lines), id: section.id, heading: section.heading }
}

export function sectionToLines(section: Section): string[] {
  const lines: string[] = []
  for (const e of section.entries) {
    const head = [e.title, e.subtitle, e.location, e.dates].filter(Boolean)
    if (section.layout === 'skills' && e.title) {
      lines.push(`${e.title}: ${e.lines.join(' ')}`)
    } else {
      if (head.length) lines.push(head.join(' | '))
      lines.push(...e.lines)
    }
    lines.push(...e.bullets.map((b) => `• ${b.text}`))
  }
  return lines
}

// ---------------------------------------------------------------- main

export function parseResume(sourceText: string): Resume {
  const lines = toLines(sourceText)
  const headerLines: Line[] = []
  const blocks: { hit: HeadingHit; lines: string[] }[] = []

  lines.forEach((line, i) => {
    const hit = i === 0 ? undefined : detectHeading(line, blocks[blocks.length - 1]?.hit.layout)
    if (hit) {
      blocks.push({ hit, lines: hit.inline ? [hit.inline] : [] })
      return
    }
    if (blocks.length === 0) headerLines.push(line)
    else blocks[blocks.length - 1].lines.push(line.text)
  })

  // When real section headings exist, everything before the first heading is
  // the header (name, headline, contact, tagline). findHeaderEnd is only for
  // heading-less paste dumps.
  const headerEnd = blocks.length > 0 ? headerLines.length : findHeaderEnd(headerLines)
  const header = parseHeader(headerLines.slice(0, headerEnd))
  const unsorted: string[] = headerLines.slice(headerEnd).map((l) => l.text)
  const sections: Section[] = []

  if (header.summaryLines.length && !blocks.some((b) => b.hit.kind === 'summary')) {
    sections.push(buildSection('summary', 'paragraph', '', header.summaryLines))
  } else if (header.summaryLines.length) {
    header.contact.push(...header.summaryLines.map((text) => ({ id: uid('c'), kind: 'other' as const, text })))
  }

  for (const block of blocks) {
    if (block.lines.length === 0) {
      unsorted.push(block.hit.heading)
      continue
    }
    let { kind, layout } = block.hit
    if (kind === 'custom' && !lookupHeading(block.hit.heading)) layout = guessCustomLayout(block.lines)
    const existing = sections.find(
      (s) => s.kind === kind && kind !== 'custom' && normalizeHeading(s.originalHeading) === normalizeHeading(block.hit.heading),
    )
    const section = buildSection(kind, layout, block.hit.heading, block.lines)
    if (existing) existing.entries.push(...section.entries)
    else if (section.entries.length) sections.push(section)
    else unsorted.push(...block.lines)
  }

  return {
    name: header.name,
    headline: header.headline,
    contact: header.contact,
    sections: sortSectionsStandard(sections),
    unsorted,
    discarded: [],
    sourceText,
  }
}

/**
 * The header is the name plus contact/headline lines at the top. Anything
 * after that but before the first heading goes to "Unsorted" (or Summary if
 * it reads like sentences) so it is never silently absorbed as contact info.
 */
function findHeaderEnd(lines: Line[]): number {
  let i = 0
  let sawContact = false
  for (; i < lines.length; i++) {
    const text = lines[i].text
    if (i === 0) continue
    if (hasContactInfo(text) || (isLocation(text) && sawContact)) {
      sawContact = true
      continue
    }
    if (isKeywordTagline(text)) continue
    if (!sawContact && wordCount(text) <= 8 && !isBulletLine(text) && !hasDate(text) && !isSentenceLike(text)) {
      continue // headline / title before contact
    }
    if (isSentenceLike(text) && wordCount(text) > 8) continue // inline summary
    break
  }
  return i
}
