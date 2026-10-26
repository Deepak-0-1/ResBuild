import { describe, expect, it } from 'vitest'
import {
  emptyMasterBullet,
  emptyMasterEntry,
  emptyMasterProfile,
  isMasterProfileData,
  restoreProfileVersion,
  saveProfileVersion,
} from './masterProfileSchema'

// ─── Factories ───────────────────────────────────────────────────────────────

describe('emptyMasterProfile', () => {
  it('returns a valid MasterProfileData', () => {
    const p = emptyMasterProfile()
    expect(p.schemaVersion).toBe(1)
    expect(p.name).toBe('')
    expect(p.skills).toEqual([])
    expect(p.versions).toEqual([])
    expect(p.sections).toEqual([])
  })

  it('passes the isMasterProfileData guard', () => {
    expect(isMasterProfileData(emptyMasterProfile())).toBe(true)
  })
})

describe('emptyMasterEntry', () => {
  it('has required shape', () => {
    const e = emptyMasterEntry({ title: 'SWE', organization: 'Acme' })
    expect(e.title).toBe('SWE')
    expect(e.organization).toBe('Acme')
    expect(e.bullets).toEqual([])
    expect(e.tags).toEqual([])
  })
})

describe('emptyMasterBullet', () => {
  it('generates unique ids', () => {
    const a = emptyMasterBullet()
    const b = emptyMasterBullet()
    expect(a.id).not.toBe(b.id)
  })
})

// ─── isMasterProfileData guard ───────────────────────────────────────────────

describe('isMasterProfileData', () => {
  it('accepts valid profile', () => {
    expect(isMasterProfileData(emptyMasterProfile())).toBe(true)
  })

  it('rejects null / undefined', () => {
    expect(isMasterProfileData(null)).toBe(false)
    expect(isMasterProfileData(undefined)).toBe(false)
  })

  it('rejects wrong schemaVersion', () => {
    expect(isMasterProfileData({ schemaVersion: 2, name: 'x', skills: [] })).toBe(false)
  })

  it('rejects non-array skills', () => {
    expect(isMasterProfileData({ schemaVersion: 1, name: 'x', skills: 'bad' })).toBe(false)
  })

  it('rejects non-string name', () => {
    expect(isMasterProfileData({ schemaVersion: 1, name: 42, skills: [] })).toBe(false)
  })
})

// ─── Version snapshots ───────────────────────────────────────────────────────

describe('saveProfileVersion', () => {
  const base = { ...emptyMasterProfile(), name: 'Alice', headline: 'Engineer' }

  it('appends a version with label v1', () => {
    const p2 = saveProfileVersion(base, 'initial snapshot')
    expect(p2.versions).toHaveLength(1)
    expect(p2.versions[0].label).toBe('v1')
    expect(p2.versions[0].note).toBe('initial snapshot')
    expect(p2.versions[0].snapshot.name).toBe('Alice')
  })

  it('increments label on successive saves', () => {
    const p2 = saveProfileVersion(base)
    const p3 = saveProfileVersion(p2)
    expect(p3.versions).toHaveLength(2)
    expect(p3.versions[1].label).toBe('v2')
  })

  it('snapshot does not include versions key', () => {
    const p2 = saveProfileVersion(base)
    expect('versions' in p2.versions[0].snapshot).toBe(false)
  })

  it('working copy is unchanged (immutable return)', () => {
    saveProfileVersion(base)
    expect(base.versions).toHaveLength(0)
  })
})

describe('restoreProfileVersion', () => {
  const p0 = { ...emptyMasterProfile(), name: 'Alice' }
  const p1 = saveProfileVersion(p0, 'first')
  const p2 = { ...p1, name: 'Alice Updated' }
  const p3 = saveProfileVersion(p2, 'second')

  it('restores earlier snapshot data', () => {
    const restored = restoreProfileVersion(p3, 'v1')
    expect(restored.name).toBe('Alice')
  })

  it('preserves the full version history', () => {
    const restored = restoreProfileVersion(p3, 'v1')
    expect(restored.versions).toHaveLength(2)
  })

  it('restores latest version too', () => {
    const restored = restoreProfileVersion(p3, 'v2')
    expect(restored.name).toBe('Alice Updated')
  })

  it('throws for unknown label', () => {
    expect(() => restoreProfileVersion(p3, 'v99')).toThrow()
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('profile with skills', () => {
  it('accepts skill with all optional fields', () => {
    const p = emptyMasterProfile()
    p.skills.push({ name: 'TypeScript', category: 'Languages', level: 4, yearsExp: 3.5 })
    expect(isMasterProfileData(p)).toBe(true)
    expect(p.skills[0].level).toBe(4)
  })
})
