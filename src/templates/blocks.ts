import {
  sectionDisplayHeading,
  type ContactField,
  type ContactKind,
  type LayoutSettings,
  type Resume,
  type Entry,
  type Section,
} from '../core/schema'
import type { TemplateSpec } from './types'

export type Block =
  | { type: 'name'; text: string }
  | { type: 'headline'; text: string }
  | { type: 'contact'; parts: { kind: ContactKind; text: string }[] }
  | {
      type: 'splitHeader'
      name: string
      leftExtra: string
      rightParts: { kind: ContactKind; text: string; label: string }[]
    }
  | { type: 'headerRule' }
  | { type: 'heading'; text: string; first: boolean }
  | {
      type: 'entryLine'
      left: string
      right: string
      bold: boolean
      italic: boolean
      /** When set, render bold through this prefix only (e.g. school name). */
      leftBoldThru?: string
      /** Jake projects: "Name | Tech" with name bold and tech italic. */
      leftPipe?: { before: string; after: string }
      /** Deedy: solid bullet before the org/school line. */
      bulletMarker?: boolean
      gapBefore: boolean
    }
  | {
      type: 'paragraph'
      text: string
      label?: string
      gapBefore: boolean
      tone?: 'default' | 'tech' | 'keywords' | 'muted'
    }
  /** Two-column skills row: bold category | skill list (tabular look, ATS-readable order). */
  | { type: 'skillRow'; label: string; text: string }
  | { type: 'bullet'; text: string; emphasizePrefix: boolean; nested?: boolean }

function entryBlocks(entry: Entry, section: Section, template: TemplateSpec, index: number): Block[] {
  const out: Block[] = []
  const gapBefore = index > 0
  let gapUsed = false
  const gap = () => {
    const g = gapBefore && !gapUsed
    gapUsed = true
    return g
  }

  if (section.layout === 'skills') {
    for (const line of entry.lines) {
      const split = splitSkillLine(line, entry.title)
      const label = (split.label || '').replace(/:\s*$/, '')
      if (template.skillsTable) {
        out.push({ type: 'skillRow', label, text: split.text })
      } else {
        out.push({
          type: 'paragraph',
          text: split.text,
          label: label || undefined,
          gapBefore: false,
        })
      }
    }
    if (!entry.lines.length && entry.title) {
      if (template.skillsTable) {
        out.push({ type: 'skillRow', label: '', text: entry.title })
      } else {
        out.push({ type: 'paragraph', text: entry.title, gapBefore: false })
      }
    }
  } else if (section.layout === 'list') {
    if (template.joinListWithDots && section.kind === 'certifications') {
      // Section-level join in buildBlocks.
    } else {
      const left = [entry.title, entry.subtitle].filter(Boolean).join(', ')
      const right = [entry.location, entry.dates].filter(Boolean).join(' | ')
      if (left || right) out.push({ type: 'entryLine', left, right, bold: false, italic: false, gapBefore: false })
    }
  } else if (section.layout === 'entries') {
    if (section.kind === 'experience') {
      pushExperienceHeader(out, entry, template, gap)
    } else if (section.kind === 'projects') {
      const result = pushProjectHeader(out, entry, template, gap)
      entry = result.entry
    } else if (section.kind === 'education') {
      pushEducationHeader(out, entry, template, gap)
    } else {
      const title = entry.title || entry.subtitle
      const subtitle = entry.title ? entry.subtitle : ''
      if (title || entry.dates) {
        const right = subtitle || !entry.location ? entry.dates : [entry.location, entry.dates].filter(Boolean).join(' | ')
        out.push({
          type: 'entryLine',
          left: title,
          right,
          bold: true,
          italic: false,
          bulletMarker: template.entryBulletMarker,
          gapBefore: gap(),
        })
      }
      if (subtitle) {
        out.push({
          type: 'entryLine',
          left: subtitle,
          right: entry.location,
          bold: false,
          italic: template.subtitleItalic,
          gapBefore: gap(),
        })
      } else if (!title && entry.location) {
        out.push({ type: 'entryLine', left: '', right: entry.location, bold: false, italic: false, gapBefore: gap() })
      }
    }
  }

  if (section.layout !== 'skills') {
    for (const line of entry.lines) {
      if (section.kind === 'projects' && template.projectTitleStyle === 'namePipeTech' && isProjectTechLine(line)) {
        // Tech already folded into the title line for Jake.
        continue
      }
      if (/^keywords?\s*:/i.test(line)) {
        out.push({
          type: 'paragraph',
          text: line,
          gapBefore: gap(),
          tone: template.skillsTable ? 'keywords' : 'default',
        })
      } else if (/^tech\s*stack\s*:/i.test(line) || looksLikeTechStack(line) || hasInlineKeywords(line)) {
        if (template.projectTitleStyle === 'namePipeTech') continue
        pushProjectMeta(out, line, gap, template)
      } else if (section.kind === 'projects') {
        out.push({
          type: 'bullet',
          text: line,
          emphasizePrefix: template.boldBulletPrefix,
          nested: template.nestedBullets,
        })
      } else if (section.kind === 'education') {
        out.push({ type: 'paragraph', text: line, gapBefore: gap(), tone: 'muted' })
      } else {
        out.push({ type: 'paragraph', text: line, gapBefore: gap() })
      }
    }
  }

  const emphasize =
    template.boldBulletPrefix && (section.kind === 'experience' || section.kind === 'projects')
  for (const b of entry.bullets) {
    if (b.text.trim()) {
      out.push({
        type: 'bullet',
        text: b.text,
        emphasizePrefix: emphasize,
        nested: template.nestedBullets && section.kind === 'experience',
      })
    }
  }
  return out
}

