import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { LayoutSettings, Resume } from '../core/schema'
import { ResumeContent } from '../templates/renderHtml'

let host: HTMLDivElement | undefined
let root: Root | undefined

function ensureRoot(): { host: HTMLDivElement; root: Root } {
  if (!host || !root) {
    host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;'
    document.body.appendChild(host)
    root = createRoot(host)
  }
  return { host, root }
}

/** Renders the resume off-screen and returns its content height in CSS px. */
export function measureContentHeight(resume: Resume, settings: LayoutSettings): number {
  const { host, root } = ensureRoot()
  flushSync(() => root.render(<ResumeContent resume={resume} settings={settings} />))
  return host.firstElementChild?.getBoundingClientRect().height ?? 0
}
