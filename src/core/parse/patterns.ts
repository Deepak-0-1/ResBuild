import type { ContactKind } from '../schema'

const MONTH =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?'
const YEAR = "(?:(?:19|20)\\d{2}|'\\d{2})"
const DATE = `(?:${MONTH},?\\s*${YEAR}|\\d{1,2}[/.]${YEAR}|(?:19|20)\\d{2})`
const OPEN_END = '(?:present|current|currently|now|till\\s+date|to\\s+date|ongoing|today)'
const RANGE_SEP = '\\s*(?:-|–|—|~|to|until|till)\\s*'

const RANGE_RE = new RegExp(`\\(?\\b${DATE}${RANGE_SEP}(?:${DATE}|${OPEN_END})\\b\\)?`, 'i')
const SINGLE_RE = new RegExp(`\\(?\\b(?:expected\\s+|graduated:?\\s+|since\\s+)?(?:${MONTH},?\\s*${YEAR}|\\d{1,2}[/.](?:19|20)\\d{2})\\b\\)?`, 'i')
const TRAILING_YEAR_RE = /\(?\b(?:19|20)\d{2}\b\)?\s*$/

export interface DateMatch {
  dates: string
  rest: string
}

/** Pulls a date or date range out of a line; the date text is kept verbatim. */
export function extractDates(line: string): DateMatch | undefined {
  for (const re of [RANGE_RE, SINGLE_RE, TRAILING_YEAR_RE]) {
    const m = re.exec(line)
    if (!m) continue
    const raw = m[0].trim()
    const dates = raw.replace(/^\(|\)$/g, '').trim()
    const rest = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).replace(/\(\s*\)/g, '')
    return { dates, rest: trimSeparators(rest) }
  }
  return undefined
}

export function hasDate(line: string): boolean {
  return RANGE_RE.test(line) || SINGLE_RE.test(line)
}

const BULLET_RE = /^\s*(?:[•●○◦▪▫■□►▸▹➢➤➣✓✔✗→⇒·♦◆◇]\s*|[-*–—+]\s+|\(?\d{1,2}[.)]\s+)/

export function isBulletLine(line: string): boolean {
  return BULLET_RE.test(line)
}

export function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim()
}

/** Only symbols/whitespace, e.g. "-----" or "=====" underline decorations. */
export function isDecorationLine(line: string): boolean {
  return line.trim().length > 0 && !/[\p{L}\p{N}]/u.test(line)
}

const SEPARATOR_EDGES = /^[\s|,;:–—\-·•@/]+|[\s|,;–—\-·•@/]+$/g

export function trimSeparators(text: string): string {
  return text.replace(SEPARATOR_EDGES, '').replace(/\s{2,}/g, ' ').trim()
}

/** Splits a header line such as "Engineer | Google — Remote" into its parts. */
export function splitHeaderParts(line: string): string[] {
  return line
    .split(/\s*[|•·\t]\s*|\s+[–—-]\s+|\s{3,}|\s+@\s+/)
    .map(trimSeparators)
    .filter(Boolean)
}