function pushExperienceHeader(
  out: Block[],
  entry: Entry,
  template: TemplateSpec,
  gap: () => boolean,
): void {
  if (template.companyRoleLine || template.experienceOrder === 'combined') {
    const company = entry.subtitle
    const role = entry.title
    const left = company && role ? `${company} — ${role}` : role || company
    const right = [entry.location, entry.dates].filter(Boolean).join(' | ')
    if (left || right) {
      out.push({
        type: 'entryLine',
        left,
        right,
        bold: true,
        italic: false,
        bulletMarker: template.entryBulletMarker,
        gapBefore: gap(),
      })
    }
    return
  }

  if (template.experienceOrder === 'roleFirst') {
    // Jake: Role bold + dates | Company italic + location
    if (entry.title || entry.dates) {
      out.push({
        type: 'entryLine',
        left: entry.title,
        right: entry.dates,
        bold: true,
        italic: false,
        gapBefore: gap(),
      })
    }
    if (entry.subtitle || entry.location) {
      out.push({
        type: 'entryLine',
        left: entry.subtitle,
        right: entry.location,
        bold: false,
        italic: template.subtitleItalic,
        gapBefore: false,
      })
    }
    return
  }

  // Deedy companyFirst: Company bold + location | Role italic + dates
  const company = entry.subtitle || entry.title
  const role = entry.subtitle ? entry.title : ''
  if (company || entry.location) {
    out.push({
      type: 'entryLine',
      left: company,
      right: entry.location,
      bold: true,
      italic: false,
      bulletMarker: template.entryBulletMarker,
      gapBefore: gap(),
    })
  }
  if (role || entry.dates) {
    out.push({
      type: 'entryLine',
      left: role,
      right: entry.dates,
      bold: false,
      italic: template.subtitleItalic,
      gapBefore: false,
    })
  }
}

