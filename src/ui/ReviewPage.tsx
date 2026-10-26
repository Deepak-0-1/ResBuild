import { useMemo, useState, type ReactNode } from 'react'
import * as edit from '../core/edit'
import { verbatimCheck } from '../core/parse/verbatimCheck'
import {
  sortSectionsStandard,
  uid,
  type ContactKind,
  type Entry,
  type Resume,
  type Section,
  type SectionKind,
  type SectionLayout,
} from '../core/schema'
import { Badge, Button, Card, IconButton, Select, TextArea, TextInput, Toggle } from './components'
import { DownIcon, MergeIcon, PlusIcon, SplitIcon, SwapIcon, TrashIcon, UpIcon } from './icons'
import { DragHandle, SortableItem, SortableList } from './Sortable'
import { JdMatchPanel } from './JdMatchPanel'

interface Props {
  resume: Resume
  onChange: (r: Resume) => void
  onNext: () => void
}

const KIND_OPTIONS: { value: SectionKind; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'skills', label: 'Skills' },
  { value: 'experience', label: 'Experience' },
  { value: 'projects', label: 'Projects' },
  { value: 'education', label: 'Education' },
  { value: 'certifications', label: 'Certifications' },
  { value: 'custom', label: 'Other (custom)' },
]

const LAYOUT_OPTIONS: { value: SectionLayout; label: string }[] = [
  { value: 'entries', label: 'Entries (title, dates, bullets)' },
  { value: 'list', label: 'Simple list (one per line)' },
  { value: 'skills', label: 'Skill groups' },
  { value: 'paragraph', label: 'Paragraph' },
]

const CONTACT_OPTIONS: { value: ContactKind; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'url', label: 'Website' },
  { value: 'location', label: 'Location' },
  { value: 'other', label: 'Other' },
]

export function ReviewPage({ resume, onChange, onNext }: Props) {
  const [editMode, setEditMode] = useState(false)
  const verbatim = useMemo(() => verbatimCheck(resume, true), [resume])
  const sectionIds = resume.sections.map((s) => s.id)
  const isStandardOrder = sortSectionsStandard(resume.sections).every((s, i) => s.id === sectionIds[i])

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <HeaderCard resume={resume} onChange={onChange} editMode={editMode} />

        {resume.unsorted.length > 0 && <UnsortedCard resume={resume} onChange={onChange} />}

        <SortableList ids={sectionIds} onMove={(from, to) => onChange(edit.reorderSections(resume, from, to))}>
          <div className="space-y-4">
            {resume.sections.map((section, i) => (
              <SortableItem key={section.id} id={section.id}>
                {(handle) => (
                  <SectionCard
                    resume={resume}
                    section={section}
                    index={i}
                    onChange={onChange}
                    editMode={editMode}
                    handle={<DragHandle {...handle} label={`Reorder section ${section.heading}`} />}
                  />
                )}
              </SortableItem>
            ))}
          </div>
        </SortableList>

        <Button variant="secondary" onClick={() => onChange(edit.addSection(resume))}>
          <PlusIcon /> Add section
        </Button>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
        <Card className="space-y-4 p-5">
          <div>
            <h3 className="font-semibold text-slate-900">Review the structure</h3>
            <p className="mt-1 text-sm text-slate-500">
              Check each item is in the right section. Drag to reorder. Your words are locked unless you turn on editing.
            </p>
          </div>
          <Toggle
            checked={editMode}
            onChange={setEditMode}
            label="Edit text"
            hint="Off by default so your content stays exactly as written."
          />
          <VerbatimStatus missing={verbatim.missing} added={verbatim.added} unsorted={resume.unsorted.length} />
          {!isStandardOrder && (
            <Button className="w-full" onClick={() => onChange({ ...resume, sections: sortSectionsStandard(resume.sections) })}>
              Use recommended section order
            </Button>
          )}
          <Button variant="primary" className="hidden w-full lg:inline-flex" onClick={onNext}>
            Continue to layout & export
          </Button>
        </Card>

        <JdMatchPanel resume={resume} onResumeChange={onChange} />
      </aside>

      {/* Mobile sticky Continue — desktop uses the sidebar button */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur lg:hidden">
        <Button variant="primary" className="w-full" onClick={onNext}>
          Continue to layout & export
        </Button>
      </div>
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  )
}

