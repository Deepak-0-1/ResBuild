import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { runAtsChecks } from '../core/ats/atsChecks'
import { autoFit, type FitResult } from '../core/layout/autoFit'
import { computeMetrics, PX_PER_IN } from '../core/layout/metrics'
import type { FontFamily, LayoutSettings, PageSize, Resume } from '../core/schema'
import { TEMPLATE_LIST, TEMPLATES } from '../templates'
import { suggestedFileName } from '../templates/blocks'
import { ResumeContent } from '../templates/renderHtml'
import { AtsPanel } from './AtsPanel'
import { JdMatchPanel } from './JdMatchPanel'
import { Button, Card, Select, Toggle } from './components'
import { DownloadIcon, PrintIcon } from './icons'
import { measureContentHeight } from './measure'
import { PreviewPages } from './PreviewPages'

interface Props {
  resume: Resume
  settings: LayoutSettings
  onSettings: (s: LayoutSettings) => void
  onBack: () => void
}

const FONTS: { value: FontFamily; label: string }[] = [
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
]

const PAGE_SIZES: { value: PageSize; label: string }[] = [
  { value: 'letter', label: 'US Letter' },
  { value: 'a4', label: 'A4' },
]

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  disabled: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className={`block text-sm ${disabled ? 'opacity-60' : ''}`}>
      <span className="flex justify-between">
        <span className="text-slate-700">{label}</span>
        <span className="font-mono text-xs text-slate-500">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600"
      />
    </label>
  )
}

