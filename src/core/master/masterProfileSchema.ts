/**
 * Master Resume Profile — versioned, typed source-of-truth.
 *
 * This is a superset of everything a candidate has ever done.  Tailored
 * drafts are slices of it.  It is stored separately from drafts and never
 * modified by the ATS/JD-match engine.
 *
 * Schema version: 1
 */

import { uid } from '../schema'

// ─── Primitive leaf types ────────────────────────────────────────────────────

/** ISO-8601 date string (YYYY-MM-DD) or a plain year string ("2024"). */
export type ISODate = string

/** A skill name together with its proficiency tier. */
export interface MasterSkill {
  /** Canonical name, e.g. "TypeScript", "AWS Lambda". */
  name: string
  /** Optional grouping label shown in the Skills section. */
  category?: string
  /**
   * Self-assessed proficiency on a 5-point scale:
   *   1 = Beginner  2 = Elementary  3 = Intermediate  4 = Advanced  5 = Expert
   */
  level?: 1 | 2 | 3 | 4 | 5
  /** Years of experience with this skill (fractional ok). */
  yearsExp?: number
}

/** A single achievement / responsibility bullet. */
export interface MasterBullet {
  id: string
  text: string
  /** Free-form tags the user attaches, e.g. "leadership", "backend". */
  tags: string[]
  /** Metric extracted from the bullet, e.g. "40%" or "2M req/day". */
  impact?: string
}

/** One role / project / education entry in the master profile. */
export interface MasterEntry {
  id: string
  title: string
  organization: string
  location?: string
  startDate?: ISODate
  endDate?: ISODate | 'present'
  bullets: MasterBullet[]
  /** Raw lines that are not bullets (summary paragraphs, skill lists). */
  lines: string[]
  /** Tags enabling fast filtering, e.g. "full-stack", "open-source". */
  tags: string[]
}

// ─── Top-level profile sections ──────────────────────────────────────────────

export interface MasterProfileSection {
  /** Mirrors SectionKind. */
  kind: 'experience' | 'projects' | 'education' | 'certifications' | 'custom'
  heading: string
  entries: MasterEntry[]
}

// ─── Version history ─────────────────────────────────────────────────────────

export interface ProfileVersion {
  /** Auto-assigned semver-style label, e.g. "v1", "v2". */
  label: string
  savedAt: number
  /** Reason the user saved this version (optional free-text). */
  note?: string
  /** Full snapshot of profile data at this point in time. */
  snapshot: Omit<MasterProfileData, 'versions'>
}

// ─── Core profile data ───────────────────────────────────────────────────────

export interface MasterProfileData {
  /** Increment when the schema changes in a breaking way. */
  schemaVersion: 1
  /** Human name (same as Resume.name). */
  name: string
  /** Professional headline / tagline. */
  headline: string
  contact: {
    email?: string
    phone?: string
    linkedin?: string
    github?: string
    location?: string
    website?: string
  }
  summary: string
  skills: MasterSkill[]
  sections: MasterProfileSection[]
  /** ISO timestamp of last manual save. */
  updatedAt: number
  /** Past snapshots; newest last. */
  versions: ProfileVersion[]
}

// ─── Persistence envelope ────────────────────────────────────────────────────

/** Stored in IDB under the key MASTER_PROFILE_KEY. */
export interface StoredMasterProfile {
  readonly id: 'master'
  data: MasterProfileData
}

// ─── Factory helpers ─────────────────────────────────────────────────────────

export function emptyMasterBullet(partial: Partial<MasterBullet> = {}): MasterBullet {
  return { id: uid('mb'), text: '', tags: [], ...partial }
}

export function emptyMasterEntry(partial: Partial<MasterEntry> = {}): MasterEntry {
  return {
    id: uid('me'),
    title: '',
    organization: '',
    bullets: [],
    lines: [],
    tags: [],
    ...partial,
  }
}

export function emptyMasterProfile(): MasterProfileData {
  return {
    schemaVersion: 1,
    name: '',
    headline: '',
    contact: {},
    summary: '',
    skills: [],
    sections: [],
    updatedAt: Date.now(),
    versions: [],
  }
}

/**
 * Save the current state as a named version snapshot.
 * Returns a new MasterProfileData with the snapshot appended.
 */
export function saveProfileVersion(profile: MasterProfileData, note?: string): MasterProfileData {
  const { versions, ...snapshot } = profile
  const newVersion: ProfileVersion = {
    label: 'v' + (versions.length + 1),
    savedAt: Date.now(),
    note,
    snapshot,
  }
  return { ...profile, versions: [...versions, newVersion] }
}

/**
 * Restore a named version back into the working copy.
 * The current working copy is NOT auto-snapshotted here.
 */
export function restoreProfileVersion(profile: MasterProfileData, label: string): MasterProfileData {
  const v = profile.versions.find((x) => x.label === label)
  if (!v) throw new Error('Version "' + label + '" not found')
  return {
    ...v.snapshot,
    schemaVersion: 1,
    versions: profile.versions,
    updatedAt: Date.now(),
  }
}

// ─── Guard ───────────────────────────────────────────────────────────────────

/** Type-guard — validates the stored blob is a recognisable profile. */
export function isMasterProfileData(raw: unknown): raw is MasterProfileData {
  if (!raw || typeof raw !== 'object') return false
  const r = raw as Record<string, unknown>
  return r['schemaVersion'] === 1 && typeof r['name'] === 'string' && Array.isArray(r['skills'])
}
