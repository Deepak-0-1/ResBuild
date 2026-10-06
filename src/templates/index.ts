import type { TemplateId } from '../core/schema'
import { classic } from './classic'
import { compact } from './compact'
import { deedy } from './deedy'
import { jake } from './jake'
import { modern } from './modern'
import type { TemplateSpec } from './types'

export const TEMPLATES: Record<TemplateId, TemplateSpec> = { jake, deedy, classic, modern, compact }
export const TEMPLATE_LIST: TemplateSpec[] = [jake, deedy, classic, modern, compact]
export type { TemplateSpec }