export function ExportPage({ resume, settings, onSettings, onBack }: Props) {
  const [fit, setFit] = useState<FitResult | undefined>()
  const [contentHeight, setContentHeight] = useState(0)
  const [busy, setBusy] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'ats' | 'jd'>('ats')
  const set = (patch: Partial<LayoutSettings>) => onSettings({ ...settings, ...patch })

  useEffect(() => {
    if (!settings.autoFit) return
    // flushSync-based measuring must run outside React's render/commit phase.
    const t = window.setTimeout(() => {
      const result = autoFit(settings, (s) => measureContentHeight(resume, s))
      setFit(result)
      // Dense resumes often need 2 pages — raise the target automatically so ATS doesn't warn.
      if (result.pageTargetBumped && settings.pageTarget === 1) {
        onSettings({ ...settings, pageTarget: 2 })
      }
    }, 120)
    return () => window.clearTimeout(t)
  }, [resume, settings, onSettings])

  const effective = settings.autoFit && fit ? fit.settings : settings
  const m = computeMetrics(effective, TEMPLATES[effective.template])
  const pages = Math.max(1, Math.ceil((contentHeight - 0.5) / (m.contentHeightIn * PX_PER_IN)))
  const report = useMemo(() => runAtsChecks(resume, effective, pages), [resume, effective, pages])
  const onMeasured = useCallback((h: number) => setContentHeight(h), [])

  const downloadDocx = async () => {
    setBusy(true)
    try {
      const { renderDocx } = await import('../templates/renderDocx')
      const blob = await renderDocx(resume, effective)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = suggestedFileName(resume, 'docx')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      setBusy(false)
    }
  }

  const printPdf = () => {
    const source = document.querySelector('.print-root .resume-content')
    if (!source) {
      window.alert('Preview is still loading. Wait a moment, then try Save as PDF again.')
      return
    }

    const size = effective.pageSize === 'a4' ? 'A4' : 'letter'
    // Coerce margin so untrusted draft values cannot break out of the CSS string.
    const margin = Math.min(1, Math.max(0.5, Number(effective.marginIn) || 0.55))

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    // allow-modals: print dialog; allow-same-origin: parent can fill the document. No allow-scripts.
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
    document.body.appendChild(iframe)

    const idoc = iframe.contentDocument
    const iwin = iframe.contentWindow
    if (!idoc || !iwin) {
      iframe.remove()
      return
    }

    idoc.open()
    idoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body></body></html>')
    idoc.close()
    idoc.title = ''

    const style = idoc.createElement('style')
    style.textContent = [
      `@page { size: ${size}; margin: ${margin.toFixed(2)}in; }`,
      'html, body { margin: 0; padding: 0; background: #fff; }',
      'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      'a { color: inherit; text-decoration: underline; cursor: default; }',
    ].join('\n')
    idoc.head.appendChild(style)

    const clone = source.cloneNode(true) as HTMLElement
    // Print clone must not keep live navigable hrefs.
    clone.querySelectorAll('a[href]').forEach((a) => {
      a.removeAttribute('href')
    })
    idoc.body.appendChild(clone)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      iframe.remove()
    }
    iwin.addEventListener('afterprint', cleanup)
    setTimeout(() => {
      try {
        iwin.focus()
        iwin.print()
      } catch {
        cleanup()
        return
      }
      setTimeout(cleanup, 60_000)
    }, 150)
  }

  return (
    <>
      <div className="mx-auto grid max-w-[1400px] gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_320px]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Template</h3>
            <div className="grid gap-2">
              {TEMPLATE_LIST.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.id === 'jake' || t.id === 'deedy') {
                      set({ template: t.id, font: 'Times New Roman' })
                    } else {
                      set({ template: t.id })
                    }
                  }}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    settings.template === t.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.description}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Layout</h3>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Font" value={settings.font} options={FONTS} onChange={(font) => set({ font })} />
              <Select label="Page size" value={settings.pageSize} options={PAGE_SIZES} onChange={(pageSize) => set({ pageSize })} />
            </div>
            <div>
              <span className="mb-1 block text-sm text-slate-700">Target length</span>
              <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ pageTarget: n })}
                    className={`rounded-md py-1 text-sm font-medium ${settings.pageTarget === n ? 'bg-white shadow' : 'text-slate-600'}`}
                  >
                    {n} page{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              checked={settings.autoFit}
              onChange={(autoFit) => set({ autoFit })}
              label="Auto-fit"
              hint="Picks the most readable font size, spacing and margins that fit your target."
            />
            <Toggle
              checked={settings.useStandardHeadings}
              onChange={(useStandardHeadings) => set({ useStandardHeadings })}
              label="Standard headings"
              hint="Off (recommended): keep your section titles exactly. On: replace with generic ATS names."
            />
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <Slider label="Font size" value={effective.fontSize} min={10} max={12} step={0.5} unit=" pt" disabled={settings.autoFit} onChange={(fontSize) => set({ fontSize })} />
              <Slider label="Line spacing" value={effective.lineSpacing} min={1} max={1.3} step={0.05} unit="x" disabled={settings.autoFit} onChange={(lineSpacing) => set({ lineSpacing })} />
              <Slider label="Margins" value={effective.marginIn} min={0.5} max={1} step={0.05} unit=" in" disabled={settings.autoFit} onChange={(marginIn) => set({ marginIn })} />
              <Slider label="Section spacing" value={effective.sectionSpacingPt} min={4} max={16} step={1} unit=" pt" disabled={settings.autoFit} onChange={(sectionSpacingPt) => set({ sectionSpacingPt })} />
              {settings.autoFit && fit?.pageTargetBumped && (
                <p className="text-xs text-amber-700">Auto-fit raised the target to 2 pages so your content fits cleanly.</p>
              )}
              {settings.autoFit && fit && !fit.fits && (
                <p className="text-xs text-rose-600">Content does not fit in {settings.pageTarget} page(s) even at the most compact ATS-safe layout.</p>
              )}
            </div>
          </Card>

          <Card className="space-y-2 p-4">
            <Button variant="primary" className="w-full" onClick={downloadDocx} disabled={busy}>
              <DownloadIcon /> {busy ? 'Preparing…' : 'Download DOCX'}
            </Button>
            <Button className="w-full" onClick={printPdf}>
              <PrintIcon /> Save as PDF (print)
            </Button>
            <p className="text-xs text-slate-500">
              PDF opens the print dialog on this page (no new tab). Choose Save as PDF and turn off Headers and footers. DOCX: {suggestedFileName(resume, 'docx')}
            </p>
            <Button variant="ghost" className="w-full" onClick={onBack}>
              Back to review
            </Button>
          </Card>
        </aside>

        <section className="min-w-0 rounded-xl bg-slate-200/60 p-3 sm:p-6">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
            <span>Live preview · {pages} page{pages > 1 ? 's' : ''}</span>
            <span>
              {effective.fontSize} pt · {effective.marginIn} in margins
            </span>
          </div>
          <PreviewPages resume={resume} settings={effective} onMeasured={onMeasured} />
        </section>

        <aside className="space-y-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:h-fit">
          <div className="flex rounded-lg bg-slate-200/80 p-1">
            <button
              type="button"
              onClick={() => setSidebarTab('ats')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                sidebarTab === 'ats' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ATS Scan ({report.score})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('jd')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                sidebarTab === 'jd' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Job Match (JD)
            </button>
          </div>

          {sidebarTab === 'ats' ? <AtsPanel report={report} /> : <JdMatchPanel resume={resume} />}
        </aside>
      </div>

      {createPortal(
        <div className="print-root" style={{ display: 'none' }}>
          <ResumeContent resume={resume} settings={effective} />
        </div>,
        document.body,
      )}
    </>
  )
}
