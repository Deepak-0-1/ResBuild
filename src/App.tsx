import { useEffect, useRef, useState } from 'react'
import { parseResume } from './core/parse/parseResume'
import { DEFAULT_SETTINGS, sanitizeLayoutSettings, uid, type LayoutSettings, type Resume } from './core/schema'
import { loadCurrentDraft, loadDraft, saveDraft } from './core/storage'
import { DraftsPage } from './ui/DraftsPage'
import { ExportPage } from './ui/ExportPage'
import { InputPage } from './ui/InputPage'
import { ReviewPage } from './ui/ReviewPage'

type Step = 'input' | 'review' | 'export' | 'drafts'

const STEPS: { id: Step; label: string }[] = [
  { id: 'input', label: '1. Content' },
  { id: 'review', label: '2. Review' },
  { id: 'export', label: '3. Layout & export' },
]

export default function App() {
  const [step, setStep] = useState<Step>('input')
  const [resume, setResume] = useState<Resume | undefined>()
  const [settings, setSettings] = useState<LayoutSettings>(DEFAULT_SETTINGS)
  const [draftId, setDraftId] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)
  const [inputKey, setInputKey] = useState(0)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    void loadCurrentDraft()
      .then((d) => {
        if (!d) return
        setDraftId(d.id)
        setResume(d.resume)
        setSettings(sanitizeLayoutSettings(d.settings))
        setStep('review')
      })
      .finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    if (!loaded || !resume || !draftId) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveDraft({
        id: draftId,
        title: resume.name ? `${resume.name}${resume.headline ? ` - ${resume.headline}` : ''}` : 'Untitled resume',
        updatedAt: Date.now(),
        resume,
        settings,
      })
    }, 600)
    return () => window.clearTimeout(saveTimer.current)
  }, [resume, settings, draftId, loaded])

  const build = (text: string) => {
    setResume(parseResume(text))
    if (!draftId) setDraftId(uid('d'))
    setStep('review')
  }

  const openDraft = async (id: string) => {
    const d = await loadDraft(id)
    if (!d) return
    setDraftId(d.id)
    setResume(d.resume)
    setSettings(sanitizeLayoutSettings(d.settings))
    setStep('review')
  }

  const newResume = () => {
    setDraftId(undefined)
    setResume(undefined)
    setSettings(DEFAULT_SETTINGS)
    setInputKey((k) => k + 1)
    setStep('input')
  }

  const canGo = (s: Step) => s === 'input' || s === 'drafts' || !!resume
  const applySettings = (s: LayoutSettings) => setSettings(sanitizeLayoutSettings(s))

  return (
    <div className="no-print min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
            <div>
              <div className="leading-tight font-bold text-slate-900">ResBuild</div>
              <div className="text-[11px] leading-tight text-slate-500">ATS resume formatter · offline · free</div>
            </div>
          </div>
          <nav className="order-last flex w-full items-center gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1" aria-label="Steps">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={!canGo(s.id)}
                onClick={() => setStep(s.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:text-slate-300 ${
                  step === s.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setStep('drafts')}
            className={`ml-auto rounded-lg px-3 py-1.5 text-sm font-medium ${step === 'drafts' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Drafts
          </button>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-6">
        {step === 'input' && <InputPage key={inputKey} initialText={resume?.sourceText ?? ''} onBuild={build} />}
        {step === 'review' && resume && <ReviewPage resume={resume} onChange={setResume} onNext={() => setStep('export')} />}
        {step === 'export' && resume && (
          <ExportPage resume={resume} settings={settings} onSettings={applySettings} onBack={() => setStep('review')} />
        )}
        {step === 'drafts' && (
          <DraftsPage
            currentId={draftId}
            onOpen={(id) => void openDraft(id)}
            onNew={newResume}
            onDeleted={(id) => id === draftId && newResume()}
          />
        )}
      </main>
    </div>
  )
}
