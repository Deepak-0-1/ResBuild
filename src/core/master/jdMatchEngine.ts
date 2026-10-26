/**
 * JD Match Scoring Engine
 * =======================
 * Deterministic, zero-AI scoring of a Resume (or MasterProfileData) against
 * a plain-text job description.
 *
 * Algorithm overview
 * ------------------
 * 1. Tokenise the JD and the resume into normalised lowercase tokens.
 * 2. Extract "required" tokens from the JD using heuristic patterns
 *    ("required", "must have", "minimum X years", etc.).
 * 3. Score in four weighted buckets:
 *
 *    Bucket                   Weight
 *    ─────────────────────── ──────
 *    Keyword overlap           50 pts   (frequency-weighted JD token recall)
 *    Skills section match      20 pts   (skills vs JD keywords)
 *    Mandatory req coverage    20 pts   (MUST-HAVE items present)
 *    Section completeness      10 pts   (exp + education present)
 *
 *    Keyword overlap weights each unique JD token by how often it appears
 *    in the JD (freq). Skills match remains unique-token recall.
 *
 * 4. Hard gate: if ANY mandatory requirement is completely absent,
 *    score is capped at 74/100 (just below the 75 threshold).
 *
 * 5. Threshold: 75/100.  pass: boolean reflects score >= threshold.
 *
 * Exported types
 * --------------
 * JdMatchInput   – what callers supply
 * JdMatchResult  – the returned report
 * MatchedKeyword – a single keyword with its coverage flag
 */

import { resumeTexts, tokenize } from '../parse/verbatimCheck'
import type { Resume } from '../schema'
import type { MasterProfileData } from './masterProfileSchema'

// ─── Public types ─────────────────────────────────────────────────────────────

/** Normalised keyword with a flag showing whether it appeared in the resume. */
export interface MatchedKeyword {
  keyword: string
  /** True if the word appeared in the resume (case-insensitive). */
  found: boolean
  /** True if this was extracted as a mandatory/required term. */
  mandatory: boolean
  /** How often this token appears in the JD (for ranking / weighted overlap). */
  weight: number
}

/** Overall scoring report. */
export interface JdMatchResult {
  /** 0–100 composite score. */
  score: number
  /** True when score >= JD_PASS_THRESHOLD (75). */
  pass: boolean
  /** Decomposed bucket scores (each 0–100 within its own weight). */
  breakdown: {
    keywordOverlap: number
    skillsMatch: number
    mandatoryCoverage: number
    sectionCompleteness: number
  }
  /** Weighted points contributed by each bucket. */
  weightedPoints: {
    keywordOverlap: number
    skillsMatch: number
    mandatoryCoverage: number
    sectionCompleteness: number
  }
  /** Every keyword the engine found in the JD. */
  keywords: MatchedKeyword[]
  /** Keywords that are mandatory and NOT found (empty if none missing). */
  missingMandatory: string[]
  /** Whether the hard gate (any mandatory absent) was triggered. */
  hardGateTriggered: boolean
}

/** Supply either a parsed Resume or a MasterProfileData — the engine handles both. */
export type JdMatchInput =
  | { kind: 'resume'; resume: Resume }
  | { kind: 'profile'; profile: MasterProfileData }

// ─── Constants ────────────────────────────────────────────────────────────────

export const JD_PASS_THRESHOLD = 75

/** Hard-gate cap: score is floored here when a mandatory item is missing. */
const HARD_GATE_MAX = 74

const WEIGHTS = {
  keywordOverlap: 50,
  skillsMatch: 20,
  mandatoryCoverage: 20,
  sectionCompleteness: 10,
} as const

/** Stop-words excluded from JD keyword extraction. */
const STOP_WORDS = new Set([
  'a','an','the','and','or','of','to','in','for','with','on','at','by','from',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','shall','should','may','might','can','could','must',
  'not','no','but','if','as','its','it','this','that','these','those','we',
  'you','your','our','their','they','he','she','i','me','my','us','him','her',
  'what','which','who','whom','how','when','where','why','about','above',
  'after','before','between','into','through','during','including','across',
  'within','without','than','then','so','also','both','each','more','most',
  'other','some','such','same','own','just','any','all','than','very','only',
  'well','over','up','out','use','used','using','work','works','working',
  'role','team','strong','good','great','excellent','ability','skills',
  'experience','years','year','minimum','preferred','required','bonus',
  'plus','responsibilities','qualifications','requirements','description',
  'position','job','candidate','candidates','applicants','apply','please',
  'will','following','etc','eg','ie','including','example','examples',
  // Common JD action verbs
  'design','implement','build','develop','deploy','maintain','write','create',
  'manage','lead','mentor','coach','collaborate','coordinate','deliver','drive',
  'define','identify','evaluate','ensure','support','review','monitor','report',
  'communicate','present','document','test','debug','optimize','improve','scale',
  'integrate','architect','plan','execute','own','engage','partner','help','assist',
  'participate','contribute','provide','enable','establish','apply','leverage',
  'utilize','meet','exceed','follow','understand','learn','grow',
  // Common JD adjectives/nouns with no discriminating power
  'new','high','large','fast','complex','modern','best','clean','simple','key',
  'core','primary','critical','effective','efficient','scalable','reliable',
  'innovative','creative','proactive','analytical','detail','oriented',
  'cross','functional','end','fast-paced','startup','company','industry',
  'global','local','remote','hybrid','onsite','office','based','focused',
])

