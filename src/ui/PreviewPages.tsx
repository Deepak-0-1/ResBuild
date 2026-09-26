import { useLayoutEffect, useRef, useState } from 'react'
import { computeMetrics, PX_PER_IN } from '../core/layout/metrics'
import type { LayoutSettings, Resume } from '../core/schema'
import { TEMPLATES } from '../templates'
import { ResumeContent } from '../templates/renderHtml'

interface Props {
  resume: Resume
  settings: LayoutSettings
  onMeasured: (contentHeightPx: number) => void
}

interface PageSlice {
  /** translateY so this page starts on a block boundary */
  offsetY: number
  /** visible content height for this sheet (≤ one page) */
  clipH: number
}

/**
 * Shows the resume as real pages. Pagination prefers block boundaries
 * (headings, bullets, entry lines) so the preview does not cut mid-line.
 */
export function PreviewPages({ resume, settings, onMeasured }: Props) {
  const m = computeMetrics(settings, TEMPLATES[settings.template])
  const pageW = m.pageWidthIn * PX_PER_IN
  const pageH = m.pageHeightIn * PX_PER_IN
  const margin = m.marginIn * PX_PER_IN
  const contentH = m.contentHeightIn * PX_PER_IN

  const outerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [slices, setSlices] = useState<PageSlice[]>([{ offsetY: 0, clipH: contentH }])

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, (outer.clientWidth - 8) / pageW)))
    ro.observe(outer)
    return () => ro.disconnect()
  }, [pageW])

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const update = () => {
      const totalH = el.offsetHeight
      onMeasured(totalH)
      setSlices(paginateAtBlocks(el, contentH))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [resume, settings, onMeasured, contentH])

  const sheets = Math.max(1, slices.length)

  return (
    <div ref={outerRef} className="w-full">
      {/* Off-screen full content used only for measuring block positions */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: -10000,
          top: 0,
          width: pageW - margin * 2,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div ref={measureRef}>
          <ResumeContent resume={resume} settings={settings} />
        </div>
      </div>

      <div
        style={{
          width: pageW * scale,
          height: sheets * (pageH + 24) * scale,
          margin: '0 auto',
        }}
      >
        <div style={{ width: pageW, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {slices.map((slice, k) => (
            <div key={k} style={{ marginBottom: 24 }}>
              <div
                className="resume-page relative bg-white shadow-lg ring-1 ring-slate-200"
                style={{ width: pageW, height: pageH, padding: margin, boxSizing: 'border-box' }}
              >
                <div style={{ height: contentH, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: slice.clipH, overflow: 'hidden' }}>
                    <div style={{ transform: `translateY(${-slice.offsetY}px)` }}>
                      <ResumeContent resume={resume} settings={settings} />
                    </div>
                  </div>
                </div>
                <span className="pointer-events-none absolute right-3 bottom-2 text-[10px] text-slate-300 no-print">
                  {k + 1} / {sheets}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Split content into pages that start/end on child-block boundaries when possible. */
function paginateAtBlocks(root: HTMLElement, contentH: number): PageSlice[] {
  const kids = Array.from(root.children) as HTMLElement[]
  if (!kids.length) return [{ offsetY: 0, clipH: contentH }]

  const tops = kids.map((k) => k.offsetTop)
  const bottoms = kids.map((k) => k.offsetTop + k.offsetHeight)
  const slices: PageSlice[] = []
  let start = 0

  while (start < kids.length) {
    const base = tops[start]
    let end = start
    while (end < kids.length && bottoms[end] - base <= contentH + 0.5) end++
    // One block taller than a page: allow a hard clip for that block only.
    if (end === start) end = start + 1
    const clipH = Math.min(contentH, bottoms[end - 1] - base)
    slices.push({ offsetY: base, clipH: Math.max(clipH, 1) })
    start = end
  }

  return slices.length ? slices : [{ offsetY: 0, clipH: contentH }]
}
