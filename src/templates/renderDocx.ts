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
import {
  boldKeywordSpans,
  buildBlocks,
  collectKeywords,
  contactHref,
  isLinkKind,
  splitBulletPrefix,
  type TextSpan,
} from './blocks'
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

function spansToRuns(spans: TextSpan[], size?: number): TextRun[] {
  return spans.map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italic,
        size,
      }),
  )
}

/**
 * Builds a single-column Word document: no text boxes or images.
 * Skills use a simple 2-column table only when the template requests it;
 * Jake/Deedy use plain paragraphs with bold category labels.
 */
export async function renderDocx(resume: Resume, settings: LayoutSettings): Promise<Blob> {
  const template = TEMPLATES[settings.template]
  const m = computeMetrics(settings, template)
  const blocks = buildBlocks(resume, settings, template)
  const keywords = template.boldKeywords ? collectKeywords(resume) : []
  const contentWidth = Math.round(m.contentWidthIn * TWIPS_PER_IN)
  const labelWidth = Math.round(contentWidth * 0.28)
  const skillsWidth = contentWidth - labelWidth
  const line = Math.round(240 * m.lineSpacing)
  const center = template.nameAlign === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT
  const rightTab = [{ type: TabStopType.RIGHT, position: contentWidth }]
  const ruleColor = '444444'
  const bodySize = halfPoints(m.body)
  const smallSize = halfPoints(m.body - 0.5)

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
      case 'splitHeader': {
        const leftRuns: TextRun[] = []
        if (b.name) {
          leftRuns.push(
            new TextRun({
              text: template.nameUppercase ? b.name.toUpperCase() : b.name,
              bold: true,
              size: halfPoints(m.name),
              color: template.nameColor,
            }),
          )
        }
        if (b.leftExtra) {
          if (b.name) leftRuns.push(new TextRun({ text: '\n', size: smallSize }))
          leftRuns.push(new TextRun({ text: b.leftExtra, size: smallSize }))
        }
        const rightRuns: (TextRun | ExternalHyperlink)[] = []
        b.rightParts.forEach((part, pi) => {
          if (pi > 0) rightRuns.push(new TextRun({ text: '\n', size: smallSize }))
          if (part.label) rightRuns.push(new TextRun({ text: `${part.label} : `, size: smallSize }))
          const href = contactHref(part)
          if (isLinkKind(part.kind) && href) {
            rightRuns.push(
              new ExternalHyperlink({
                children: [
                  new TextRun({
                    text: part.text,
                    color: template.linkColor,
                    underline: {},
                    size: smallSize,
                  }),
                ],
                link: href,
              }),
            )
          } else {
            rightRuns.push(new TextRun({ text: part.text, size: smallSize }))
          }
        })
        // Two-cell table for split header (ATS reads left then right).
        return new Table({
          width: { size: contentWidth, type: WidthType.DXA },
          columnWidths: [Math.round(contentWidth * 0.55), Math.round(contentWidth * 0.45)],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: Math.round(contentWidth * 0.55), type: WidthType.DXA },
                  borders: {
                    top: NO_BORDER,
                    left: NO_BORDER,
                    right: NO_BORDER,
                    bottom: NO_BORDER,
                  },
                  children: [
                    new Paragraph({
                      spacing: { after: 60, line, lineRule: LineRuleType.AUTO },
                      children: leftRuns,
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: Math.round(contentWidth * 0.45), type: WidthType.DXA },
                  borders: {
                    top: NO_BORDER,
                    left: NO_BORDER,
                    right: NO_BORDER,
                    bottom: NO_BORDER,
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { after: 60, line, lineRule: LineRuleType.AUTO },
                      children: rightRuns,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      }
      case 'headline':
        return new Paragraph({
          alignment: template.headerLayout === 'splitContact' ? AlignmentType.LEFT : center,
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
          if (pi > 0) runs.push(new TextRun({ text: template.contactSeparator, size: smallSize }))
          const href = contactHref(part)
          if (isLinkKind(part.kind) && href) {
            runs.push(
              new ExternalHyperlink({
                children: [
                  new TextRun({
                    text: part.text,
                    color: template.linkColor,
                    underline: {},
                    size: smallSize,
                  }),
                ],
                link: href,
              }),
            )
          } else {
            runs.push(new TextRun({ text: part.text, size: smallSize }))
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
        if (b.bulletMarker) leftRuns.push(new TextRun({ text: '• ', bold: true }))
        if (b.leftPipe) {
          leftRuns.push(new TextRun({ text: b.leftPipe.before, bold: true }))
          leftRuns.push(new TextRun({ text: ' | ' }))
          leftRuns.push(new TextRun({ text: b.leftPipe.after, italics: true }))
        } else if (b.leftBoldThru && b.left.startsWith(b.leftBoldThru)) {
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
        const bodyRuns =
          keywords.length && !isTech && !isKw
            ? spansToRuns(boldKeywordSpans(b.text, keywords), bodySize)
            : [
                new TextRun({
                  text: b.text,
                  bold: isTech,
                  italics: isKw,
                  color,
                  size: bodySize,
                }),
              ]
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
                    size: bodySize,
                  }),
                ]
              : []),
            ...bodyRuns,
          ],
        })
      }
      case 'bullet': {
        const { prefix, rest } = b.emphasizePrefix ? splitBulletPrefix(b.text) : { rest: b.text }
        const restRuns = keywords.length
          ? spansToRuns(boldKeywordSpans(rest, keywords), bodySize)
          : [new TextRun({ text: rest, size: bodySize })]
        return new Paragraph({
          numbering: {
            reference: b.nested ? 'resume-bullets-nested' : 'resume-bullets',
            level: 0,
          },
          spacing: { before: 0, after: Math.round(1.5 * TWIPS_PER_PT), line, lineRule: LineRuleType.AUTO },
          children: prefix
            ? [new TextRun({ text: `${prefix} `, bold: true, size: bodySize }), ...restRuns]
            : restRuns,
        })
      }
    }
  })

  const indent = Math.round(m.bulletIndentIn * TWIPS_PER_IN)
  const nestedIndent = Math.round(m.bulletIndentIn * 1.6 * TWIPS_PER_IN)
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
        {
          reference: 'resume-bullets-nested',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '◦',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: nestedIndent, hanging: Math.round(indent * 0.7) } },
              },
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
