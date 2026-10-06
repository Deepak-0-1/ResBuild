import { describe, expect, it } from 'vitest'
import { parseResume } from '../core/parse/parseResume'
import { DEFAULT_SETTINGS } from '../core/schema'
import { boldKeywordSpans, buildBlocks, collectKeywords, splitBulletPrefix } from './blocks'
import { classic } from './classic'
import { deedy } from './deedy'
import { jake } from './jake'

const SRC = `DEEPAK SINGH
AI/ML Engineer • AI Platform & Distributed Systems • Cloud / MLOps
Indore, India | +91-7566519721 | a@b.com | linkedin.com/in/x | github.com/x
PROFESSIONAL EXPERIENCE
BestPeers Infosystem — AI & Data Engineer Indore, India | Sep 2025 – Present
AI Agent Runtime & Orchestration: Engineered autonomous agent workflows using LangGraph.
KEY PLATFORM & AI PROJECTS
Ampol Price Optimiser Copilot — Hybrid Agentic RAG Platform
FastAPI, LangGraph, pgvector, Azure OpenAI, PostgreSQL, React, SSE
Architected an enterprise decision-intelligence platform enabling analysts to audit ML model recommendations across 1,000+ retail fuel stations.
`

describe('recruiter format blocks', () => {
  it('keeps project title — subtitle order (never reverses)', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, useStandardHeadings: false }, classic)
    const projectLine = blocks.find(
      (b) => b.type === 'entryLine' && b.left.includes('Ampol'),
    )
    expect(projectLine).toMatchObject({
      type: 'entryLine',
      left: 'Ampol Price Optimiser Copilot — Hybrid Agentic RAG Platform',
    })
  })

  it('renders skills as tabular skillRow blocks', () => {
    const src = `Name
email@x.com
CORE TECHNICAL SKILLS
Agent Runtimes & GenAI: LangChain, LangGraph, ReAct
Platform & Software Eng: FastAPI, Docker, CI/CD
`
    const r = parseResume(src)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, useStandardHeadings: false }, classic)
    const rows = blocks.filter((b) => b.type === 'skillRow')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows[0]).toMatchObject({ type: 'skillRow', label: 'Agent Runtimes & GenAI' })
    expect((rows[0] as { text: string }).text).toMatch(/LangChain/)
  })

  it('uses blue tech tone and bullets for projects', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, useStandardHeadings: false }, classic)
    const tech = blocks.find((b) => b.type === 'paragraph' && b.tone === 'tech')
    expect(tech).toBeTruthy()
    expect((tech as { text: string }).text).toMatch(/FastAPI/)
    const bullets = blocks.filter((b) => b.type === 'bullet')
    expect(bullets.some((b) => b.type === 'bullet' && /Architected/.test(b.text))).toBe(true)
  })

  it('formats experience as Company — Role', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, useStandardHeadings: false }, classic)
    const expLine = blocks.find((b) => b.type === 'entryLine' && b.left.includes('BestPeers'))
    expect(expLine).toMatchObject({
      type: 'entryLine',
      left: 'BestPeers Infosystem — AI & Data Engineer',
      right: 'Indore, India | Sep 2025 – Present',
    })
  })

  it('preserves user section headings when standard headings are off', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, useStandardHeadings: false }, classic)
    const headings = blocks.filter((b) => b.type === 'heading').map((b) => (b.type === 'heading' ? b.text : ''))
    expect(headings).toContain('KEY PLATFORM & AI PROJECTS')
    expect(headings).toContain('PROFESSIONAL EXPERIENCE')
  })

  it('peels tech + Keywords glued onto project title into blue/italic lines', () => {
    const src = `Name
a@b.com
PROJECTS
AI-Powered Mart Inventory Forecasting & Cloud Batch System — AWS Bedrock, SageMaker, PySpark, LangGraph, Python, Serverless REST APIs, Keywords: Batch Scoring, Feature Store Engineering, Distributed ETL, Cloud ML Deployment
• Built something useful for inventory forecasting across many SKUs.
`
    const r = parseResume(src)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, useStandardHeadings: false }, classic)
    const title = blocks.find((b) => b.type === 'entryLine' && /Mart Inventory/.test(b.left))
    expect(title).toMatchObject({
      type: 'entryLine',
      left: 'AI-Powered Mart Inventory Forecasting & Cloud Batch System',
    })
    expect((title as { left: string }).left).not.toMatch(/AWS Bedrock/)
    const tech = blocks.find((b) => b.type === 'paragraph' && b.tone === 'tech' && /AWS Bedrock/.test(b.text))
    expect(tech).toBeTruthy()
    const kw = blocks.find((b) => b.type === 'paragraph' && b.tone === 'keywords' && /Batch Scoring/.test(b.text))
    expect(kw).toBeTruthy()
  })
})

