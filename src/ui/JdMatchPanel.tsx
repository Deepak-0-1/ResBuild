import { useMemo, useState } from 'react'
import { JD_PASS_THRESHOLD, scoreJdMatch } from '../core/master'
import type { Resume } from '../core/schema'
import { Badge, Button, Card, TextArea } from './components'
import { AlertIcon, CheckIcon, InfoIcon, TrashIcon } from './icons'

interface Props {
  resume: Resume
  className?: string
}

const SAMPLE_JD = `Senior Software Engineer

About the Role:
We are looking for a Senior Software Engineer to build scalable web applications and distributed systems. You will collaborate with product designers and engineers to deliver high-performance user experiences.

Responsibilities:
- Design, develop, and maintain modern web applications and microservices.
- Write clean, maintainable, and well-tested TypeScript and React code.
- Architect robust REST and GraphQL APIs backed by PostgreSQL and Redis.
- Collaborate with cross-functional teams to define architecture and technical standards.
- Mentor junior engineers and participate in thorough peer code reviews.

Required Qualifications:
- 4+ years of professional software development experience.
- Strong proficiency in TypeScript, JavaScript, and React.
- Solid experience with Node.js and building backend APIs.
- Experience with relational databases such as PostgreSQL.
- Must have experience with automated testing, CI/CD pipelines, and Git.
- Required: BS in Computer Science or equivalent practical experience.

Nice to Have:
- Experience with Docker, Kubernetes, AWS, or cloud infrastructure.
- Familiarity with Tailwind CSS, Next.js, and GraphQL.`

const STORAGE_KEY = 'resbuild/jd_text'

