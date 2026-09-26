import type { LayoutSettings } from '../schema'
import { TEMPLATES } from '../../templates'
import { computeMetrics, PX_PER_IN } from './metrics'

type Density = Pick<LayoutSettings, 'fontSize' | 'lineSpacing' | 'marginIn' | 'sectionSpacingPt'>

/** Ordered from most spacious to most compact; all stay within ATS-safe limits. */
export const DENSITY_LEVELS: Density[] = [
  { fontSize: 12, lineSpacing: 1.15, marginIn: 1, sectionSpacingPt: 14 },
  { fontSize: 11.5, lineSpacing: 1.15, marginIn: 1, sectionSpacingPt: 13 },
  { fontSize: 11.5, lineSpacing: 1.1, marginIn: 0.9, sectionSpacingPt: 12 },
  { fontSize: 11, lineSpacing: 1.15, marginIn: 0.9, sectionSpacingPt: 12 },
  { fontSize: 11, lineSpacing: 1.1, marginIn: 0.8, sectionSpacingPt: 11 },
  { fontSize: 11, lineSpacing: 1.05, marginIn: 0.75, sectionSpacingPt: 10 },
  { fontSize: 10.5, lineSpacing: 1.1, marginIn: 0.75, sectionSpacingPt: 10 },
  { fontSize: 10.5, lineSpacing: 1.05, marginIn: 0.7, sectionSpacingPt: 9 },
  { fontSize: 10.5, lineSpacing: 1, marginIn: 0.6, sectionSpacingPt: 8 },
  { fontSize: 10, lineSpacing: 1.05, marginIn: 0.6, sectionSpacingPt: 8 },
  { fontSize: 10, lineSpacing: 1, marginIn: 0.55, sectionSpacingPt: 7 },
  { fontSize: 10, lineSpacing: 1, marginIn: 0.5, sectionSpacingPt: 6 },
]

/**
 * Word and browsers lay text out slightly differently, so we leave headroom
 * to make sure the DOCX does not spill onto an extra page.
 */
const SAFETY = 0.96

export function pageContentHeightPx(settings: LayoutSettings): number {
  const m = computeMetrics(settings, TEMPLATES[settings.template])
  return m.contentHeightIn * PX_PER_IN
}

export function estimatePages(contentHeightPx: number, settings: LayoutSettings): number {
  return Math.max(1, Math.ceil(contentHeightPx / (pageContentHeightPx(settings) * SAFETY)))
}

export interface FitResult {
  settings: LayoutSettings
  pages: number
  fits: boolean
  /** True when content could not fit on 1 page and the target was raised to 2. */
  pageTargetBumped?: boolean
}

/**
 * Picks the most readable density that fits the page target.
 * If the target is 1 page and nothing fits, retries with a 2-page target.
 * `measure` returns the rendered content height in CSS pixels.
 */
export function autoFit(settings: LayoutSettings, measure: (s: LayoutSettings) => number): FitResult {
  const tryTarget = (target: 1 | 2, bumped: boolean): FitResult => {
    let last: FitResult | undefined
    for (const level of DENSITY_LEVELS) {
      const candidate = { ...settings, ...level, pageTarget: target }
      const pages = estimatePages(measure(candidate), candidate)
      last = { settings: candidate, pages, fits: pages <= target, pageTargetBumped: bumped }
      if (last.fits) return last
    }
    return last!
  }

  const first = tryTarget(settings.pageTarget, false)
  if (first.fits) return first
  if (settings.pageTarget === 1) return tryTarget(2, true)
  return first
}