function VerbatimStatus({ missing, added, unsorted }: { missing: string[]; added: string[]; unsorted: number }) {
  if (!missing.length && !unsorted) {
    return (
      <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        <strong>All your words are included.</strong>
        {added.length > 0 && <span className="block text-xs">You edited {added.length} word(s).</span>}
      </div>
    )
  }
  return (
    <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      {unsorted > 0 && <strong className="block">{unsorted} line(s) need a section.</strong>}
      {missing.length > 0 && (
        <span className="block text-xs">
          Missing words: {[...new Set(missing)].slice(0, 12).join(', ')}
          {missing.length > 12 ? '…' : ''}
        </span>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ header

function HeaderCard({ resume, onChange, editMode }: { resume: Resume; onChange: (r: Resume) => void; editMode: boolean }) {
  const setContact = (contact: Resume['contact']) => onChange({ ...resume, contact })
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Header</h3>
      </div>
      {editMode ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextInput value={resume.name} placeholder="Full name" onChange={(e) => onChange({ ...resume, name: e.target.value })} />
          <TextInput
            value={resume.headline}
            placeholder="Headline (optional)"
            onChange={(e) => onChange({ ...resume, headline: e.target.value })}
          />
        </div>
      ) : (
        <div>
          <div className="text-xl font-bold text-slate-900">{resume.name || <span className="text-rose-500">No name detected</span>}</div>
          {resume.headline && <div className="text-slate-600">{resume.headline}</div>}
        </div>
      )}

      <ul className="mt-3 space-y-1.5">
        {resume.contact.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <Select
              label="Contact type"
              value={c.kind}
              options={CONTACT_OPTIONS}
              onChange={(kind) => setContact(resume.contact.map((x) => (x.id === c.id ? { ...x, kind } : x)))}
              className="w-full shrink-0 text-xs sm:w-28"
            />
            {editMode ? (
              <TextInput
                value={c.text}
                onChange={(e) => setContact(resume.contact.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm">{c.text}</span>
            )}
            <div className="flex shrink-0">
              <IconButton label="Move up" disabled={i === 0} onClick={() => setContact(edit.moveItem(resume.contact, i, i - 1))}>
                <UpIcon />
              </IconButton>
              <IconButton
                label="Move down"
                disabled={i === resume.contact.length - 1}
                onClick={() => setContact(edit.moveItem(resume.contact, i, i + 1))}
              >
                <DownIcon />
              </IconButton>
              <IconButton
                label="Remove (moves to Unsorted)"
                onClick={() =>
                  onChange({ ...resume, contact: resume.contact.filter((x) => x.id !== c.id), unsorted: [...resume.unsorted, c.text] })
                }
              >
                <TrashIcon />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      {editMode && (
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => setContact([...resume.contact, { id: uid('c'), kind: 'other', text: '' }])}
        >
          <PlusIcon /> Add contact field
        </Button>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ unsorted

function UnsortedCard({ resume, onChange }: { resume: Resume; onChange: (r: Resume) => void }) {
  const options = [
    { value: '', label: 'Move to section…' },
    ...resume.sections.map((s) => ({ value: s.id, label: s.heading || s.kind })),
    { value: '__new__', label: '+ New section' },
  ]
  const place = (index: number, target: string) => {
    if (!target) return
    if (target === '__new__') {
      const withSection = edit.addSection(resume)
      onChange(edit.placeUnsorted(withSection, index, withSection.sections[withSection.sections.length - 1].id))
    } else onChange(edit.placeUnsorted(resume, index, target))
  }
  return (
    <Card className="border-amber-300 bg-amber-50/50 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-amber-900">Unsorted ({resume.unsorted.length})</h3>
      <p className="mb-3 text-xs text-amber-800">
        These lines are not in the resume yet. Move each one to a section, or discard it if you don't want it.
      </p>
      <ul className="space-y-2">
        {resume.unsorted.map((line, i) => (
          <li key={`${i}-${line}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
            <span className="min-w-0 flex-1 text-sm">{line}</span>
            <Select label="Move to section" value="" options={options} onChange={(v) => place(i, v)} className="text-xs" />
            <IconButton label="Discard this line" onClick={() => onChange(edit.discardUnsorted(resume, i))}>
              <TrashIcon />
            </IconButton>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ------------------------------------------------------------------ sections

function SectionCard({
  resume,
  section,
  index,
  onChange,
  editMode,
  handle,
}: {
  resume: Resume
  section: Section
  index: number
  onChange: (r: Resume) => void
  editMode: boolean
  handle: ReactNode
}) {
  const entryIds = section.entries.map((e) => e.id)
  const renamed = section.originalHeading && section.originalHeading !== section.heading
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        {handle}
        {editMode || section.kind === 'custom' ? (
          <TextInput
            value={section.heading}
            onChange={(e) => onChange(edit.renameSection(resume, section.id, e.target.value))}
            className="max-w-56 font-semibold"
            aria-label="Section heading"
          />
        ) : (
          <h3 className="font-semibold text-slate-900">{section.heading}</h3>
        )}
        {renamed && !editMode && <span className="text-xs text-slate-400">(you wrote "{section.originalHeading}")</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Select
            label="Section type"
            value={section.kind}
            options={KIND_OPTIONS}
            onChange={(k) => onChange(edit.changeSectionKind(resume, section.id, k))}
            className="text-xs"
          />
          <Select
            label="Section layout"
            value={section.layout}
            options={LAYOUT_OPTIONS}
            onChange={(l) => onChange(edit.changeSectionLayout(resume, section.id, l))}
            className="text-xs"
          />
          <IconButton
            label="Not a real section: merge into the section above"
            disabled={index === 0}
            onClick={() => onChange(edit.mergeSectionIntoPrevious(resume, section.id))}
          >
            <MergeIcon />
          </IconButton>
          <IconButton label="Remove section (content moves to Unsorted)" onClick={() => onChange(edit.removeSection(resume, section.id))}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>

      {section.entries.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">Empty section. Move lines here from Unsorted or other sections.</p>
      ) : (
        <SortableList ids={entryIds} onMove={(from, to) => onChange(edit.reorderEntries(resume, section.id, from, to))}>
          <div className="divide-y divide-slate-100">
            {section.entries.map((entry, i) => (
              <SortableItem key={entry.id} id={entry.id}>
                {(h) => (
                  <EntryCard
                    resume={resume}
                    section={section}
                    entry={entry}
                    index={i}
                    onChange={onChange}
                    editMode={editMode}
                    handle={section.entries.length > 1 ? <DragHandle {...h} label="Reorder entry" /> : <span className="w-6" />}
                  />
                )}
              </SortableItem>
            ))}
          </div>
        </SortableList>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ entries

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</span>
      <span>{value}</span>
    </span>
  )
}

function EntryCard({
  resume,
  section,
  entry,
  index,
  onChange,
  editMode,
  handle,
}: {
  resume: Resume
  section: Section
  entry: Entry
  index: number
  onChange: (r: Resume) => void
  editMode: boolean
  handle: ReactNode
}) {
  const patch = (p: Partial<Entry>) => onChange(edit.updateEntry(resume, section.id, entry.id, p))
  const others = resume.sections.filter((s) => s.id !== section.id)
  const isSkills = section.layout === 'skills'
  const isParagraph = section.layout === 'paragraph'
  const showHeader = !isParagraph

  return (
    <div className="group flex flex-col gap-2 bg-white py-3 sm:flex-row">
      <div className="flex min-w-0 flex-1 gap-2">
        {handle}
        <div className="min-w-0 flex-1 space-y-2">
          {showHeader &&
            (editMode ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <TextInput value={entry.title} placeholder={isSkills ? 'Category (optional)' : 'Title'} onChange={(e) => patch({ title: e.target.value })} />
                {!isSkills && (
                  <>
                    <TextInput value={entry.subtitle} placeholder="Organization / subtitle" onChange={(e) => patch({ subtitle: e.target.value })} />
                    <TextInput value={entry.dates} placeholder="Dates" onChange={(e) => patch({ dates: e.target.value })} />
                    <TextInput value={entry.location} placeholder="Location" onChange={(e) => patch({ location: e.target.value })} />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                {entry.title && <span className="font-semibold text-slate-900">{entry.title}</span>}
                <Field label="org" value={entry.subtitle} />
                <Field label="dates" value={entry.dates} />
                <Field label="loc" value={entry.location} />
                {!entry.title && !entry.subtitle && !entry.dates && !isSkills && section.layout === 'entries' && (
                  <Badge tone="amber">No header: merge with the entry above?</Badge>
                )}
              </div>
            ))}

          {entry.lines.map((line, li) =>
            editMode ? (
              <TextArea
                key={li}
                rows={Math.min(4, Math.ceil(line.length / 90) || 1)}
                value={line}
                onChange={(e) => patch({ lines: entry.lines.map((l, j) => (j === li ? e.target.value : l)) })}
              />
            ) : (
              <p key={li} className="text-sm text-slate-700">
                {line}
              </p>
            ),
          )}

          {entry.bullets.length > 0 && (
            <ul className="space-y-1">
              {entry.bullets.map((b, bi) => (
                <li key={b.id} className="flex flex-wrap items-start gap-1.5 text-sm text-slate-700 sm:flex-nowrap">
                  <span className="mt-0.5 text-slate-400">•</span>
                  {editMode ? (
                    <TextArea
                      rows={Math.min(4, Math.ceil(b.text.length / 90) || 1)}
                      value={b.text}
                      onChange={(e) => patch({ bullets: entry.bullets.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)) })}
                    />
                  ) : (
                    <span className="min-w-0 flex-1">{b.text}</span>
                  )}
                  <span className="flex shrink-0">
                    <IconButton label="Move bullet up" disabled={bi === 0} onClick={() => onChange(edit.moveBullet(resume, section.id, entry.id, bi, bi - 1))}>
                      <UpIcon />
                    </IconButton>
                    <IconButton
                      label="Move bullet down"
                      disabled={bi === entry.bullets.length - 1}
                      onClick={() => onChange(edit.moveBullet(resume, section.id, entry.id, bi, bi + 1))}
                    >
                      <DownIcon />
                    </IconButton>
                    {!isParagraph && (
                      <IconButton
                        label="This is a new entry header: split here"
                        onClick={() => onChange(edit.splitEntryAtBullet(resume, section.id, entry.id, b.id))}
                      >
                        <SplitIcon />
                      </IconButton>
                    )}
                    <IconButton label="Remove bullet (moves to Unsorted)" onClick={() => onChange(edit.removeBullet(resume, section.id, entry.id, b.id))}>
                      <TrashIcon />
                    </IconButton>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {editMode && (
            <div className="flex gap-2">
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => patch({ bullets: [...entry.bullets, { id: uid('b'), text: '' }] })}>
                <PlusIcon /> Bullet
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => patch({ lines: [...entry.lines, ''] })}>
                <PlusIcon /> Line
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-row items-center justify-end gap-1 sm:w-auto sm:flex-col sm:items-end">
        {others.length > 0 && (
          <Select
            label="Move entry to another section"
            value=""
            options={[{ value: '', label: 'Move to…' }, ...others.map((s) => ({ value: s.id, label: s.heading || s.kind }))]}
            onChange={(to) => to && onChange(edit.moveEntryToSection(resume, section.id, entry.id, to))}
            className="w-full text-xs sm:w-24"
          />
        )}
        <div className="flex">
          {section.layout === 'entries' && (entry.title || entry.subtitle) && (
            <IconButton label="Swap title and organization" onClick={() => onChange(edit.swapTitleSubtitle(resume, section.id, entry.id))}>
              <SwapIcon />
            </IconButton>
          )}
          <IconButton
            label="Merge with the entry above"
            disabled={index === 0}
            onClick={() => onChange(edit.mergeEntryWithPrevious(resume, section.id, entry.id))}
          >
            <MergeIcon />
          </IconButton>
          <IconButton label="Remove entry (moves to Unsorted)" onClick={() => onChange(edit.removeEntry(resume, section.id, entry.id))}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
