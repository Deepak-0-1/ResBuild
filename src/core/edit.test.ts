import { describe, expect, it } from 'vitest'
import { appendSkillKeyword } from './edit'
import { emptyEntry, type Resume } from './schema'

function baseResume(partial: Partial<Resume> = {}): Resume {
  return {
    name: 'Jane Doe',
    headline: 'Engineer',
    contact: [],
    sections: [],
    unsorted: [],
    discarded: [],
    sourceText: 'Jane Doe\nEngineer',
    ...partial,
  }
}

describe('appendSkillKeyword', () => {
  it('creates a Skills section when none exists', () => {
    const next = appendSkillKeyword(baseResume(), 'TypeScript')
    const skills = next.sections.find((s) => s.kind === 'skills')
    expect(skills).toBeDefined()
    expect(skills!.heading).toBe('Skills')
    expect(skills!.entries).toHaveLength(1)
    expect(skills!.entries[0].lines).toEqual(['TypeScript'])
  })

  it('appends to the last skills line with a comma', () => {
    const resume = baseResume({
      sections: [
        {
          id: 's1',
          kind: 'skills',
          layout: 'skills',
          originalHeading: 'Skills',
          heading: 'Skills',
          entries: [emptyEntry({ lines: ['Python, React'] })],
        },
      ],
    })
    const next = appendSkillKeyword(resume, 'Docker')
    expect(next.sections[0].entries[0].lines).toEqual(['Python, React, Docker'])
  })

  it('is a no-op when the keyword token already exists in the resume', () => {
    const resume = baseResume({
      sections: [
        {
          id: 's1',
          kind: 'skills',
          layout: 'skills',
          originalHeading: 'Skills',
          heading: 'Skills',
          entries: [emptyEntry({ lines: ['TypeScript, React'] })],
        },
      ],
    })
    const next = appendSkillKeyword(resume, 'typescript')
    expect(next).toBe(resume)
    expect(next.sections[0].entries[0].lines).toEqual(['TypeScript, React'])
  })

  it('ignores empty keywords', () => {
    const resume = baseResume()
    expect(appendSkillKeyword(resume, '   ')).toBe(resume)
  })
})
