import type { Resume } from '../schema'
import { stripBullet } from './patterns'

const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}+#&'’_]*/gu

export function tokenize(text: string): string[] {
  return (text.match(TOKEN_RE) ?? []).map((t) => t.toLowerCase())
}

function countTokens(texts: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const text of texts) {
    for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

/** Every piece of text the finished resume will contain (plus original headings). */
export function resumeTexts(resume: Resume, includeUnsorted = false): string[] {
  const texts: string[] = [resume.name, resume.headline, ...resume.contact.map((c) => c.text)]
  for (const section of resume.sections) {
    texts.push(section.originalHeading)
    for (const entry of section.entries) {
      texts.push(entry.title, entry.subtitle, entry.dates, entry.location, ...entry.lines)
      texts.push(...entry.bullets.map((b) => b.text))
    }
  }
  if (includeUnsorted) texts.push(...resume.unsorted)
  return texts
}

export interface VerbatimReport {
  /** Words from the input that do not appear in the resume. */
  missing: string[]
  /** Words in the resume that were not in the input (user edits). */
  added: string[]
  inputWordCount: number
  ok: boolean
}

function diff(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = []
  for (const [token, count] of a) {
    const extra = count - (b.get(token) ?? 0)
    for (let i = 0; i < extra; i++) out.push(token)
  }
  return out
}

/**
 * `includeUnsorted` treats unsorted lines as present, for callers that
 * already report them separately.
 */
export function verbatimCheck(resume: Resume, includeUnsorted = false): VerbatimReport {
  const sourceLines = resume.sourceText.split(/\r?\n/).map(stripBullet)
  const input = countTokens(sourceLines)
  const output = countTokens([...resumeTexts(resume, includeUnsorted), ...resume.discarded])
  const missing = diff(input, output)
  const added = diff(output, input)
  let inputWordCount = 0
  for (const n of input.values()) inputWordCount += n
  return { missing, added, inputWordCount, ok: missing.length === 0 }
}