export function JdMatchPanel({ resume, className = '' }: Props) {
  const [jdText, setJdText] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [filter, setFilter] = useState<'all' | 'missing' | 'matched'>('missing')
  const [search, setSearch] = useState('')

  const handleJdChange = (text: string) => {
    setJdText(text)
    try {
      localStorage.setItem(STORAGE_KEY, text)
    } catch {
      // ignore
    }
  }

  const result = useMemo(() => {
    if (!jdText.trim()) return null
    return scoreJdMatch({ kind: 'resume', resume }, jdText)
  }, [resume, jdText])

  const filteredKeywords = useMemo(() => {
    if (!result) return []
    let list = result.keywords
    if (filter === 'missing') list = list.filter((k) => !k.found)
    else if (filter === 'matched') list = list.filter((k) => k.found)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((k) => k.keyword.toLowerCase().includes(q))
    }
    return list
  }, [result, filter, search])

  const missingCount = result ? result.keywords.filter((k) => !k.found).length : 0
  const matchedCount = result ? result.keywords.filter((k) => k.found).length : 0

  const ringColor = !result
    ? '#cbd5e1'
    : result.pass
      ? '#059669'
      : result.score >= 50
        ? '#d97706'
        : '#e11d48'

  const scoreTextColor = !result
    ? 'text-slate-400'
    : result.pass
      ? 'text-emerald-700'
      : result.score >= 50
        ? 'text-amber-700'
        : 'text-rose-700'

  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-semibold text-slate-900">Job Description Match</h3>
          <p className="text-xs text-slate-500">Deterministic 0–100 keyword & mandatory requirement scoring</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!jdText.trim() ? (
            <Button
              variant="secondary"
              className="text-xs py-1 px-2.5"
              onClick={() => handleJdChange(SAMPLE_JD)}
            >
              Load sample JD
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => handleJdChange('')}
              title="Clear JD"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* JD Input Area */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-medium">Target Job Description</span>
          {jdText.trim() && (
            <span className="text-[11px] text-slate-400">
              {jdText.trim().split(/\s+/).length} words
            </span>
          )}
        </div>
        <TextArea
          rows={3}
          value={jdText}
          placeholder="Paste full job description or requirements here to analyze match..."
          onChange={(e) => handleJdChange(e.target.value)}
          className="text-xs leading-relaxed font-sans placeholder:text-slate-400"
        />
      </div>

      {/* When no JD is entered */}
      {!result && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
          <InfoIcon className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-1 text-xs font-medium text-slate-600">Paste a Job Description above</p>
          <p className="text-[11px] text-slate-400">
            Check keyword overlap, mandatory hard gates, and skill alignment before applying.
          </p>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="mt-4 space-y-4">
          {/* Score banner & ring */}
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
            <div
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full shadow-inner"
              style={{
                background: `conic-gradient(${ringColor} ${result.score * 3.6}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-white text-base font-bold tracking-tight ${scoreTextColor}`}>
                {result.score}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Match Score</span>
                <Badge tone={result.pass ? 'green' : result.score >= 50 ? 'amber' : 'rose'}>
                  {result.pass ? 'Passed (≥ 75)' : result.hardGateTriggered ? 'Hard Gated' : 'Below 75'}
                </Badge>
              </div>

              <p className="mt-0.5 text-xs text-slate-600 leading-normal">
                {result.pass
                  ? 'Great match! Resume fulfills mandatory gates and satisfies key JD requirements.'
                  : result.hardGateTriggered
                    ? 'Score is capped at 74 due to missing mandatory requirements in your resume.'
                    : `Score is below the ${JD_PASS_THRESHOLD} threshold. Add more relevant keywords and ensure key skills are listed.`}
              </p>
            </div>
          </div>

          {/* Hard gate alert */}
          {result.hardGateTriggered && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                <AlertIcon className="h-4 w-4 shrink-0 text-rose-600" />
                <span>Mandatory Requirements Missing ({result.missingMandatory.length})</span>
              </div>
              <p className="mt-1 text-slate-600 text-[11px]">
                The JD specified these requirements as mandatory (must-have/required), but they were not found in your resume text:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.missingMandatory.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 border border-rose-300"
                  >
                    ! {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!result.hardGateTriggered && result.keywords.some((k) => k.mandatory) && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 border border-emerald-200/80">
              <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>All detected mandatory JD requirements are satisfied!</span>
            </div>
          )}

          {/* Scoring breakdown bars */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Scoring Breakdown
            </div>

            <div className="space-y-2 text-xs">
              {/* Overlap */}
              <div>
                <div className="flex justify-between text-slate-600 mb-0.5">
                  <span>Keyword Overlap (recall)</span>
                  <span className="font-medium text-slate-800">
                    {result.weightedPoints.keywordOverlap.toFixed(1)} / 50 pts ({result.breakdown.keywordOverlap}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${result.breakdown.keywordOverlap}%` }}
                  />
                </div>
              </div>

              {/* Skills */}
              <div>
                <div className="flex justify-between text-slate-600 mb-0.5">
                  <span>Skills Section Match</span>
                  <span className="font-medium text-slate-800">
                    {result.weightedPoints.skillsMatch.toFixed(1)} / 20 pts ({result.breakdown.skillsMatch}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${result.breakdown.skillsMatch}%` }}
                  />
                </div>
              </div>

              {/* Mandatory */}
              <div>
                <div className="flex justify-between text-slate-600 mb-0.5">
                  <span>Mandatory Requirement Coverage</span>
                  <span className="font-medium text-slate-800">
                    {result.weightedPoints.mandatoryCoverage.toFixed(1)} / 20 pts ({result.breakdown.mandatoryCoverage}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      result.hardGateTriggered ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${result.breakdown.mandatoryCoverage}%` }}
                  />
                </div>
              </div>

              {/* Completeness */}
              <div>
                <div className="flex justify-between text-slate-600 mb-0.5">
                  <span>Section Completeness</span>
                  <span className="font-medium text-slate-800">
                    {result.weightedPoints.sectionCompleteness.toFixed(1)} / 10 pts
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${result.breakdown.sectionCompleteness}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Keywords Explorer */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilter('missing')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    filter === 'missing' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Missing ({missingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('matched')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    filter === 'matched' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Matched ({matchedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors ${
                    filter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({result.keywords.length})
                </button>
              </div>

              {result.keywords.length > 8 && (
                <input
                  type="text"
                  value={search}
                  placeholder="Search keywords..."
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-6 w-32 rounded border border-slate-200 px-1.5 text-[11px] focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* Keyword tags */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
              {filteredKeywords.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-2">No keywords match your filter.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filteredKeywords.map((k) => (
                    <span
                      key={k.keyword}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                        k.found
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : k.mandatory
                            ? 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {k.found ? (
                        <CheckIcon className="h-3 w-3 text-emerald-600" />
                      ) : k.mandatory ? (
                        <span className="text-rose-600 font-bold">!</span>
                      ) : (
                        <span className="text-amber-500">+</span>
                      )}
                      <span>{k.keyword}</span>
                      {k.mandatory && (
                        <span className="text-[9px] uppercase tracking-wider opacity-75 font-bold">REQ</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Tip: Add missing keywords into your Skills or bullet points to improve match and pass ATS screening.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
