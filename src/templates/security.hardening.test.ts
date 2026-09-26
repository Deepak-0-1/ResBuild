import { describe, expect, it } from 'vitest'
import { contactHref } from './blocks'
import { sanitizeLayoutSettings, DEFAULT_SETTINGS } from '../core/schema'

describe('contactHref hardening', () => {
  it('allows mailto and https linkedin/github', () => {
    expect(contactHref({ kind: 'email', text: 'a@b.com' })).toBe('mailto:a@b.com')
    expect(contactHref({ kind: 'linkedin', text: 'linkedin.com/in/x' })).toBe('https://linkedin.com/in/x')
    expect(contactHref({ kind: 'github', text: 'https://github.com/x' })).toBe('https://github.com/x')
    expect(contactHref({ kind: 'url', text: 'https://example.com/cv' })).toBe('https://example.com/cv')
  })

  it('upgrades http to https and rejects bad schemes/hosts', () => {
    expect(contactHref({ kind: 'url', text: 'http://example.com' })).toBe('https://example.com/')
    expect(contactHref({ kind: 'url', text: 'javascript:alert(1)' })).toBeUndefined()
    expect(contactHref({ kind: 'url', text: 'data:text/html,hi' })).toBeUndefined()
    expect(contactHref({ kind: 'linkedin', text: 'https://evil.com/linkedin.com' })).toBeUndefined()
    expect(contactHref({ kind: 'github', text: 'https://evil.com' })).toBeUndefined()
    expect(contactHref({ kind: 'email', text: 'not-an-email' })).toBeUndefined()
    expect(contactHref({ kind: 'email', text: 'a@b.com\nCc:x' })).toBeUndefined()
  })
})

describe('sanitizeLayoutSettings', () => {
  it('clamps numbers and rejects unknown enums', () => {
    const s = sanitizeLayoutSettings({
      // @ts-expect-error intentional junk
      template: 'hacker',
      marginIn: 99 as number,
      fontSize: Number.NaN,
      pageTarget: 2,
      autoFit: 1 as unknown as boolean,
    })
    expect(s.template).toBe(DEFAULT_SETTINGS.template)
    expect(s.marginIn).toBe(1)
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize)
    expect(s.pageTarget).toBe(2)
    expect(s.autoFit).toBe(true)
  })
})
