/**
 * Persistence layer for the Master Profile.
 * Uses a dedicated IDB store ("profiles") separate from drafts.
 */

import { createStore, get, set } from 'idb-keyval'
import { emptyMasterProfile, isMasterProfileData, type MasterProfileData } from './masterProfileSchema'

const profileStore = createStore('resbuild', 'profiles')
const MASTER_PROFILE_KEY = 'master'

/** Load the master profile; returns an empty one if nothing is saved yet. */
export async function loadMasterProfile(): Promise<MasterProfileData> {
  const raw = await get<unknown>(MASTER_PROFILE_KEY, profileStore)
  if (isMasterProfileData(raw)) return raw
  return emptyMasterProfile()
}

/** Persist the master profile. */
export async function saveMasterProfile(profile: MasterProfileData): Promise<void> {
  await set(MASTER_PROFILE_KEY, { ...profile, updatedAt: Date.now() }, profileStore)
}