function pushEducationHeader(
  out: Block[],
  entry: Entry,
  template: TemplateSpec,
  gap: () => boolean,
): void {
  // Jake / Deedy: School bold + location | Degree italic + dates
  if (!template.skillsTable && (template.experienceOrder === 'roleFirst' || template.experienceOrder === 'companyFirst')) {
    const school = entry.title || entry.subtitle
    const degree = entry.title ? entry.subtitle : ''
    if (school || entry.location) {
      out.push({
        type: 'entryLine',
        left: school,
        right: entry.location,
        bold: true,
        italic: false,
        bulletMarker: template.entryBulletMarker,
        gapBefore: gap(),
      })
    }
    if (degree || entry.dates) {
      out.push({
        type: 'entryLine',
        left: degree,
        right: entry.dates,
        bold: false,
        italic: template.subtitleItalic,
        gapBefore: false,
      })
    }
    return
  }

  // Classic: combined line with partial bold on school name
  const left = [entry.title, entry.subtitle].filter(Boolean).join(' — ')
  const withLoc =
    entry.location && left && !left.includes(entry.location) ? `${left} — ${entry.location}` : left || entry.location
  const right = entry.dates
  if (withLoc || right) {
    out.push({
      type: 'entryLine',
      left: withLoc,
      right,
      bold: true,
      italic: false,
      leftBoldThru: entry.title || undefined,
      gapBefore: gap(),
    })
  }
}

function pushProjectHeader(
  out: Block[],
  entryIn: Entry,
  template: TemplateSpec,
  gap: () => boolean,
): { entry: Entry } {
  const recovered = recoverProjectHeaderFromBullets(entryIn)
  const peeled = peelProjectHeader(recovered.title, recovered.subtitle)
  const right = [recovered.location, recovered.dates].filter(Boolean).join(' | ')

  if (template.projectTitleStyle === 'namePipeTech') {
    const techFromLines = recovered.lines.filter(isProjectTechLine).map(stripTechLabel)
    const tech = [...peeled.metaLines.map(stripTechLabel), ...techFromLines].filter(Boolean).join(', ')
    const name = peeled.title || peeled.descriptor
    if (name || right) {
      out.push({
        type: 'entryLine',
        left: tech ? `${name} | ${tech}` : name,
        right,
        bold: true,
        italic: false,
        leftPipe: tech ? { before: name, after: tech } : undefined,
        gapBefore: gap(),
      })
    }
    return {
      entry: {
        ...recovered,
        title: peeled.title,
        subtitle: '',
        lines: recovered.lines.filter((l) => !isProjectTechLine(l)),
      },
    }
  }

  if (template.projectTitleStyle === 'boldPrefix') {
    const name = peeled.title || peeled.descriptor
    let desc = ''
    let bullets = recovered.bullets
    let lines = [...recovered.lines]
    const techLines = [
      ...peeled.metaLines,
      ...lines.filter(isProjectTechLine),
    ]
    lines = lines.filter((l) => !isProjectTechLine(l))
    if (bullets[0]?.text?.trim()) {
      desc = bullets[0].text.trim()
      bullets = bullets.slice(1)
    } else if (lines[0]) {
      desc = lines[0].trim()
      lines = lines.slice(1)
    } else if (peeled.descriptor && peeled.descriptor !== name) {
      desc = peeled.descriptor
    }
    // Include tech in the bold-prefix line when there is no separate description yet.
    const techJoined = techLines.map(stripTechLabel).filter(Boolean).join(', ')
    if (name) {
      const body = desc || techJoined
      out.push({
        type: 'bullet',
        text: body ? `${name}: ${body}` : name,
        emphasizePrefix: true,
        nested: false,
      })
      // If both desc and tech exist, keep tech as a following plain line so tokens aren't lost.
      if (desc && techJoined) {
        out.push({ type: 'paragraph', text: techJoined, gapBefore: false, tone: 'default' })
      }
    } else if (techJoined) {
      out.push({ type: 'paragraph', text: techJoined, gapBefore: gap(), tone: 'default' })
    }
    return { entry: { ...recovered, title: '', subtitle: '', bullets, lines } }
  }

  // Classic titleOnly
  const left = [peeled.title, peeled.descriptor].filter(Boolean).join(' — ')
  if (left || right) {
    out.push({ type: 'entryLine', left, right, bold: true, italic: false, gapBefore: gap() })
  }
  for (const meta of peeled.metaLines) {
    pushProjectMeta(out, meta, gap, template)
  }
  return { entry: recovered }
}