/**
 * Additional words filtered out during MANDATORY token extraction only.
 * These are generic English words that appear on requirement lines but are
 * not technology/skill names the resume should match verbatim.
 */
const MANDATORY_EXTRA_STOPS = new Set([
  // Generic descriptors & connectors
  'similar','equivalent','like','related','field','area','domain','role',
  'tool','tools','technology','technologies','software','hardware','platform',
  'platforms','framework','frameworks','library','libraries','language','languages',
  'database','databases','system','systems','service','services','product','products',
  'application','applications','solution','solutions','environment','environments',
  'stack','cloud','backend','frontend','fullstack','full','data','web','mobile',
  'api','rest','solid','clean','best','practices','patterns','design',
  'build','develop','develop','maintain','write','create','implement','integrate',
  'lead','manage','communicate','collaborate','coordinate','deliver',
  'knowledge','understanding','familiarity','proficiency','expertise',
  'proven','demonstrated','strong','solid','excellent','good','advanced',
  'relevant','technical','professional','industry','standard','modern',
  'fast','large','scale','high','performance','complex','enterprise',
  'degree','bachelor','master','phd','science','engineering','computer',
  'least','plus','bonus','nice','preferred','desired','expected',
])

// ─── Heuristic mandatory-requirement detection ────────────────────────────────

/**
 * Patterns that signal a line or phrase is a HARD requirement.
 * Matches "required", "must have", "must be", "X+ years of Y",
 * "minimum X years", "mandatory", "essential".
 */
const MANDATORY_LINE_RE =
  /\b(required|must\s+have|must\s+be|mandatory|essential|at\s+least\s+\d|\d\+?\s+years?\s+of|minimum\s+\d+\s+years?)\b/i

/**
 * Extract tokens that appear on lines flagged as mandatory.
 * Applies both the general STOP_WORDS and the mandatory-specific extra stops.
 * Minimum length 4 to avoid meaningless 3-letter particles.
 */
function extractMandatoryTokens(jdText: string): Set<string> {
  const mandatory = new Set<string>()
  for (const line of jdText.split(/\r?\n/)) {
    if (!MANDATORY_LINE_RE.test(line)) continue
    for (const tok of tokenize(line)) {
      if (tok.length >= 4 && !STOP_WORDS.has(tok) && !MANDATORY_EXTRA_STOPS.has(tok)) {
        mandatory.add(tok)
      }
    }
  }
  return mandatory
}

// ─── Text extraction helpers ──────────────────────────────────────────────────

/** Collect all text from a Resume into one string. */
function resumeToText(resume: Resume): string {
  return resumeTexts(resume).join(' ')
}

/** Collect all text from a MasterProfileData. */
function profileToText(profile: MasterProfileData): string {
  const parts: string[] = [
    profile.name,
    profile.headline,
    profile.summary,
    ...profile.skills.map((s) => s.name + (s.category ? ' ' + s.category : '')),
    ...(Object.values(profile.contact) as string[]).filter(Boolean),
  ]
  for (const sec of profile.sections) {
    for (const e of sec.entries) {
      parts.push(e.title, e.organization, e.location ?? '')
      parts.push(...e.lines)
      parts.push(...e.bullets.map((b) => b.text))
    }
  }
  return parts.join(' ')
}

/** Pull skills tokens from Resume or profile. */
function skillsText(input: JdMatchInput): string {
  if (input.kind === 'resume') {
    const skillSections = input.resume.sections.filter((s) => s.kind === 'skills')
    return skillSections
      .flatMap((s) =>
        s.entries.flatMap((e) => [e.title, ...e.lines, ...e.bullets.map((b) => b.text)]),
      )
      .join(' ')
  }
  return input.profile.skills.map((s) => s.name).join(' ')
}

/** Sort: mandatory-missing → missing → matched; within group by weight desc. */
function sortKeywords(a: MatchedKeyword, b: MatchedKeyword): number {
  const rank = (k: MatchedKeyword) => (!k.found && k.mandatory ? 0 : !k.found ? 1 : 2)
  return rank(a) - rank(b) || b.weight - a.weight || a.keyword.localeCompare(b.keyword)
}

