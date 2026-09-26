import { createStore, del, get, set } from 'idb-keyval'
import type { Draft } from './schema'

const store = createStore('resbuild', 'drafts')
const INDEX_KEY = '__index__'
const CURRENT_KEY = '__current__'

interface DraftMeta {
  id: string
  title: string
  updatedAt: number
}

async function readIndex(): Promise<DraftMeta[]> {
  return (await get<DraftMeta[]>(INDEX_KEY, store)) ?? []
}

export async function listDrafts(): Promise<DraftMeta[]> {
  const index = await readIndex()
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadDraft(id: string): Promise<Draft | undefined> {
  return get<Draft>(id, store)
}

export async function saveDraft(draft: Draft): Promise<void> {
  await set(draft.id, draft, store)
  const index = (await readIndex()).filter((d) => d.id !== draft.id)
  index.push({ id: draft.id, title: draft.title, updatedAt: draft.updatedAt })
  await set(INDEX_KEY, index, store)
  await set(CURRENT_KEY, draft.id, store)
}

export async function deleteDraft(id: string): Promise<void> {
  await del(id, store)
  const index = (await readIndex()).filter((d) => d.id !== id)
  await set(INDEX_KEY, index, store)
  if ((await get<string>(CURRENT_KEY, store)) === id) await del(CURRENT_KEY, store)
}

export async function loadCurrentDraft(): Promise<Draft | undefined> {
  const id = await get<string>(CURRENT_KEY, store)
  return id ? loadDraft(id) : undefined
}

export type { DraftMeta }