function stripTechLabel(line: string): string {
  return line
    .replace(/^tech\s*stack\s*:\s*/i, '')
    .replace(/^keywords?\s*:\s*/i, '')
    .replace(/\s*,?\s*Keywords?\s*:.*$/i, '')
    .trim()
}

function splitSkillLine(line: string, entryTitle: string): { label?: string; text: string } {
  if (entryTitle) return { label: entryTitle, text: line }
  const m = /^([^:]{2,60}):\s*(.+)$/.exec(line)
  if (m) return { label: m[1].trim(), text: m[2].trim() }
  return { text: line }
}

function looksLikeTechStack(line: string): boolean {
  const commas = (line.match(/,/g) ?? []).length
  return commas >= 2 && line.length < 320 && !/[.!?]$/.test(line.trim())
}

function hasInlineKeywords(line: string): boolean {
  return /,\s*Keywords?\s*:/i.test(line) || /\sKeywords?\s*:/i.test(line)
}

function isProjectTechLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^tech\s*stack\s*:/i.test(t) || /^keywords?\s*:/i.test(t)) return true
  if (hasInlineKeywords(t)) return true
  return looksLikeTechStack(t)
}

/**
 * When tech/Keywords were glued onto the project title after an em dash,
 * peel them onto meta lines so they render blue / italic under the title.
 */
function peelProjectHeader(
  title: string,
  subtitle: string,
): { title: string; descriptor: string; metaLines: string[] } {
  let t = title.trim()
  let descriptor = ''
  const metaLines: string[] = []

  const dashed = /^(.+?)\s+[—–]\s+(.+)$/.exec(t)
  if (dashed && isProjectTechLine(dashed[2])) {
    t = dashed[1].trim()
    metaLines.push(dashed[2].trim())
  } else {
    const piped = /^(.+?)\s+\|\s+(.+)$/.exec(t)
    if (piped && isProjectTechLine(piped[2])) {
      t = piped[1].trim()
      metaLines.push(piped[2].trim())
    }
  }

  const sub = subtitle.trim()
  if (sub) {
    if (isProjectTechLine(sub)) metaLines.push(sub)
    else descriptor = sub
  }

  return { title: t, descriptor, metaLines }
}

/** If the title was empty and a bullet holds "Name — tech…", lift it into the header. */
function recoverProjectHeaderFromBullets(entry: Entry): Entry {
  if (entry.title.trim() || entry.subtitle.trim()) return entry
  const idx = entry.bullets.findIndex((b) => {
    const m = /^(.+?)\s+[—–]\s+(.+)$/.exec(b.text.trim())
    return !!(m && isProjectTechLine(m[2]))
  })
  if (idx < 0) return entry
  const m = /^(.+?)\s+[—–]\s+(.+)$/.exec(entry.bullets[idx].text.trim())!
  return {
    ...entry,
    title: m[1].trim(),
    subtitle: m[2].trim(),
    bullets: entry.bullets.filter((_, i) => i !== idx),
  }
}

function pushProjectMeta(
  out: Block[],
  text: string,
  gap: () => boolean,
  template: TemplateSpec,
): void {
  const trimmed = text.trim()
  if (!trimmed) return
  const colored = template.skillsTable

  const split = /^(.*?)\s*,?\s*(Keywords?\s*:.*)$/i.exec(trimmed)
  if (split && split[1].trim() && (split[1].includes(',') || /^tech\s*stack\s*:/i.test(split[1]))) {
    const tech = split[1].trim().replace(/,\s*$/, '')
    const kw = split[2].trim()
    out.push({ type: 'paragraph', text: tech, gapBefore: gap(), tone: colored ? 'tech' : 'default' })
    out.push({ type: 'paragraph', text: kw, gapBefore: false, tone: colored ? 'keywords' : 'default' })
    return
  }
  if (/^keywords?\s*:/i.test(trimmed)) {
    out.push({ type: 'paragraph', text: trimmed, gapBefore: gap(), tone: colored ? 'keywords' : 'default' })
    return
  }
  out.push({ type: 'paragraph', text: trimmed, gapBefore: gap(), tone: colored ? 'tech' : 'default' })
}

