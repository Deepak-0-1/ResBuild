import { describe, expect, it } from 'vitest'
import { parseResume } from './parseResume'
import { runAtsChecks } from '../ats/atsChecks'
import { DEFAULT_SETTINGS } from '../schema'
import { verbatimCheck } from './verbatimCheck'

const V2 = `DEEPAK SINGH

AI/ML Engineer • AI Platform & Distributed Systems • Cloud / MLOps

Indore, India | +91-7566519721 | dsdeep2324@gmail.com | linkedin.com/in/deepaksingh917566519721 | github.com/Deepak-0-1
PROFESSIONAL SUMMARY
High-impact Software Engineer and AI/ML Systems Engineer with direct experience architecting enterprise AI developer platforms,
distributed batch processing engines, and autonomous agent runtimes. Proficient in Python, PySpark, FastAPI, Docker, and AWS/Azure
cloud infrastructure.
CORE TECHNICAL SKILLS
Agent Runtimes & GenAI: Agentic Orchestration (LangChain, LangGraph), ReAct, Model Context Protocol (MCP), Tool/Function
Calling, Stateful Planning, Memory Systems, Prompt Engineering, PEFT / LoRA Fine-Tuning
Platform & Software Eng: Self-Service API & SDK Design, Microservices, FastAPI, Flask, RESTful APIs, OpenAPI/Swagger,
SQLAlchemy, Docker, CI/CD (GitHub Actions), Unit & Integration Testing, AI Coding Agents & Copilots
Cloud, Infra & MLOps: AWS (SageMaker, Bedrock, Lambda, S3, Glue, Athena, CloudWatch, IAM, API Gateway), Azure AI/ML
Services, Event-Driven Architecture, Serverless Workflows, GPU Compute Right-Sizing
Observability & Governance: Evaluation Frameworks (LangSmith, DeepEval, Ragas), Hallucination & Drift Detection, Sandboxed
Execution, PostgreSQL, MongoDB, Cassandra, OAuth 2.0, JWT, Microsoft Entra ID (MSAL), RBAC
PROFESSIONAL EXPERIENCE
BestPeers Infosystem — AI & Data Engineer Indore, India | Sep 2025 – Present
AI Agent Runtime & Orchestration: Engineered autonomous agent workflows and runtime execution primitives using LangGraph,
ReAct, and Model Context Protocol (MCP); orchestrated tool calling, memory management, and deterministic state transitions.
High-Throughput Batch & Data Pipelines: Designed and operated scalable data ingestion and offline batch processing pipelines
handling 1.5M+ daily transaction records with sub-200ms latency and high operational reliability.
IBM — AI/ML & Data Engineer Intern Remote | Jul 2024 – Aug 2024
Distributed Computing & Batch Platforms: Engineered scalable ETL and batch data pipelines using Apache Spark, PySpark, and
Hadoop to clean, transform, and generate features across multi-gigabyte datasets for downstream scoring systems.
KEY PLATFORM & AI PROJECTS
Ampol Price Optimiser Copilot — Hybrid Agentic RAG Platform
FastAPI, LangGraph, pgvector, Azure OpenAI, PostgreSQL, React, SSE
Architected an enterprise decision-intelligence platform enabling analysts to audit ML model recommendations across 1,000+ retail fuel
stations.
AI-Powered Mart Inventory Forecasting & Cloud Batch System
AWS Bedrock, SageMaker, PySpark, LangGraph, Python, Serverless REST APIs
Architected an intelligent retail inventory forecasting platform managing 6,000+ SKUs.
EDUCATION & CERTIFICATIONS
Indore Institute of Science and Technology — Indore, India
Bachelor of Technology (B.Tech) in Artificial Intelligence & Machine Learning | CGPA: 7.99 / 10.0
2021 – 2025
Certifications & Continuous Learning: Google Certified Professional Machine Learning Engineer • Data Science & Machine Learning
Comprehensive Program`

describe('Deepak resume v2 (platform format)', () => {
  const r = parseResume(V2)

  it('detects all major sections', () => {
    expect(r.sections.map((s) => s.kind)).toEqual([
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
      'certifications',
    ])
    expect(r.unsorted).toEqual([])
  })

  it('parses skills groups including wrapped cloud line', () => {
    const skills = r.sections.find((s) => s.kind === 'skills')!
    expect(skills.entries.map((e) => e.title)).toEqual([
      'Agent Runtimes & GenAI',
      'Platform & Software Eng',
      'Cloud, Infra & MLOps',
      'Observability & Governance',
    ])
    expect(skills.entries[2].lines[0]).toMatch(/Azure AI\/ML Services/)
  })

  it('parses experience with role, company, location, dates, bullets', () => {
    const exp = r.sections.find((s) => s.kind === 'experience')!
    expect(exp.entries).toHaveLength(2)
    expect(exp.entries[0]).toMatchObject({
      title: 'AI & Data Engineer',
      subtitle: 'BestPeers Infosystem',
      location: 'Indore, India',
      dates: 'Sep 2025 – Present',
    })
    expect(exp.entries[0].bullets.length).toBeGreaterThanOrEqual(2)
    expect(exp.entries[1]).toMatchObject({
      title: 'AI/ML & Data Engineer Intern',
      subtitle: 'IBM',
      location: 'Remote',
    })
  })

  it('parses projects and education', () => {
    const projects = r.sections.find((s) => s.kind === 'projects')!
    expect(projects.entries.map((e) => e.title)).toEqual([
      'Ampol Price Optimiser Copilot',
      'AI-Powered Mart Inventory Forecasting & Cloud Batch System',
    ])
    // Descriptions become bullets; tech stacks stay as meta lines.
    expect(projects.entries[0].bullets.length).toBeGreaterThanOrEqual(1)
    expect(projects.entries[0].bullets[0].text).toMatch(/Architected/)
    const ampol = projects.entries[0]
    const techAnywhere = [
      ampol.subtitle,
      ...ampol.lines,
      ...ampol.bullets.map((b) => b.text),
    ].some((l) => /FastAPI|LangGraph/i.test(l))
    expect(techAnywhere).toBe(true)
    // Prefer tech stack as a meta line (not a bullet).
    expect(ampol.bullets.every((b) => !/^FastAPI,/i.test(b.text))).toBe(true)
    const edu = r.sections.find((s) => s.kind === 'education')!
    expect(edu.entries[0]).toMatchObject({
      title: 'Indore Institute of Science and Technology',
      location: 'Indore, India',
      dates: '2021 – 2025',
    })
  })

  it('passes core ATS section checks', () => {
    expect(verbatimCheck(r).missing).toEqual([])
    const ats = runAtsChecks(r, { ...DEFAULT_SETTINGS, pageTarget: 2 }, 1)
    const titles = ats.issues.map((i) => i.title)
    expect(titles).not.toContain('No Education section detected')
    expect(titles).not.toContain('No Skills section detected')
    expect(titles).not.toContain('Experience entries without dates')
    expect(ats.passed).toEqual(expect.arrayContaining([
      'Education section present',
      'Skills section present',
      'Experience/Projects section present',
    ]))
  })
})
