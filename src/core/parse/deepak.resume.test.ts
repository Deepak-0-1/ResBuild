import { describe, expect, it } from 'vitest'
import { parseResume } from './parseResume'
import { verbatimCheck } from './verbatimCheck'

/**
 * Real-world resume paste that previously broke the parser:
 * - keyword tagline + contact line after it
 * - two-column Core Competencies dump (labels then values)
 * - wrapped bullets ending mid-list
 * - "Tech Stack:" lines inside projects
 */
const DEEPAK = `DEEPAK SINGH
AI Engineer
Python | LLM | RAG | GenAI | AI Agents | LangChain | LangGraph | AWS | Azure
dsdeep2324@gmail.com | +91-7566519721 | GitHub | LinkedIn | Indore, India
PROFESSIONAL SUMMARY
AI Engineer with 1.5+ years of production experience building RAG pipelines, agentic AI systems, and LLM-powered microservices handling millions of
records daily. Hands-on experience across Python, machine learning, NLP, deep learning, LLM applications, dataset preprocessing, model
training/evaluation/optimization, SQL, API integration, and multi-cloud AI deployment on AWS and Azure. Delivered measurable outcomes including
35% inference-latency reduction, 25% response-quality improvement, and 60% workflow automation.
CORE COMPETENCIES
Programming
AI / ML
LLM & GenAI
AI Agents
Frameworks
Cloud & MLOps
Databases
API & DevOps
Workflow & Tools
Python (Advanced), SQL, Git, OOP, Data Structures & Algorithms, Agile/Scrum
Machine Learning, Statistics Fundamentals, Model Evaluation & Optimization, Deep Learning, NLP, Scikit-learn, PyTorch, TensorFlow,
Keras, XGBoost, Isolation Forest, Pandas, NumPy
Large Language Models, RAG (Retrieval-Augmented Generation), Prompt Engineering, Fine-Tuning (LoRA/PEFT), OpenAI APIs,
Hugging Face Transformers, Embeddings
AI Agent Development, Agentic Workflow Design, LangChain, LangGraph, MCP, Multi-Agent Orchestration, Tool-Use Agents, ReAct
Agents
FastAPI, REST APIs, Microservices, Real-Time LLM Inference
AWS (EC2, S3, Lambda, SageMaker, Bedrock), Azure AI, Docker, CI/CD (GitHub Actions), MLflow, Model Quantization
PostgreSQL, Vector Databases, ChromaDB, Pinecone, Qdrant, FAISS
RESTful APIs, Swagger/OpenAPI, JWT, OAuth, Git, GitHub, CI/CD, Microservices
Hybrid Search (BM25 + Dense), Semantic Search, Reranking, Embeddings, Human-in-the-Loop Workflows
WORK EXPERIENCE
AI Engineer | BestPeers Infosystem | Sep 2025 – Present | Indore, India
• Designed and developed scalable backend systems integrating AI/ML and GenAI solutions using Python and FastAPI; built robust APIs for
production AI/LLM workloads.
• Built and deployed LLM-powered RAG applications for intelligent search, Q&A;, and contextual response generation using hybrid BM25 + dense
retrieval.
• Developed autonomous AI Agents using LangChain and LangGraph, implementing multi-step reasoning, tool-use pipelines, and agentic workflow
orchestration.
• Designed and deployed LangGraph state-machine workflows for complex multi-agent decision-making and task automation, with MCP-based tool
orchestration processing 1.5M+ records/day at <200ms latency.
• Integrated LLMs through AWS Bedrock and OpenAI APIs for content generation, summarization, and AI-driven decision-support systems.
• Designed end-to-end data pipelines for preprocessing, feature engineering, embeddings creation, and retrieval workflows; improved LLM response
accuracy by 25% across 1K+ daily inference requests.
• Built and deployed production ML models for classification, anomaly detection, predictive analytics, and time-series workloads using XGBoost,
Isolation Forest, and Scikit-learn.
• Evaluated and optimized model/system performance using accuracy and latency-oriented metrics, model quantization, and dynamic batching;
reduced inference latency by 35% and cloud spend by ~20%.
• Deployed and managed scalable AI applications on AWS EC2, S3, Lambda, and SageMaker, with Bedrock and Azure AI.
• Containerized 5+ AI microservices with Docker and implemented CI/CD using GitHub Actions; reduced deployment failures by 40% and improved
delivery speed.
• Implemented secure API authentication using JWT and OAuth; optimized PostgreSQL queries for large-scale AI workloads and ensured
performance, scalability, and security across AI/LLM-facing endpoints.
AI/ML Engineer Intern | IBM | Jul 2024 – Aug 2024 | Remote
• Delivered NLP and LLM-based solutions handling 1K+ inference requests/day; applied LoRA/PEFT fine-tuning to improve response quality by ~25%
with significantly reduced compute.
• Built semantic-search and embedding-based retrieval pipelines using ChromaDB and FAISS for knowledge retrieval in downstream LLM
applications.
• Implemented end-to-end ML pipelines (preprocessing fi training fi deployment) on AWS Lambda and S3, enabling serverless inference at scale.
KEY PROJECTS
AI-Powered Mart Inventory Forecasting & Management System
Developed a scalable AI-driven inventory forecasting system using ML, GenAI, and AI Agents to predict product demand, detect stock risks, and enable
intelligent decision-making through LLM-based natural language querying across 6,000+ products.
• Built and deployed an ML model for 10–15 day demand forecasting using historical time-series data.
• Developed an LLM-powered AI Agent using Amazon Bedrock and LangChain for intelligent inventory querying and real-time insights.
• Implemented agentic workflows using LangGraph for multi-step reasoning, inventory optimization decisions, and automated reorder logic.
• Implemented RAG-based architecture for context-aware responses and ReAct-based agent workflows for dynamic reasoning.
• Integrated ML models with APIs for real-time inference; created tool schemas and an embeddings pipeline for efficient LLM interaction.
• Optimized model and system performance for low latency and high scalability.
Tech Stack: Machine Learning, Amazon Bedrock, LangChain, LangGraph, AI Agents, RAG, ReAct, Demand Forecasting, Time-Series Analysis, Feature
Engineering, Model Inference, AWS SageMaker
Agentic Search Assistant — RAG + Tool-Augmented LLM (LangGraph)
Developed a tool-augmented LLM agent using LangGraph that autonomously selects retrieval tools—vector search, web search, and SQL lookup—based on
query intent, with cross-encoder reranking for top-k quality.
• Integrated ChromaDB and Pinecone for hybrid dense + sparse retrieval.
• Deployed on AWS with real-time streaming via FastAPI, including production-ready observability and error recovery.
Tech Stack: LangGraph, RAG, ChromaDB, Pinecone, Hybrid Retrieval, Reranking, FastAPI, AWS
Image & Video Insights Generator — Multimodal AI Pipeline
Designed a multimodal AI pipeline using ResNet for classification, YOLO for object detection, and LSTM for temporal modeling, achieving 92% accuracy on
large-scale datasets with TensorFlow and PyTorch.
• Built a scalable inference service for batch video-frame processing with automated LLM-based insight summarization.
Tech Stack: TensorFlow, PyTorch, ResNet, YOLO, LSTM, LLMs, Multimodal AI
EDUCATION
Bachelor of Technology (B.Tech) — Artificial Intelligence & Machine Learning
Indore Institute of Science and Technology | 2021 – 2025 | CGPA: 7.99 / 10.0
CERTIFICATIONS
• Google Certified Professional Machine Learning Engineer
• Data Science & Machine Learning — Comprehensive Program`