/** Visual-only bold of "Label:" when the bullet already contains it. Words unchanged. */
export function splitBulletPrefix(text: string): { prefix?: string; rest: string } {
  const m = /^([^:]{2,80}):\s+(.+)$/.exec(text)
  if (!m) return { rest: text }
  const label = m[1].trim()
  const detail = m[2].trim()
  // Deedy project titles can be short after the colon.
  if (detail.length < 8) return { rest: text }
  if (/^(tech\s*stack|keywords?)$/i.test(label)) return { rest: text }
  return { prefix: `${label}:`, rest: detail }
}

/** Collect skill/tech tokens from the resume for in-body bolding (exact tokens, no inventing). */
export function collectKeywords(resume: Resume): string[] {
  const set = new Set<string>()
  const addToken = (raw: string) => {
    const t = raw.trim().replace(/^[,;]+|[,;]+$/g, '').trim()
    if (t.length < 2 || t.length > 48) return
    if (/^(and|or|with|using|via|the|a|an)$/i.test(t)) return
    set.add(t)
  }
  const addList = (text: string) => {
    for (const part of text.split(/[,;/|]+/)) addToken(part)
  }

  for (const section of resume.sections) {
    if (section.kind === 'skills') {
      for (const e of section.entries) {
        for (const line of e.lines) {
          const split = splitSkillLine(line, e.title)
          addList(split.text)
        }
        if (e.title) addToken(e.title.replace(/:\s*$/, ''))
      }
    }
    if (section.kind === 'projects') {
      for (const e of section.entries) {
        if (e.subtitle && isProjectTechLine(e.subtitle)) addList(stripTechLabel(e.subtitle))
        for (const line of e.lines) {
          if (isProjectTechLine(line)) addList(stripTechLabel(line))
        }
        const peeled = peelProjectHeader(e.title, e.subtitle)
        for (const meta of peeled.metaLines) addList(stripTechLabel(meta))
      }
    }
  }
  return [...set].sort((a, b) => b.length - a.length)
}

export type TextSpan = { text: string; bold?: boolean; italic?: boolean }

/** Split text into spans, bolding whole-word / phrase matches from keywords (case-insensitive). */
export function boldKeywordSpans(text: string, keywords: string[]): TextSpan[] {
  if (!text || !keywords.length) return [{ text }]
  const escaped = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escaped.length) return [{ text }]
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  const lowerSet = new Set(keywords.map((k) => k.toLowerCase()))
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, bold: lowerSet.has(p.toLowerCase()) || undefined }))
}