const COUNTRIES = [
  'india', 'usa', 'us', 'u.s.', 'u.s.a.', 'united states', 'uk', 'united kingdom', 'canada', 'germany',
  'france', 'australia', 'singapore', 'uae', 'united arab emirates', 'netherlands', 'ireland', 'japan',
  'china', 'spain', 'italy', 'sweden', 'switzerland', 'poland', 'brazil', 'mexico', 'new zealand',
  'south africa', 'nigeria', 'kenya', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'malaysia',
  'indonesia', 'philippines', 'vietnam', 'saudi arabia', 'qatar', 'israel', 'egypt', 'portugal',
  'belgium', 'austria', 'denmark', 'norway', 'finland', 'korea', 'south korea', 'hong kong', 'taiwan',
]
const REGIONS = [
  'karnataka', 'maharashtra', 'tamil nadu', 'telangana', 'kerala', 'delhi', 'new delhi', 'gujarat',
  'uttar pradesh', 'west bengal', 'rajasthan', 'punjab', 'haryana', 'madhya pradesh', 'andhra pradesh',
  'bihar', 'odisha', 'goa', 'ncr', 'california', 'texas', 'new york', 'washington', 'ontario',
  'british columbia', 'england', 'scotland', 'bavaria', 'new south wales', 'victoria',
]
const PLACE_WORDS = new Set([...COUNTRIES, ...REGIONS])
const WORK_MODE_RE = /^(?:remote|hybrid|on-?site|in-?office|work from home|wfh)(?:\s*[(/,-].*)?$/i
const STATE_CODE_RE = /^[A-Z][A-Za-z.'\s-]{1,30},\s*[A-Z]{2}(?:\s+\d{5})?(?:,\s*[A-Za-z. ]+)?$/

export function isLocation(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 50) return false
  if (WORK_MODE_RE.test(t)) return true
  if (STATE_CODE_RE.test(t)) return true
  const parts = t.split(',').map((p) => p.trim().toLowerCase())
  if (parts.length >= 2 && parts.length <= 3) {
    const last = parts[parts.length - 1].replace(/\(.*\)/, '').trim()
    if (PLACE_WORDS.has(last)) return parts[0].split(/\s+/).length <= 3
  }
  if (parts.length === 1 && PLACE_WORDS.has(parts[0])) return true
  return false
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+(?:com|in|io|dev|me|org|net|co|ai|app|tech|xyz|site|page|link|so|us|uk|edu)(?:\/[^\s|,;]*)?/gi
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d[\d\s.-]{6,}\d/g

export interface ContactToken {
  kind: ContactKind
  text: string
}

function classifyUrl(url: string): ContactKind {
  if (/linkedin\.com/i.test(url)) return 'linkedin'
  if (/github\.com/i.test(url)) return 'github'
  return 'url'
}

/**
 * Finds contact details in one header chunk. Leftover words become a
 * location or an "other" field so nothing the user typed is dropped.
 */
export function extractContacts(chunk: string): ContactToken[] {
  const found: { index: number; token: ContactToken; length: number }[] = []
  let rest = chunk

  const take = (re: RegExp, kindOf: (m: string) => ContactKind, valid?: (m: string) => boolean) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(rest))) {
      const text = m[0].trim()
      if (valid && !valid(text)) continue
      found.push({ index: m.index, token: { kind: kindOf(text), text }, length: m[0].length })
      rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length)
      re.lastIndex = 0
    }
  }

  take(EMAIL_RE, () => 'email')
  take(URL_RE, classifyUrl)
  take(PHONE_RE, () => 'phone', (m) => m.replace(/\D/g, '').length >= 7)

  const leftover = trimSeparators(rest.replace(/\b(?:email|e-mail|phone|mobile|tel|ph|linkedin|github|portfolio|website)\s*:/gi, ' '))
  const tokens = found.sort((a, b) => a.index - b.index).map((f) => f.token)
  if (leftover) {
    for (const piece of leftover.split(/\s{2,}|\s*[|;]\s*/).map(trimSeparators).filter(Boolean)) {
      tokens.push({ kind: classifyBareContact(piece), text: piece })
    }
  }
  return tokens
}

function classifyBareContact(piece: string): ContactKind {
  if (/^linkedin$/i.test(piece)) return 'linkedin'
  if (/^github$/i.test(piece)) return 'github'
  if (/^(?:portfolio|website|site)$/i.test(piece)) return 'url'
  if (isLocation(piece)) return 'location'
  return 'other'
}

export function hasContactInfo(line: string): boolean {
  EMAIL_RE.lastIndex = 0
  URL_RE.lastIndex = 0
  PHONE_RE.lastIndex = 0
  if (EMAIL_RE.test(line)) return true
  if (URL_RE.test(line)) return true
  const phones = line.match(PHONE_RE) ?? []
  if (phones.some((p) => p.replace(/\D/g, '').length >= 7)) return true
  // Bare "GitHub | LinkedIn" labels only count as contact when they share a line with email/phone/url.
  return false
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '')
  return letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()
}

/** Previous line looks cut off mid-phrase (common in PDF/Word wrap). */
export function looksIncomplete(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/[,;:/&–—+]$/.test(t)) return true
  if (/\b(?:and|or|of|the|a|an|to|for|with|using|via|on|in|at|from|into|over|under|by)$/i.test(t)) return true
  return false
}

/** Pipe/dot-separated keyword tagline under a name (e.g. "Python | LLM | RAG"). */
export function isKeywordTagline(text: string): boolean {
  if (isBulletLine(text) || hasContactInfo(text) || hasDate(text)) return false
  const pipes = (text.match(/\s[|·•]\s/g) ?? []).length
  return pipes >= 2 && wordCount(text) <= 20 && text.length <= 160
}

/** Looks like a new job/project header rather than a wrapped continuation. */
export function isClearEntryHeader(text: string): boolean {
  if (hasDate(text)) return true
  if (/^tech\s*stack\b/i.test(text)) return false
  // Pipe or dash separators: "Title | Org", "Name — Subtitle", "Name - Subtitle"
  if (/\s(?:\||–|—|-)\s/.test(text) && wordCount(text) <= 18) return true
  const commas = (text.match(/,/g) ?? []).length
  if (commas >= 2) return false
  if (/[.!?…]$/.test(text)) return false
  return wordCount(text) <= 12 && /^[\p{Lu}]/u.test(text) && !isKeywordTagline(text)
}
