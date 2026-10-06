import type { CSSProperties, ReactNode } from 'react'
import type { LayoutSettings, Resume } from '../core/schema'
import { computeMetrics, FONT_STACKS } from '../core/layout/metrics'
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

interface Props {
  resume: Resume
  settings: LayoutSettings
}

/**
 * HTML twin of renderDocx: same blocks, same point sizes, same spacing.
 * Renders only the content box (page width minus margins), which is what
 * the preview paginates and what auto-fit measures.
 */
export function ResumeContent({ resume, settings }: Props) {
  const template = TEMPLATES[settings.template]
  const m = computeMetrics(settings, template)
  const blocks = buildBlocks(resume, settings, template)
  const keywords = template.boldKeywords ? collectKeywords(resume) : []
  const align = template.nameAlign
  const linkColor = `#${template.linkColor}`
  const techColor = `#${template.techColor}`
  const keywordsColor = `#${template.keywordsColor}`
  const headingColor = `#${template.headingColor}`
  const nameColor = `#${template.nameColor}`
  const headlineColor = `#${template.headlineColor}`
  const ruleColor = '#444444'

  const root: CSSProperties = {
    width: `${m.contentWidthIn}in`,
    fontFamily: FONT_STACKS[settings.font],
    fontSize: `${m.body}pt`,
    lineHeight: m.lineSpacing * 1.17,
    color: '#000',
    overflowWrap: 'break-word',
  }

  const renderSpans = (spans: TextSpan[]) =>
    spans.map((s, i) =>
      s.bold || s.italic ? (
        <span key={i} style={{ fontWeight: s.bold ? 700 : undefined, fontStyle: s.italic ? 'italic' : undefined }}>
          {s.text}
        </span>
      ) : (
        <span key={i}>{s.text}</span>
      ),
    )

  const maybeBold = (text: string) =>
    keywords.length ? renderSpans(boldKeywordSpans(text, keywords)) : text

  return (
    <div style={root} className="resume-content">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'name':
            return (
              <div
                key={i}
                style={{
                  textAlign: align,
                  fontSize: `${m.name}pt`,
                  fontWeight: 700,
                  color: nameColor,
                  lineHeight: 1.15,
                  marginBottom: '2pt',
                  textTransform: template.nameUppercase ? 'uppercase' : undefined,
                  letterSpacing: template.nameUppercase ? '0.02em' : undefined,
                }}
              >
                {b.text}
              </div>
            )
          case 'splitHeader':
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16pt',
                  marginBottom: '6pt',
                  breakInside: 'avoid',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {b.name && (
                    <div
                      style={{
                        fontSize: `${m.name}pt`,
                        fontWeight: 700,
                        color: nameColor,
                        lineHeight: 1.15,
                        textTransform: template.nameUppercase ? 'uppercase' : undefined,
                      }}
                    >
                      {b.name}
                    </div>
                  )}
                  {b.leftExtra && (
                    <div style={{ fontSize: `${m.body - 0.5}pt`, marginTop: '1pt' }}>
                      {(() => {
                        const href = contactHref({ kind: 'url', text: b.leftExtra })
                        return href ? (
                          <a
                            href={href}
                            onClick={(e) => e.preventDefault()}
                            style={{ color: linkColor, textDecoration: 'underline', cursor: 'default' }}
                          >
                            {b.leftExtra}
                          </a>
                        ) : (
                          b.leftExtra
                        )
                      })()}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontSize: `${m.body - 0.5}pt`, flexShrink: 0, whiteSpace: 'pre-line' }}>
                  {b.rightParts.map((part, pi) => {
                    const href = contactHref(part)
                    const link = isLinkKind(part.kind) && href
                    const node: ReactNode = link ? (
                      <a
                        href={href}
                        onClick={(e) => e.preventDefault()}
                        style={{ color: linkColor, textDecoration: 'underline', cursor: 'default' }}
                      >
                        {part.text}
                      </a>
                    ) : (
                      part.text
                    )
                    return (
                      <div key={pi}>
                        {part.label ? `${part.label} : ` : null}
                        {node}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          case 'headline':
            return (
              <div
                key={i}
                style={{
                  textAlign: template.headerLayout === 'splitContact' ? 'left' : align,
                  fontSize: `${m.body + 0.5}pt`,
                  fontWeight: 600,
                  color: headlineColor,
                  fontStyle: template.headlineItalic ? 'italic' : undefined,
                  marginBottom: '2pt',
                }}
              >
                {b.text}
              </div>
            )
          case 'contact':
            return (
              <div
                key={i}
                style={{
                  textAlign: align,
                  fontSize: `${m.body - 0.5}pt`,
                  marginBottom: '4pt',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {b.parts.map((part, pi) => {
                  const href = contactHref(part)
                  const link = isLinkKind(part.kind) && href
                  const node: ReactNode = link ? (
                    <a
                      href={href}
                      onClick={(e) => e.preventDefault()}
                      style={{ color: linkColor, textDecoration: 'underline', cursor: 'default' }}
                    >
                      {part.text}
                    </a>
                  ) : (
                    part.text
                  )
                  return (
                    <span key={pi}>
                      {pi > 0 ? template.contactSeparator : null}
                      {node}
                    </span>
                  )
                })}
              </div>
            )
          case 'headerRule':
            return (
              <div
                key={i}
                style={{
                  borderBottom: `0.75pt solid ${ruleColor}`,
                  marginBottom: `${Math.max(4, m.sectionBefore * 0.35)}pt`,
                  marginTop: '1pt',
                }}
              />
            )
          case 'heading':
            return (
              <div
                key={i}
                data-section-heading={b.text}
                style={{
                  marginTop: `${b.first ? m.sectionBefore * 0.55 : m.sectionBefore}pt`,
                  marginBottom: `${m.headingAfter}pt`,
                  fontSize: `${m.heading}pt`,
                  fontWeight: 700,
                  color: headingColor,
                  lineHeight: 1.17,
                  borderBottom: template.headingRule ? `0.75pt solid ${ruleColor}` : undefined,
                  paddingBottom: template.headingRule ? '1.5pt' : undefined,
                  breakAfter: 'avoid',
                }}
              >
                {b.text}
              </div>
            )
          case 'entryLine': {
            const leftNode = renderEntryLeft(b.left, b.leftBoldThru, b.bold, b.italic, b.leftPipe)
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12pt',
                  marginTop: b.gapBefore ? `${m.entryGap}pt` : 0,
                  breakInside: 'avoid',
                  breakAfter: 'avoid',
                }}
              >
                <span
                  style={{
                    fontWeight: b.bold && !b.leftBoldThru && !b.leftPipe ? 700 : undefined,
                    fontStyle: b.italic && !b.leftPipe ? 'italic' : undefined,
                    display: 'flex',
                    gap: '6pt',
                    minWidth: 0,
                  }}
                >
                  {b.bulletMarker ? <span style={{ flexShrink: 0 }}>•</span> : null}
                  <span>{leftNode}</span>
                </span>
                {b.right && <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{b.right}</span>}
              </div>
            )
          }
          case 'skillRow': {
            const labelText = b.label ? (b.label.endsWith(':') ? b.label : `${b.label}:`) : ''
            return (
              <div
                key={i}
                className="skill-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(1.6in, 28%) 1fr',
                  columnGap: '10pt',
                  alignItems: 'start',
                  borderBottom: '0.6pt solid #c5c5c5',
                  paddingTop: '3.5pt',
                  paddingBottom: '3.5pt',
                  breakInside: 'avoid',
                }}
              >
                <div style={{ fontWeight: 700, lineHeight: 1.25 }}>{labelText}</div>
                <div style={{ lineHeight: 1.25 }}>{b.text}</div>
              </div>
            )
          }
          case 'paragraph': {
            const isTech = b.tone === 'tech'
            const isKw = b.tone === 'keywords'
            const isMuted = b.tone === 'muted'
            return (
              <div
                key={i}
                style={{
                  marginTop: b.gapBefore ? `${m.entryGap}pt` : 0,
                  marginBottom: '1.5pt',
                  color: isTech ? techColor : isKw || isMuted ? keywordsColor : undefined,
                  fontWeight: isTech ? 700 : undefined,
                  fontStyle: isKw ? 'italic' : undefined,
                  breakInside: 'avoid',
                }}
              >
                {b.label && (
                  <strong style={{ color: isKw ? keywordsColor : undefined, fontStyle: isKw ? 'italic' : undefined }}>
                    {b.label}:{' '}
                  </strong>
                )}
                {keywords.length && !isTech && !isKw ? maybeBold(b.text) : b.text}
              </div>
            )
          }
          case 'bullet': {
            const { prefix, rest } = b.emphasizePrefix ? splitBulletPrefix(b.text) : { rest: b.text }
            const indent = b.nested ? m.bulletIndentIn * 1.15 : m.bulletIndentIn * 0.3
            const marker = b.nested ? '◦' : '•'
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  paddingLeft: `${indent}in`,
                  marginBottom: '1.5pt',
                  breakInside: 'avoid',
                }}
              >
                <span style={{ width: `${m.bulletIndentIn * 0.7}in`, flexShrink: 0 }}>{marker}</span>
                <span>
                  {prefix ? (
                    <>
                      <strong>{prefix}</strong> {keywords.length ? maybeBold(rest) : rest}
                    </>
                  ) : keywords.length ? (
                    maybeBold(rest)
                  ) : (
                    rest
                  )}
                </span>
              </div>
            )
          }
        }
      })}
    </div>
  )
}

function renderEntryLeft(
  left: string,
  boldThru: string | undefined,
  bold: boolean,
  italic: boolean,
  leftPipe?: { before: string; after: string },
) {
  if (leftPipe) {
    return (
      <>
        <strong>{leftPipe.before}</strong>
        <span> | </span>
        <span style={{ fontWeight: 400, fontStyle: 'italic' }}>{leftPipe.after}</span>
      </>
    )
  }
  if (boldThru && left.startsWith(boldThru)) {
    const rest = left.slice(boldThru.length)
    return (
      <>
        <strong>{boldThru}</strong>
        <span style={{ fontWeight: 400, fontStyle: italic ? 'italic' : undefined }}>{rest}</span>
      </>
    )
  }
  return bold ? <strong>{left}</strong> : left
}
