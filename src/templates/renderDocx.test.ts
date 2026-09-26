import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { parseResume } from '../core/parse/parseResume'
import { tokenize } from '../core/parse/verbatimCheck'
import { DEFAULT_SETTINGS, type TemplateId } from '../core/schema'
import { SAMPLE_CONTENT } from '../ui/sample'
import { renderDocx } from './renderDocx'

async function docxText(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  return xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

describe('renderDocx', () => {
  const resume = parseResume(SAMPLE_CONTENT)

  for (const template of ['classic', 'modern', 'compact'] as TemplateId[]) {
    it(`${template}: contains every word of the content`, async () => {
      const blob = await renderDocx(resume, { ...DEFAULT_SETTINGS, template, useStandardHeadings: false })
      const text = await docxText(blob)
      const out = new Set(tokenize(text))
      const missing = tokenize(SAMPLE_CONTENT).filter((t) => !out.has(t))
      expect(missing).toEqual([])
    })
  }

  it('uses no text boxes or images (skills may use a simple 2-col table)', async () => {
    const blob = await renderDocx(resume, DEFAULT_SETTINGS)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).not.toMatch(/<w:txbxContent|<w:drawing|<w:pict/)
    expect(Object.keys(zip.files).some((f) => f.startsWith('word/media/'))).toBe(false)
  })

  it('keeps list items verbatim', () => {
    const certs = resume.sections.find((s) => s.kind === 'certifications')!
    expect(certs.entries[0]).toMatchObject({ title: 'AWS Certified Solutions Architect – Associate', dates: '2022' })
  })
})
