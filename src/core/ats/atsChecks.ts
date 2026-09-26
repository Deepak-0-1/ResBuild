import { isKnownStandardHeading } from '../parse/headingAliases'
import { verbatimCheck } from '../parse/verbatimCheck'
import type { LayoutSettings, Resume, Section } from '../schema'

export type Severity = 'error' | 'warning' | 'info'

export interface AtsIssue {
  id: string
  severity: Severity
  title: string
  detail?: string
  /** Where the problem is, e.g. "Experience > Software Engineer". */
  locations?: string[]
}

export interface AtsReport {
  score: number
  issues: AtsIssue[]
  passed: string[]
}

const MAX_BULLET_CHARS = 320
/** Softer tip threshold — dense labeled bullets ("Area: detail") are common on tech resumes. */
const SOFT_BULLET_CHARS = 240
/** Characters an ATS reliably reads: Latin script plus common typography. */
const SAFE_CHARS = /^[\p{Script=Latin}\p{N}\s.,;:!?'"()[\]{}\-–—_/\\&@#%+*=<>|~$€£₹¥‘’“”•…°·^`]$/u

type DateStyle = 'Mon YYYY' | 'Month YYYY' | 'MM/YYYY' | 'YYYY' | 'Mon. YYYY' | 'Mon \'YY' | 'other'

function dateStyles(dates: string): DateStyle[] {
  const parts = dates.split(/\s*(?:-|–|—|~|\bto\b|\buntil\b|\btill\b)\s*/i).filter(Boolean)
  const styles: DateStyle[] = []
  for (const p of parts) {
    if (/^(present|current|currently|now|till date|to date|ongoing|today)$/i.test(p)) continue
    if (/^[A-Za-z]{3}\.\s*\d{4}$/.test(p)) styles.push('Mon. YYYY')
    else if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec),?\s*\d{4}$/i.test(p)) styles.push('Mon YYYY')
    else if (/^[A-Za-z]{4,},?\s*\d{4}$/.test(p)) styles.push('Month YYYY')
    else if (/^[A-Za-z]{3,}\.?\s*'\d{2}$/.test(p)) styles.push("Mon 'YY")
    else if (/^\d{1,2}[/.]\d{4}$/.test(p)) styles.push('MM/YYYY')
    else if (/^\d{4}$/.test(p)) styles.push('YYYY')
    else styles.push('other')
  }
  return styles
}

function rangeSeparator(dates: string): string | undefined {
  const m = /\s*(-|–|—|~|\bto\b)\s*/i.exec(dates)
  return m ? m[1].toLowerCase() : undefined
}

function entryLabel(section: Section, title: string): string {
  const name = section.heading || section.originalHeading || section.kind
  return title ? `${name} > ${title}` : name
}

