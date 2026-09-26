import { describe, expect, it } from 'vitest'
import { parseResume } from '../core/parse/parseResume'
import { DEFAULT_SETTINGS } from '../core/schema'
import { buildBlocks } from './blocks'
import { classic } from './classic'

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