export function buildBlocks(resume: Resume, settings: LayoutSettings, template: TemplateSpec): Block[] {
  const blocks: Block[] = []

  if (template.headerLayout === 'splitContact') {
    const urlField = resume.contact.find((c) => c.kind === 'url' && c.text.trim())
    const leftExtra = urlField?.text.trim() || ''
    const rightParts = resume.contact
      .filter((c) => c.text.trim() && c.kind !== 'url' && c.kind !== 'location')
      .filter((c) => !(urlField && c.text.trim() === leftExtra))
      .map((c) => ({
        kind: c.kind,
        text: c.text.trim(),
        label:
          c.kind === 'email'
            ? 'Email'
            : c.kind === 'phone'
              ? 'Mobile'
              : c.kind === 'linkedin'
                ? 'LinkedIn'
                : c.kind === 'github'
                  ? 'GitHub'
                  : '',
      }))
    // Keep location as plain text on the right if present.
    const loc = resume.contact.find((c) => c.kind === 'location' && c.text.trim())
    if (loc) rightParts.push({ kind: loc.kind, text: loc.text.trim(), label: '' })

    if (resume.name || rightParts.length || leftExtra) {
      blocks.push({ type: 'splitHeader', name: resume.name, leftExtra, rightParts })
    }
    if (resume.headline) blocks.push({ type: 'headline', text: resume.headline })
  } else {
    if (resume.name) blocks.push({ type: 'name', text: resume.name })
    if (resume.headline) blocks.push({ type: 'headline', text: resume.headline })
    const contactParts = resume.contact
      .map((c) => ({ kind: c.kind, text: c.text.trim() }))
      .filter((c) => c.text)
    if (contactParts.length) blocks.push({ type: 'contact', parts: contactParts })
  }

  if (template.headerRule && blocks.length) {
    blocks.push({ type: 'headerRule' })
  }

  let firstSection = true
  for (const section of resume.sections) {
    const entries = section.entries.filter(
      (e) => e.title || e.subtitle || e.dates || e.location || e.lines.length || e.bullets.length,
    )
    if (!entries.length) continue

    const heading = sectionDisplayHeading(section, settings.useStandardHeadings)
    blocks.push({
      type: 'heading',
      text: template.headingUppercase ? heading.toUpperCase() : heading,
      first: firstSection,
    })
    firstSection = false

    if (template.joinListWithDots && section.layout === 'list' && section.kind === 'certifications') {
      const items = entries
        .map((e) => [e.title, e.subtitle, e.dates].filter(Boolean).join(e.dates && (e.title || e.subtitle) ? ' ' : ', '))
        .filter(Boolean)
      if (items.length) {
        blocks.push({ type: 'paragraph', text: items.join(' • '), gapBefore: false, tone: 'muted' })
      }
      continue
    }

    entries.forEach((entry, i) => blocks.push(...entryBlocks(entry, section, template, i)))
  }
  return blocks
}

export function suggestedFileName(resume: Resume, ext: 'docx' | 'pdf'): string {
  const base = resume.name.trim().replace(/[^\p{L}\p{N}\s-]/gu, '').split(/\s+/).filter(Boolean).join('_')
  return `${base || 'Resume'}${base ? '_Resume' : ''}.${ext}`
}

export function isLinkKind(kind: ContactKind): boolean {
  return kind === 'email' || kind === 'linkedin' || kind === 'github' || kind === 'url'
}

/** Only mailto: and https: — rejects javascript:/data:/http: and odd hosts. */
export function contactHref(part: Pick<ContactField, 'kind' | 'text'>): string | undefined {
  const t = part.text.trim()
  if (!t || /[\r\n\u0000]/.test(t)) return undefined

  const emailOk = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(t)
  if (part.kind === 'email') return emailOk ? `mailto:${t}` : undefined
  if (emailOk && part.kind !== 'linkedin' && part.kind !== 'github' && part.kind !== 'url') {
    return `mailto:${t}`
  }

  if (part.kind === 'linkedin' || /linkedin\.com/i.test(t)) {
    return safeHttpsUrl(t, ['linkedin.com'])
  }
  if (part.kind === 'github' || /github\.com/i.test(t)) {
    return safeHttpsUrl(t, ['github.com'])
  }
  if (part.kind === 'url' || /^https?:\/\//i.test(t)) {
    return safeHttpsUrl(t)
  }
  return undefined
}

function safeHttpsUrl(raw: string, allowedHosts?: string[]): string | undefined {
  const trimmed = raw.trim()
  if (/^(javascript|data|vbscript|file|blob):/i.test(trimmed)) return undefined
  let candidate = trimmed.replace(/^https?:\/\//i, '')
  candidate = candidate.replace(/^\/+/, '')
  if (/^(javascript|data|vbscript|file|blob):/i.test(candidate)) return undefined
  let url: URL
  try {
    url = new URL(`https://${candidate}`)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  if (url.username || url.password) return undefined
  if (/^(javascript|data|vbscript|file|blob)$/i.test(url.hostname)) return undefined
  if (allowedHosts?.length) {
    const host = url.hostname.toLowerCase()
    const ok = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))
    if (!ok) return undefined
  }
  return url.toString()
}