describe('Jake template', () => {
  it('uses role-first experience lines and Project | Tech', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, template: 'jake', useStandardHeadings: false }, jake)
    const roleLine = blocks.find((b) => b.type === 'entryLine' && b.left === 'AI & Data Engineer')
    expect(roleLine).toMatchObject({ type: 'entryLine', left: 'AI & Data Engineer', bold: true })
    const companyLine = blocks.find((b) => b.type === 'entryLine' && b.left === 'BestPeers Infosystem')
    expect(companyLine).toMatchObject({ type: 'entryLine', italic: true })
    const project = blocks.find((b) => b.type === 'entryLine' && /Ampol/.test(b.left))
    expect(project).toBeTruthy()
    expect((project as { leftPipe?: { before: string; after: string } }).leftPipe?.before).toMatch(/Ampol/)
    expect((project as { leftPipe?: { before: string; after: string } }).leftPipe?.after).toMatch(/FastAPI/)
  })

  it('renders skills as plain paragraphs with labels, not skillRow tables', () => {
    const src = `Name
email@x.com
SKILLS
Languages: Python, TypeScript
Frameworks: FastAPI, React
`
    const r = parseResume(src)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, template: 'jake' }, jake)
    expect(blocks.filter((b) => b.type === 'skillRow')).toHaveLength(0)
    const paras = blocks.filter((b) => b.type === 'paragraph' && b.label)
    expect(paras.length).toBeGreaterThanOrEqual(2)
    expect(paras[0]).toMatchObject({ label: 'Languages', text: expect.stringMatching(/Python/) })
  })

  it('collects keywords and bolds spans without changing words', () => {
    const src = `Name
a@b.com
SKILLS
Languages: Python, FastAPI
EXPERIENCE
Acme — Engineer
• Built APIs with FastAPI and Python for production.
`
    const r = parseResume(src)
    const kws = collectKeywords(r)
    expect(kws.some((k) => /FastAPI/i.test(k))).toBe(true)
    const spans = boldKeywordSpans('Built APIs with FastAPI and Python for production.', kws)
    expect(spans.map((s) => s.text).join('')).toBe('Built APIs with FastAPI and Python for production.')
    expect(spans.some((s) => s.bold && /FastAPI/i.test(s.text))).toBe(true)
  })
})

describe('Deedy template', () => {
  it('emits splitHeader and company-first experience with nested bullets', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, template: 'deedy', useStandardHeadings: false }, deedy)
    expect(blocks.some((b) => b.type === 'splitHeader')).toBe(true)
    const company = blocks.find((b) => b.type === 'entryLine' && /BestPeers/.test(b.left))
    expect(company).toMatchObject({ type: 'entryLine', bold: true, bulletMarker: true })
    const nested = blocks.filter((b) => b.type === 'bullet' && b.nested)
    expect(nested.length).toBeGreaterThan(0)
    expect(nested.some((b) => b.type === 'bullet' && b.emphasizePrefix)).toBe(true)
  })

  it('formats projects as bold-prefix bullets', () => {
    const r = parseResume(SRC)
    const blocks = buildBlocks(r, { ...DEFAULT_SETTINGS, template: 'deedy', useStandardHeadings: false }, deedy)
    const proj = blocks.find((b) => b.type === 'bullet' && /Ampol/.test(b.text))
    expect(proj).toBeTruthy()
    expect((proj as { emphasizePrefix: boolean }).emphasizePrefix).toBe(true)
    const split = splitBulletPrefix((proj as { text: string }).text)
    expect(split.prefix).toMatch(/Ampol/)
  })
})