/** True if an experience or projects section is non-empty. */
function hasExperience(input: JdMatchInput): boolean {
  if (input.kind === 'resume') {
    return input.resume.sections.some(
      (s) => (s.kind === 'experience' || s.kind === 'projects') && s.entries.length > 0,
    )
  }
  return input.profile.sections.some(
    (s) => (s.kind === 'experience' || s.kind === 'projects') && s.entries.length > 0,
  )
}

/** True if an education section is non-empty. */
function hasEducation(input: JdMatchInput): boolean {
  if (input.kind === 'resume') {
    return input.resume.sections.some((s) => s.kind === 'education' && s.entries.length > 0)
  }
  return input.profile.sections.some((s) => s.kind === 'education' && s.entries.length > 0)
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/**
 * Score input against the supplied job description text.
 *
 * @param input  Parsed resume or master profile
 * @param jdText Plain-text job description (copy-paste from a job posting)
 */
export function scoreJdMatch(input: JdMatchInput, jdText: string): JdMatchResult {
  // 1. Tokenise JD — keep only meaningful tokens
  const allJdTokens = tokenize(jdText).filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
  const jdTokenFreq = new Map<string, number>()
  for (const t of allJdTokens) jdTokenFreq.set(t, (jdTokenFreq.get(t) ?? 0) + 1)

  const mandatoryTokens = extractMandatoryTokens(jdText)

  // 2. Tokenise resume / profile
  const resumeText =
    input.kind === 'resume' ? resumeToText(input.resume) : profileToText(input.profile)
  const resumeTokens = new Set(tokenize(resumeText).filter((t) => t.length >= 2))

  // 3. Build keyword list (unique JD tokens, with frequency weights)
  const uniqueJdTokens = [...jdTokenFreq.keys()]
  const keywords: MatchedKeyword[] = uniqueJdTokens
    .map((kw) => ({
      keyword: kw,
      found: resumeTokens.has(kw),
      mandatory: mandatoryTokens.has(kw),
      weight: jdTokenFreq.get(kw) ?? 1,
    }))
    .sort(sortKeywords)

  // 4. Bucket A — frequency-weighted keyword overlap (50 pts)
  const totalWeight = keywords.reduce((sum, k) => sum + k.weight, 0)
  const foundWeight = keywords.filter((k) => k.found).reduce((sum, k) => sum + k.weight, 0)
  const keywordOverlap = totalWeight > 0 ? foundWeight / totalWeight : 1

  // 5. Bucket B — skills section match (20 pts) — unique-token recall
  const skillsToks = new Set(tokenize(skillsText(input)).filter((t) => t.length >= 2))
  const totalKeywords = keywords.length
  const skillHits = uniqueJdTokens.filter((t) => skillsToks.has(t)).length
  const skillsMatch = totalKeywords > 0 ? skillHits / totalKeywords : 1

  // 6. Bucket C — mandatory requirement coverage (20 pts)
  const mandatoryKws = keywords.filter((k) => k.mandatory)
  const mandatoryFound = mandatoryKws.filter((k) => k.found).length
  const mandatoryCoverage = mandatoryKws.length > 0 ? mandatoryFound / mandatoryKws.length : 1
  const missingMandatory = mandatoryKws.filter((k) => !k.found).map((k) => k.keyword)

  // 7. Bucket D — section completeness (10 pts)
  const sectionCompleteness = (hasExperience(input) ? 0.6 : 0) + (hasEducation(input) ? 0.4 : 0)

  // 8. Composite score
  const breakdown = {
    keywordOverlap: Math.round(keywordOverlap * 100),
    skillsMatch: Math.round(skillsMatch * 100),
    mandatoryCoverage: Math.round(mandatoryCoverage * 100),
    sectionCompleteness: Math.round(sectionCompleteness * 100),
  }

  const weightedPoints = {
    keywordOverlap: Math.round(keywordOverlap * WEIGHTS.keywordOverlap),
    skillsMatch: Math.round(skillsMatch * WEIGHTS.skillsMatch),
    mandatoryCoverage: Math.round(mandatoryCoverage * WEIGHTS.mandatoryCoverage),
    sectionCompleteness: Math.round(sectionCompleteness * WEIGHTS.sectionCompleteness),
  }

  let raw =
    weightedPoints.keywordOverlap +
    weightedPoints.skillsMatch +
    weightedPoints.mandatoryCoverage +
    weightedPoints.sectionCompleteness

  // 9. Hard gate: any mandatory item absent => cap at 74
  const hardGateTriggered = missingMandatory.length > 0
  if (hardGateTriggered) raw = Math.min(raw, HARD_GATE_MAX)

  const score = Math.max(0, Math.min(100, raw))

  return {
    score,
    pass: score >= JD_PASS_THRESHOLD,
    breakdown,
    weightedPoints,
    keywords,
    missingMandatory,
    hardGateTriggered,
  }
}
