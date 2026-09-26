import { useState } from 'react'
import type { AtsIssue, AtsReport } from '../core/ats/atsChecks'
import { Card } from './components'
import { AlertIcon, CheckIcon, InfoIcon } from './icons'

const TONE = {
  error: { icon: AlertIcon, text: 'text-rose-600', bg: 'bg-rose-50' },
  warning: { icon: AlertIcon, text: 'text-amber-600', bg: 'bg-amber-50' },
  info: { icon: InfoIcon, text: 'text-blue-600', bg: 'bg-blue-50' },
} as const

function Issue({ issue }: { issue: AtsIssue }) {
  const [open, setOpen] = useState(false)
  const tone = TONE[issue.severity]
  const Icon = tone.icon
  return (
    <li className={`rounded-lg p-3 ${tone.bg}`}>
      <div className="flex gap-2">
        <Icon className={`mt-0.5 shrink-0 ${tone.text}`} />
        <div className="min-w-0 text-sm">
          <div className="font-medium text-slate-900">{issue.title}</div>
          {issue.detail && <div className="mt-0.5 text-xs text-slate-600">{issue.detail}</div>}
          {issue.locations && issue.locations.length > 0 && (
            <>
              <button type="button" className="mt-1 text-xs font-medium text-slate-700 underline" onClick={() => setOpen(!open)}>
                {open ? 'Hide' : 'Show'} {issue.locations.length} location{issue.locations.length > 1 ? 's' : ''}
              </button>
              {open && (
                <ul className="mt-1 space-y-0.5 text-xs break-words text-slate-600">
                  {issue.locations.map((l, i) => (
                    <li key={i}>– {l}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

export function AtsPanel({ report }: { report: AtsReport }) {
  const order = { error: 0, warning: 1, info: 2 }
  const issues = [...report.issues].sort((a, b) => order[a.severity] - order[b.severity])
  const color = report.score >= 85 ? 'text-emerald-600' : report.score >= 65 ? 'text-amber-600' : 'text-rose-600'
  const ring = report.score >= 85 ? '#059669' : report.score >= 65 ? '#d97706' : '#e11d48'

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div
          className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${ring} ${report.score * 3.6}deg, #e2e8f0 0deg)` }}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-bold ${color}`}>
            {report.score}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">ATS check</h3>
          <p className="text-xs text-slate-500">These are warnings only. Nothing is changed automatically.</p>
        </div>
      </div>

      {issues.length > 0 && <ul className="mt-4 space-y-2">{issues.map((i) => <Issue key={i.id} issue={i} />)}</ul>}

      {report.passed.length > 0 && (
        <ul className="mt-4 space-y-1">
          {report.passed.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckIcon className="shrink-0 text-emerald-600" /> {p}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
