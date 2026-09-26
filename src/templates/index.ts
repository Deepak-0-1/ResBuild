import type { TemplateId } from '../core/schema'
import { classic } from './classic'
import { compact } from './compact'
import { modern } from './modern'
import type { TemplateSpec } from './types'

export const TEMPLATES: Record<TemplateId, TemplateSpec> = { classic, modern, compact }
export const TEMPLATE_LIST: TemplateSpec[] = [classic, modern, compact]
export type { TemplateSpec }
