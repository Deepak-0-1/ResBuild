import { useEffect, useState } from 'react'
import { deleteDraft, listDrafts, type DraftMeta } from '../core/storage'
import { Button, Card, IconButton } from './components'
import { PlusIcon, TrashIcon } from './icons'

interface Props {
  currentId: string | undefined
  onOpen: (id: string) => void
  onNew: () => void
  onDeleted: (id: string) => void
}

export function DraftsPage({ currentId, onOpen, onNew, onDeleted }: Props) {
  const [drafts, setDrafts] = useState<DraftMeta[] | undefined>()

  useEffect(() => {
    void listDrafts().then(setDrafts)
  }, [])

  const remove = async (id: string) => {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    await deleteDraft(id)
    setDrafts(await listDrafts())
    onDeleted(id)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Saved drafts</h2>
            <p className="text-sm text-slate-500">Stored only in this browser on this device. Nothing is uploaded.</p>
          </div>
          <Button variant="primary" onClick={onNew}>
            <PlusIcon /> New resume
          </Button>
        </div>
        {!drafts ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No drafts yet. Your work is saved automatically as you go.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(d.id)}>
                  <div className="truncate font-medium text-slate-900">
                    {d.title}
                    {d.id === currentId && <span className="ml-2 text-xs font-normal text-blue-600">(open)</span>}
                  </div>
                  <div className="text-xs text-slate-500">Last edited {new Date(d.updatedAt).toLocaleString()}</div>
                </button>
                <Button onClick={() => onOpen(d.id)}>Open</Button>
                <IconButton label="Delete draft" onClick={() => void remove(d.id)}>
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
