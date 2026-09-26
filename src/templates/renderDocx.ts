import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  Tab,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx'
import type { LayoutSettings, Resume } from '../core/schema'
import { computeMetrics } from '../core/layout/metrics'
import { buildBlocks, contactHref, isLinkKind, splitBulletPrefix } from './blocks'
import { TEMPLATES } from './index'

const TWIPS_PER_IN = 1440
const TWIPS_PER_PT = 20
const halfPoints = (pt: number) => Math.round(pt * 2)

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF', space: 0 }
const SKILL_ROW_BORDER = {
  top: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C5C5C5', space: 1 },
}

/**
 * Builds a single-column Word document: no text boxes or images.
 * Skills use a simple 2-column table (category | items) for the tabular layout;
 * reading order stays left-to-right so ATS still picks up every word.
 */
export async function renderDocx(resume: Resume, settings: LayoutSettings): Promise<Blob> {
  const template = TEMPLATES[settings.template]
  const m = computeMetrics(settings, template)
  const blocks = buildBlocks(resume, settings, template)
  const contentWidth = Math.round(m.contentWidthIn * TWIPS_PER_IN)
  const labelWidth = Math.round(contentWidth * 0.28)
  const skillsWidth = contentWidth - labelWidth
  const line = Math.round(240 * m.lineSpacing)
  const center = template.nameAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT
  const rightTab = [{ type: TabStopType.RIGHT, position: contentWidth }]
  const ruleColor = '444444'

  const children = blocks.map((b, i) => {
    const next = blocks[i + 1]
    switch (b.type) {
      case 'name':
        return new Paragraph({
          alignment: center,
          spacing: { after: 40, line: 240, lineRule: LineRuleType.AUTO },
          children: [
            new TextRun({
              text: template.nameUppercase ? b.text.toUpperCase() : b.text,
              bold: true,
              size: halfPoints(m.name),
              color: template.nameColor,
            }),
          ],
        })
      case 'headline':
        return new Paragraph({
          alignment: center,
          spacing: { after: 40, line, lineRule: LineRuleType.AUTO },
          children: [
            new TextRun({
              text: b.text,
              bold: true,
              italics: template.headlineItalic,
              size: halfPoints(m.body + 0.5),
              color: template.headlineColor,
            }),
          ],
        })
      case 'contact': {
        const runs: (TextRun | ExternalHyperlink)[] = []
        b.parts.forEach((part, pi) => {
          if (pi > 0) runs.push(new TextRun({ text: template.contactSeparator, size: halfPoints(m.body - 0.5) }))
          const href = contactHref(part)
          if (isLinkKind(part.kind) && href) {
            runs.push(
              new ExternalHyperlink({
                children: [
                  new TextRun({
                    text: part.text,
                    color: template.linkColor,
                    underline: {},
                    size: halfPoints(m.body - 0.5),
                  }),
                ],
                link: href,
              }),
            )
          } else {
            runs.push(new TextRun({ text: part.text, size: halfPoints(m.body - 0.5) }))
          }
        })
        return new Paragraph({
          alignment: center,
          spacing: { after: 60, line, lineRule: LineRuleType.AUTO },
          children: runs,
        })
      }
      case 'headerRule':
        return new Paragraph({
          spacing: {
            after: Math.round(Math.max(4, m.sectionBefore * 0.35) * TWIPS_PER_PT),
            line: 120,
            lineRule: LineRuleType.AUTO,
          },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ruleColor, space: 1 } },
          children: [],
        })
      case 'heading':
        return new Paragraph({
          keepNext: true,
          keepLines: true,
          spacing: {
            before: Math.round((b.first ? m.sectionBefore * 0.55 : m.sectionBefore) * TWIPS_PER_PT),
            after: Math.round(m.headingAfter * TWIPS_PER_PT),
            line: 240,
            lineRule: LineRuleType.AUTO,
          },
          border: template.headingRule
            ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: ruleColor, space: 1 } }
            : undefined,
          children: [
            new TextRun({ text: b.text, bold: true, size: halfPoints(m.heading), color: template.headingColor }),
          ],
        })
      case 'entryLine': {
        const leftRuns: TextRun[] = []
        if (b.leftBoldThru && b.left.startsWith(b.leftBoldThru)) {
          leftRuns.push(new TextRun({ text: b.leftBoldThru, bold: true }))
          leftRuns.push(new TextRun({ text: b.left.slice(b.leftBoldThru.length), italics: b.italic }))
        } else {
          leftRuns.push(new TextRun({ text: b.left, bold: b.bold, italics: b.italic }))
        }
        return new Paragraph({
          keepNext:
            next?.type === 'entryLine' ||
            next?.type === 'bullet' ||
            next?.type === 'paragraph' ||
            next?.type === 'skillRow',
          keepLines: true,
          tabStops: rightTab,
          spacing: {
            before: b.gapBefore ? Math.round(m.entryGap * TWIPS_PER_PT) : 0,
            after: 0,
            line,
            lineRule: LineRuleType.AUTO,
          },
          children: [...leftRuns, ...(b.right ? [new TextRun({ children: [new Tab(), b.right] })] : [])],
        })
      }
      case 'skillRow': {
        const labelText = b.label ? (b.label.endsWith(':') ? b.label : `${b.label}:`) : ''
        return new Table({
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: [labelWidth, skillsWidth],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: labelWidth, type: WidthType.DXA },
                  borders: SKILL_ROW_BORDER,
                  margins: { top: 40, bottom: 40, left: 0, right: 60 },
                  children: [
                    new Paragraph({
                      spacing: { after: 0, line, lineRule: LineRuleType.AUTO },
                      children: [new TextRun({ text: labelText, bold: true })],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: skillsWidth, type: WidthType.DXA },
                  borders: SKILL_ROW_BORDER,
                  margins: { top: 40, bottom: 40, left: 60, right: 0 },
                  children: [
                    new Paragraph({
                      spacing: { after: 0, line, lineRule: LineRuleType.AUTO },
                      children: [new TextRun({ text: b.text })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      }
      case 'paragraph': {
        const isTech = b.tone === 'tech'
        const isKw = b.tone === 'keywords'
        const isMuted = b.tone === 'muted'
        const color = isTech ? template.techColor : isKw || isMuted ? template.keywordsColor : undefined
        return new Paragraph({
          spacing: {
            before: b.gapBefore ? Math.round(m.entryGap * TWIPS_PER_PT) : 0,
            after: Math.round(1.5 * TWIPS_PER_PT),
            line,
            lineRule: LineRuleType.AUTO,
          },
          children: [
            ...(b.label
              ? [
                  new TextRun({
                    text: `${b.label}: `,
                    bold: !isKw,
                    italics: isKw,
                    color,
                  }),
                ]
              : []),
            new TextRun({
              text: b.text,
              bold: isTech,
              italics: isKw,
              color,
            }),
          ],
        })
      }
      case 'bullet': {
        const { prefix, rest } = b.emphasizePrefix ? splitBulletPrefix(b.text) : { rest: b.text }
        return new Paragraph({
          numbering: { reference: 'resume-bullets', level: 0 },
          spacing: { before: 0, after: Math.round(1.5 * TWIPS_PER_PT), line, lineRule: LineRuleType.AUTO },
          children: prefix
            ? [new TextRun({ text: `${prefix} `, bold: true }), new TextRun({ text: rest })]
            : [new TextRun({ text: rest })],
        })
      }
    }
  })

  const indent = Math.round(m.bulletIndentIn * TWIPS_PER_IN)
  const doc = new Document({
    creator: resume.name || 'ResBuild',
    title: resume.name ? `${resume.name} - Resume` : 'Resume',
    styles: {
      default: {
        document: {
          run: { font: settings.font, size: halfPoints(m.body), color: '000000' },
          paragraph: { spacing: { line, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'resume-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: indent, hanging: Math.round(indent * 0.7) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: Math.round(m.pageWidthIn * TWIPS_PER_IN),
              height: Math.round(m.pageHeightIn * TWIPS_PER_IN),
            },
            margin: {
              top: Math.round(m.marginIn * TWIPS_PER_IN),
              bottom: Math.round(m.marginIn * TWIPS_PER_IN),
              left: Math.round(m.marginIn * TWIPS_PER_IN),
              right: Math.round(m.marginIn * TWIPS_PER_IN),
              header: 0,
              footer: 0,
            },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBlob(doc)
}
