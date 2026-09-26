/**
 * Converts an uploaded file to plain text lines. Words are kept exactly;
 * list items become "• " lines so the parser can recognise bullets.
 */

/** Hard cap so mammoth/pdfjs cannot freeze the tab on huge uploads. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_PDF_PAGES = 30

export async function fileToText(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is too large (max 8 MB). Try a smaller PDF/DOCX or paste the text instead.')
  }
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) return docxToText(file)
  if (name.endsWith('.pdf')) return pdfToText(file)
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return file.text()
  throw new Error('Unsupported file type. Please upload a .docx, .pdf, or .txt file.')
}

async function docxToText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const lines: string[] = []

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase()
      if (tag === 'ul' || tag === 'ol') {
        for (const li of Array.from(child.children)) {
          const nested = Array.from(li.children).filter((c) => /^(ul|ol)$/i.test(c.tagName))
          nested.forEach((n) => n.remove())
          const text = li.textContent?.trim()
          if (text) lines.push(`• ${text}`)
          nested.forEach((n) => walk(wrap(n)))
        }
      } else if (tag === 'table') {
        for (const row of Array.from(child.querySelectorAll('tr'))) {
          const cells = Array.from(row.children)
            .map((c) => c.textContent?.trim() ?? '')
            .filter(Boolean)
          if (cells.length) lines.push(cells.join('   '))
        }
      } else if (/^h[1-6]$/.test(tag)) {
        const text = child.textContent?.trim()
        if (text) lines.push('', text)
      } else {
        const text = child.textContent?.trim()
        if (text) lines.push(text)
      }
    }
  }

  const wrap = (el: Element) => {
    const div = doc.createElement('div')
    div.appendChild(el)
    return div
  }

  walk(doc.body)
  return lines.join('\n')
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`PDF has too many pages (max ${MAX_PDF_PAGES}). Paste the text or upload a shorter file.`)
  }
  const out: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    interface Item {
      str: string
      x: number
      y: number
      w: number
      h: number
    }
    const items: Item[] = []
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || 10 })
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x)
    const rows: Item[][] = []
    for (const item of items) {
      const row = rows[rows.length - 1]
      if (row && Math.abs(row[0].y - item.y) <= Math.max(2, item.h * 0.4)) row.push(item)
      else rows.push([item])
    }

    let prevY: number | undefined
    let prevH = 10
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x)
      let line = ''
      let end = 0
      for (const item of row) {
        if (line) {
          const gap = item.x - end
          const charW = item.h * 0.5
          line += gap > charW * 3 ? '   ' : gap > charW * 0.15 && !line.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : ''
        }
        line += item.str
        end = item.x + item.w
      }
      const y = row[0].y
      if (prevY !== undefined && prevY - y > prevH * 1.9) out.push('')
      out.push(line.replace(/\s+$/, ''))
      prevY = y
      prevH = row[0].h
    }
    out.push('')
  }
  return out.join('\n')
}
