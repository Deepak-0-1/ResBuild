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
  | { type: 'bullet'; text: string; emphasizePrefix: boolean }

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
      out.push({
        type: 'skillRow',
        label,
        text: split.text,
      })
    }
    if (!entry.lines.length && entry.title) {
      out.push({ type: 'skillRow', label: '', text: entry.title })
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
    if (template.companyRoleLine && section.kind === 'experience') {
      // Recruiter scan: Company — Role | Location | Dates (same words, layout only).
      const company = entry.subtitle
      const role = entry.title
      const left = company && role ? `${company} — ${role}` : role || company
      const right = [entry.location, entry.dates].filter(Boolean).join(' | ')
      if (left || right) {
        out.push({ type: 'entryLine', left, right, bold: true, italic: false, gapBefore: gap() })
      }
    } else if (section.kind === 'projects') {
      // Title only on the bold line; tech / Keywords always go below (blue / italic).
      const recovered = recoverProjectHeaderFromBullets(entry)
      const peeled = peelProjectHeader(recovered.title, recovered.subtitle)
      const left = [peeled.title, peeled.descriptor].filter(Boolean).join(' — ')
      const right = [recovered.location, recovered.dates].filter(Boolean).join(' | ')
      if (left || right) {
        out.push({ type: 'entryLine', left, right, bold: true, italic: false, gapBefore: gap() })
      }
      for (const meta of peeled.metaLines) {
        pushProjectMeta(out, meta, gap)
      }
      // Use recovered bullets/lines below.
      entry = recovered
    } else if (section.kind === 'education') {
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
    } else {
      const title = entry.title || entry.subtitle
      const subtitle = entry.title ? entry.subtitle : ''
      if (title || entry.dates) {
        const right = subtitle || !entry.location ? entry.dates : [entry.location, entry.dates].filter(Boolean).join(' | ')
        out.push({ type: 'entryLine', left: title, right, bold: true, italic: false, gapBefore: gap() })
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
      // Keep every word — styling only.
      if (/^keywords?\s*:/i.test(line)) {
        out.push({ type: 'paragraph', text: line, gapBefore: gap(), tone: 'keywords' })
      } else if (/^tech\s*stack\s*:/i.test(line) || looksLikeTechStack(line) || hasInlineKeywords(line)) {
        pushProjectMeta(out, line, gap)
      } else if (section.kind === 'projects') {
        // Leftover project body lines render as bullets (same words).
        out.push({ type: 'bullet', text: line, emphasizePrefix: false })
      } else if (section.kind === 'education') {
        out.push({ type: 'paragraph', text: line, gapBefore: gap(), tone: 'muted' })
      } else {
        out.push({ type: 'paragraph', text: line, gapBefore: gap() })
      }
    }
  }

  const emphasize = template.boldBulletPrefix && section.kind === 'experience'
  for (const b of entry.bullets) {
    if (b.text.trim()) out.push({ type: 'bullet', text: b.text, emphasizePrefix: emphasize })
  }
  return out
}

function splitSkillLine(line: string, entryTitle: string): { label?: string; text: string } {
  if (entryTitle) return { label: entryTitle, text: line }
  const m = /^([^:]{2,60}):\s*(.+)$/.exec(line)
  if (m) return { label: m[1].trim(), text: m[2].trim() }
  return { text: line }
}

function looksLikeTechStack(line: string): boolean {
  const commas = (line.match(/,/g) ?? []).length
  // Allow longer stacks (tools + inline Keywords); still reject sentence-like lines.
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

function pushProjectMeta(out: Block[], text: string, gap: () => boolean): void {
  const trimmed = text.trim()
  if (!trimmed) return

  // "FastAPI, LangGraph, …, Keywords: Foo, Bar" → blue tech + italic keywords.
  const split = /^(.*?)\s*,?\s*(Keywords?\s*:.*)$/i.exec(trimmed)
  if (split && split[1].trim() && (split[1].includes(',') || /^tech\s*stack\s*:/i.test(split[1]))) {
    const tech = split[1].trim().replace(/,\s*$/, '')
    const kw = split[2].trim()
    out.push({ type: 'paragraph', text: tech, gapBefore: gap(), tone: 'tech' })
    out.push({ type: 'paragraph', text: kw, gapBefore: false, tone: 'keywords' })
    return
  }
  if (/^keywords?\s*:/i.test(trimmed)) {
    out.push({ type: 'paragraph', text: trimmed, gapBefore: gap(), tone: 'keywords' })
    return
  }
  out.push({ type: 'paragraph', text: trimmed, gapBefore: gap(), tone: 'tech' })
}

/** Visual-only bold of "Label:" when the bullet already contains it. Words unchanged. */
export function splitBulletPrefix(text: string): { prefix?: string; rest: string } {
  const m = /^([^:]{2,80}):\s+(.+)$/.exec(text)
  if (!m) return { rest: text }
  const label = m[1].trim()
  const detail = m[2].trim()
  if (detail.length < 20) return { rest: text }
  if (/^(tech\s*stack|keywords?)$/i.test(label)) return { rest: text }
  return { prefix: `${label}:`, rest: detail }
}

export function buildBlocks(resume: Resume, settings: LayoutSettings, template: TemplateSpec): Block[] {
  const blocks: Block[] = []
  if (resume.name) blocks.push({ type: 'name', text: resume.name })
  if (resume.headline) blocks.push({ type: 'headline', text: resume.headline })
  const contactParts = resume.contact
    .map((c) => ({ kind: c.kind, text: c.text.trim() }))
    .filter((c) => c.text)
  if (contactParts.length) blocks.push({ type: 'contact', parts: contactParts })
  if (template.headerRule && (resume.name || resume.headline || contactParts.length)) {
    blocks.push({ type: 'headerRule' })
  }

  let firstSection = true
  for (const section of resume.sections) {
    const entries = section.entries.filter(
      (e) => e.title || e.subtitle || e.dates || e.location || e.lines.length || e.bullets.length,
    )
    if (!entries.length) continue
    // Prefer the user's own heading; standard names only when the toggle is on.
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
        // Join for density only — each item's words stay intact.
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
  // Block odd hosts that look like schemes slipped through.
  if (/^(javascript|data|vbscript|file|blob)$/i.test(url.hostname)) return undefined
  if (allowedHosts?.length) {
    const host = url.hostname.toLowerCase()
    const ok = allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))
    if (!ok) return undefined
  }
  return url.toString()
}
