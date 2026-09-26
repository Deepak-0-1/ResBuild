import { useRef, useState, type DragEvent } from 'react'
import { fileToText } from '../core/parse/fileToText'
import { Button, Card } from './components'
import { UploadIcon } from './icons'
import { SAMPLE_CONTENT } from './sample'

interface Props {
  initialText: string
  onBuild: (text: string) => void
}

export function InputPage({ initialText, onBuild }: Props) {
  const [text, setText] = useState(initialText)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadFile = async (file: File) => {
    setError('')
    setLoading(true)
    try {
      setText(await fileToText(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void loadFile(file)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your resume content</h2>
            <p className="text-sm text-slate-500">
              Paste it exactly as you want it. Every word is kept; only structure and layout are optimized.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setText(SAMPLE_CONTENT)}>
              Load sample
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={loading}>
              <UploadIcon /> Upload file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void loadFile(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative rounded-lg transition-shadow ${dragging ? 'ring-4 ring-blue-300' : ''}`}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={'Jane Doe\njane@email.com | +1 555 123 4567 | City, Country\n\nSUMMARY\n...\n\nEXPERIENCE\nJob Title | Company | Jan 2022 - Present\n• What you did and the result\n\nEDUCATION\n...\n\nSKILLS\n...'}
            className="h-[55vh] min-h-80 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-relaxed focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-blue-50/80 text-sm font-medium text-blue-700">
              Drop a .docx, .pdf or .txt file (max 8 MB / 30 PDF pages)
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 text-sm text-slate-600">
              Reading file…
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {text.trim() ? `${text.trim().split(/\s+/).length} words` : 'Nothing entered yet'} · processed on your device,
            nothing is uploaded
          </span>
          <Button variant="primary" disabled={!text.trim()} onClick={() => onBuild(text)} className="px-5">
            Build resume
          </Button>
        </div>
      </Card>

      <Card className="h-fit p-5 text-sm">
        <h3 className="mb-3 font-semibold text-slate-900">Tips for a perfect result</h3>
        <ul className="space-y-2.5 text-slate-600">
          <li>
            <strong className="text-slate-800">Name on the first line</strong>, then contact details (email, phone,
            LinkedIn, city) separated by <code className="rounded bg-slate-100 px-1">|</code>.
          </li>
          <li>
            Use clear headings on their own line: <em>SUMMARY, SKILLS, EXPERIENCE, PROJECTS, EDUCATION, CERTIFICATIONS</em>.
          </li>
          <li>
            Job header on one line: <code className="rounded bg-slate-100 px-1">Title | Company | Jan 2022 - Present</code>
          </li>
          <li>
            One bullet per line, starting with <code className="rounded bg-slate-100 px-1">•</code> or{' '}
            <code className="rounded bg-slate-100 px-1">-</code>.
          </li>
          <li>
            Skills as groups: <code className="rounded bg-slate-100 px-1">Languages: Java, Python</code>
          </li>
          <li>Use one date format everywhere (e.g. "Jan 2022").</li>
          <li>You can fix anything the parser gets wrong in the next step.</li>
        </ul>
      </Card>
    </div>
  )
}