export function runAtsChecks(resume: Resume, settings: LayoutSettings, pages: number): AtsReport {
  const issues: AtsIssue[] = []
  const passed: string[] = []
  const add = (issue: AtsIssue) => issues.push(issue)

  // Contact
  if (!resume.name.trim()) add({ id: 'name', severity: 'error', title: 'No name found', detail: 'Put your full name on the first line.' })
  else passed.push('Name at the top')
  const kinds = new Set(resume.contact.map((c) => c.kind))
  if (!kinds.has('email')) add({ id: 'email', severity: 'error', title: 'No email address', detail: 'Recruiters and ATS need an email to contact you.' })
  else passed.push('Email address present')
  if (!kinds.has('phone')) add({ id: 'phone', severity: 'warning', title: 'No phone number' })
  else passed.push('Phone number present')
  if (!kinds.has('location')) add({ id: 'location', severity: 'info', title: 'No location', detail: 'Many ATS filter by city/region. "City, Country" is enough.' })
  if (!kinds.has('linkedin')) add({ id: 'linkedin', severity: 'info', title: 'No LinkedIn URL' })

  // Sections
  const has = (k: Section['kind']) => resume.sections.some((s) => s.kind === k && s.entries.length)
  if (!has('experience') && !has('projects')) {
    add({ id: 'exp', severity: 'warning', title: 'No Experience or Projects section detected', detail: 'Check the Review step: a section may be labelled with a type the parser did not recognise.' })
  } else passed.push('Experience/Projects section present')
  if (!has('education')) add({ id: 'edu', severity: 'warning', title: 'No Education section detected' })
  else passed.push('Education section present')
  if (!has('skills')) add({ id: 'skills', severity: 'warning', title: 'No Skills section detected', detail: 'ATS keyword matching relies heavily on a clear Skills section.' })
  else passed.push('Skills section present')

  const nonStandard = resume.sections.filter(
    (s) => s.kind === 'custom' && s.heading && !isKnownStandardHeading(s.heading),
  )
  if (nonStandard.length) {
    add({
      id: 'headings',
      severity: 'info',
      title: 'Non-standard section headings',
      detail: 'ATS understands common names best (Experience, Education, Skills, Projects, Certifications, Awards).',
      locations: nonStandard.map((s) => s.heading),
    })
  }
  if (!settings.useStandardHeadings) {
    const renamed = resume.sections.filter((s) => s.kind !== 'custom' && s.originalHeading && !isKnownStandardHeading(s.originalHeading))
    if (renamed.length) {
      add({ id: 'std-off', severity: 'info', title: 'Custom heading names in use', detail: 'Turn on "Standard headings" in Export for the most reliable ATS parsing.', locations: renamed.map((s) => s.heading) })
    }
  } else passed.push('Standard section headings')

  const empty = resume.sections.filter((s) => s.entries.length === 0)
  if (empty.length) add({ id: 'empty', severity: 'warning', title: 'Empty sections', detail: 'These will be left out of the resume.', locations: empty.map((s) => s.heading || s.kind) })

  // Dates — education often uses year-only ranges beside "Mon YYYY" jobs; that is fine.
  const styleSpots = new Map<string, string[]>()
  const sepSpots = new Map<string, string[]>()
  const undated: string[] = []
  for (const s of resume.sections) {
    for (const e of s.entries) {
      if (!e.dates) {
        if (s.kind === 'experience' && (e.title || e.subtitle)) undated.push(entryLabel(s, e.title || e.subtitle))
        continue
      }
      const label = `${entryLabel(s, e.title || e.subtitle)} (${e.dates})`
      for (const style of new Set(dateStyles(e.dates))) {
        // Year-only dates outside experience are normal (grad years, cert years).
        if (style === 'YYYY' && s.kind !== 'experience') continue
        styleSpots.set(style, [...(styleSpots.get(style) ?? []), label])
      }
      const sep = rangeSeparator(e.dates)
      if (sep) sepSpots.set(sep, [...(sepSpots.get(sep) ?? []), label])
    }
  }
  // If the only "conflict" is Mon YYYY vs YYYY, keep it as info (not a warning).
  const styles = [...styleSpots.keys()]
  const onlyMonVsYear =
    styles.length === 2 && styles.includes('Mon YYYY') && styles.includes('YYYY')
  if (styleSpots.size > 1 && !onlyMonVsYear) {
    add({
      id: 'date-format',
      severity: 'warning',
      title: 'Inconsistent date formats',
      detail: `Found ${styles.join(', ')}. Pick one format (e.g. "Jan 2022") and use it everywhere.`,
      locations: [...styleSpots.entries()].flatMap(([style, spots]) => spots.map((sp) => `${style}: ${sp}`)),
    })
  } else if (styleSpots.size >= 1) {
    passed.push('Consistent date format')
    if (onlyMonVsYear) {
      add({
        id: 'date-format-info',
        severity: 'info',
        title: 'Jobs use month+year; some entries use year only',
        detail: 'This is usually fine. Use "Mon YYYY" for jobs if you want every date identical.',
      })
    }
  }
  if (sepSpots.size > 1) {
    add({
      id: 'date-sep',
      severity: 'info',
      title: 'Mixed date range separators',
      detail: `Found ${[...sepSpots.keys()].map((s) => `"${s}"`).join(', ')}. Use the same one everywhere.`,
      locations: [...sepSpots.values()].flat(),
    })
  }
  if (undated.length) add({ id: 'undated', severity: 'warning', title: 'Experience entries without dates', detail: 'ATS uses dates to calculate years of experience.', locations: undated })

  // Bullets and characters
  const longBullets: string[] = []
  const softLongBullets: string[] = []
  const oddChars = new Set<string>()
  const oddSpots: string[] = []
  const noBullets: string[] = []
  for (const s of resume.sections) {
    for (const e of s.entries) {
      if (s.kind === 'experience' && e.bullets.length === 0 && e.lines.length === 0) noBullets.push(entryLabel(s, e.title || e.subtitle))
      for (const b of e.bullets) {
        const loc = `${entryLabel(s, e.title)}: "${b.text.slice(0, 60)}…"`
        if (b.text.length > MAX_BULLET_CHARS) longBullets.push(loc)
        else if (b.text.length > SOFT_BULLET_CHARS) softLongBullets.push(loc)
      }
      const texts = [e.title, e.subtitle, e.dates, e.location, ...e.lines, ...e.bullets.map((b) => b.text)]
      for (const t of texts) {
        const bad = [...t].filter((ch) => !SAFE_CHARS.test(ch))
        if (bad.length) {
          bad.forEach((ch) => oddChars.add(ch))
          oddSpots.push(`${entryLabel(s, e.title)}: "${t.slice(0, 50)}${t.length > 50 ? '…' : ''}"`)
        }
      }
    }
  }
  for (const t of [resume.name, resume.headline, ...resume.contact.map((c) => c.text)]) {
    const bad = [...t].filter((ch) => !SAFE_CHARS.test(ch))
    if (bad.length) {
      bad.forEach((ch) => oddChars.add(ch))
      oddSpots.push(`Header: "${t}"`)
    }
  }
  if (longBullets.length) {
    add({
      id: 'long-bullets',
      severity: 'warning',
      title: 'Very long bullet points',
      detail: 'Bullets over ~3 lines are hard to scan. Split each into one result per bullet.',
      locations: longBullets,
    })
  } else if (softLongBullets.length) {
    add({
      id: 'long-bullets-soft',
      severity: 'info',
      title: 'Some bullets are a bit long',
      detail: 'Optional: split the longest ones so recruiters can scan faster.',
      locations: softLongBullets,
    })
  } else passed.push('Bullet length is scannable')
  if (oddChars.size) {
    add({
      id: 'chars',
      severity: 'warning',
      title: 'Special characters an ATS may garble',
      detail: `Characters: ${[...oddChars].join(' ')}. Emojis, icons and decorative symbols often turn into "?" or boxes.`,
      locations: oddSpots,
    })
  } else passed.push('No problematic special characters')
  if (noBullets.length) add({ id: 'no-bullets', severity: 'info', title: 'Experience entries without details', locations: noBullets })

  // Length
  const target = settings.pageTarget
  if (pages > target) {
    add({
      id: 'pages',
      severity: pages > 2 ? 'error' : 'warning',
      title: `Resume is ${pages} pages (target ${target})`,
      detail: settings.autoFit
        ? 'Turn the page target to 2 pages (Export), or shorten a few bullets/projects.'
        : 'Turn on Auto-fit, raise the page target to 2, or reduce spacing/font size.',
    })
  } else passed.push(`Fits on ${pages} page${pages > 1 ? 's' : ''}`)
  if (pages > 2) add({ id: 'too-long', severity: 'warning', title: 'More than 2 pages', detail: 'Most recruiters expect 1 page (under ~5 years experience) or 2 pages at most.' })

  // Verbatim
  if (resume.unsorted.length) {
    add({
      id: 'unsorted',
      severity: 'error',
      title: `${resume.unsorted.length} line(s) not placed in the resume`,
      detail: 'Move them into a section in the Review step, or they will not appear.',
      locations: resume.unsorted.map((l) => (l.length > 70 ? `${l.slice(0, 70)}…` : l)),
    })
  }
  const verbatim = verbatimCheck(resume, true)
  if (verbatim.missing.length) {
    const sample = [...new Set(verbatim.missing)].slice(0, 25)
    add({
      id: 'verbatim',
      severity: 'error',
      title: `${verbatim.missing.length} word(s) from your content are missing`,
      detail: `Missing: ${sample.join(', ')}${verbatim.missing.length > sample.length ? ', …' : ''}`,
    })
  } else passed.push('Every word of your content is included')
  if (verbatim.added.length) {
    const sample = [...new Set(verbatim.added)].slice(0, 25)
    add({ id: 'edited', severity: 'info', title: 'You edited some text', detail: `Words not in the original content: ${sample.join(', ')}` })
  }

  const penalty = issues.reduce((sum, i) => sum + (i.severity === 'error' ? 15 : i.severity === 'warning' ? 7 : 2), 0)
  return { score: Math.max(0, Math.min(100, 100 - penalty)), issues, passed }
}