describe('Deepak resume (real paste)', () => {
  const r = parseResume(DEEPAK)

  it('parses header and contact', () => {
    expect(r.name).toBe('DEEPAK SINGH')
    expect(r.headline).toBe('AI Engineer')
    expect(r.contact.map((c) => c.kind)).toEqual(['other', 'email', 'phone', 'github', 'linkedin', 'location'])
    expect(r.contact.find((c) => c.kind === 'email')?.text).toBe('dsdeep2324@gmail.com')
    expect(r.unsorted).toEqual([])
  })

  it('pairs two-column core competencies', () => {
    const skills = r.sections.find((s) => s.kind === 'skills')!
    expect(skills.entries.map((e) => e.title)).toEqual([
      'Programming',
      'AI / ML',
      'LLM & GenAI',
      'AI Agents',
      'Frameworks',
      'Cloud & MLOps',
      'Databases',
      'API & DevOps',
      'Workflow & Tools',
    ])
    expect(skills.entries[3].lines[0]).toMatch(/ReAct Agents/)
    expect(skills.entries[1].lines[0]).toMatch(/Keras/)
  })

  it('parses experience with wrapped bullets', () => {
    const exp = r.sections.find((s) => s.kind === 'experience')!
    expect(exp.entries).toHaveLength(2)
    expect(exp.entries[0]).toMatchObject({
      title: 'AI Engineer',
      subtitle: 'BestPeers Infosystem',
      dates: 'Sep 2025 – Present',
      location: 'Indore, India',
    })
    expect(exp.entries[0].bullets.length).toBeGreaterThanOrEqual(11)
    expect(exp.entries[0].bullets.some((b) => /Isolation Forest, and Scikit-learn/.test(b.text))).toBe(true)
    expect(exp.entries[1]).toMatchObject({ title: 'AI/ML Engineer Intern', subtitle: 'IBM' })
  })

  it('keeps three projects with tech stacks', () => {
    const projects = r.sections.find((s) => s.kind === 'projects')!
    expect(projects.entries.map((e) => e.title)).toEqual([
      'AI-Powered Mart Inventory Forecasting & Management System',
      'Agentic Search Assistant',
      'Image & Video Insights Generator',
    ])
    expect(projects.entries[0].lines.some((l) => l.includes('AWS SageMaker'))).toBe(true)
    expect(projects.entries[1].lines.some((l) => l.startsWith('Tech Stack:'))).toBe(true)
    expect(projects.entries[2].bullets.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps every word', () => {
    expect(verbatimCheck(r).missing).toEqual([])
  })
})
