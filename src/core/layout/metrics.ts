import type { FontFamily, LayoutSettings, PageSize } from '../schema'
import type { TemplateSpec } from '../../templates/types'

export const PAGE_SIZES_IN: Record<PageSize, { width: number; height: number }> = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
}

/** CSS fallbacks with similar metrics for devices without the Office fonts. */
export const FONT_STACKS: Record<FontFamily, string> = {
  Calibri: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif",
  Arial: "Arial, 'Liberation Sans', Helvetica, sans-serif",
  Garamond: "Garamond, 'EB Garamond', 'Times New Roman', serif",
  Georgia: "Georgia, 'Gelasio', serif",
  'Times New Roman': "'Times New Roman', 'Liberation Serif', Tinos, serif",
}

/** All sizes in points, shared by the DOCX and HTML renderers. */
export interface Metrics {
  body: number
  name: number
  heading: number
  lineSpacing: number
  sectionBefore: number
  headingAfter: number
  entryGap: number
  bulletIndentIn: number
  marginIn: number
  pageWidthIn: number
  pageHeightIn: number
  contentWidthIn: number
  contentHeightIn: number
}

export function computeMetrics(settings: LayoutSettings, template: TemplateSpec): Metrics {
  const page = PAGE_SIZES_IN[settings.pageSize]
  const s = template.spacingScale
  return {
    body: settings.fontSize,
    name: Math.round(settings.fontSize * template.nameScale * 2) / 2,
    heading: Math.round(settings.fontSize * template.headingScale * 2) / 2,
    lineSpacing: settings.lineSpacing,
    sectionBefore: Math.round(settings.sectionSpacingPt * s),
    headingAfter: Math.max(2, Math.round(4 * s)),
    entryGap: Math.max(2, Math.round(settings.sectionSpacingPt * 0.55 * s)),
    bulletIndentIn: template.bulletIndentIn,
    marginIn: settings.marginIn,
    pageWidthIn: page.width,
    pageHeightIn: page.height,
    contentWidthIn: page.width - settings.marginIn * 2,
    contentHeightIn: page.height - settings.marginIn * 2,
  }
}

export const PX_PER_IN = 96
export const PX_PER_PT = 96 / 72
