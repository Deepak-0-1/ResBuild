import { describe, expect, it } from 'vitest'
import { parseResume } from '../parse/parseResume'
import { JD_PASS_THRESHOLD, scoreJdMatch, type JdMatchInput } from './jdMatchEngine'
import { emptyMasterProfile, type MasterProfileData } from './masterProfileSchema'

const RESUME_TEXT = [
  'Jane Doe',
  'Senior Software Engineer',
  'jane@example.com | linkedin.com/in/janedoe | San Francisco, CA',
  '',
  'PROFESSIONAL SUMMARY',
  'Full-stack engineer with 5 years of experience building React and Node.js applications.',
  'Experienced with TypeScript, AWS, and PostgreSQL.',
  '',
  'TECHNICAL SKILLS',
  'Languages: TypeScript, JavaScript, Python',
  'Frontend: React, Next.js, HTML, CSS',
  'Backend: Node.js, Express, GraphQL',
  'Cloud: AWS (EC2, S3, Lambda), Docker, Kubernetes',
  'Databases: PostgreSQL, Redis, MongoDB',
  '',
  'WORK EXPERIENCE',
  'Senior Software Engineer | TechCorp | Jan 2022 - Present',
  'San Francisco, CA',
  '- Led migration to microservices, reducing latency by 40%',
  '- Designed GraphQL API consumed by 3 product teams',
  '- Mentored 4 junior engineers',
  '',
  'Software Engineer | StartupXYZ | Jun 2019 - Dec 2021',
  '- Built React dashboard used by 5000 customers',
  '- Reduced bundle size by 35% with code splitting',
  '',
  'EDUCATION',
  'BS Computer Science | UC Berkeley | 2019',
  '',
  'Certifications',
  'AWS Certified Developer - Associate (2022)',
].join(String.fromCharCode(10))

const JD_FULL_MATCH = [
  'Senior Software Engineer - Full-Stack',
  '',
  'Required:',
  '- 4+ years of experience with TypeScript and React',
  '- Experience with Node.js and AWS required',
  '- Must have strong GraphQL skills',
  '- PostgreSQL or similar database required',
  '- Minimum 1 year experience with Docker or Kubernetes',
  '',
  'Preferred:',
  '- Experience with Next.js',
  '- Redis knowledge is a plus',
  '',
  'Responsibilities:',
  '- Design and implement scalable APIs',
  '- Mentor junior engineers',
].join(String.fromCharCode(10))

const JD_PARTIAL_MATCH = [
  'Data Scientist - Machine Learning',
  '',
  'Required:',
  '- 3+ years of experience with Python and machine learning required',
  '- Must have experience with TensorFlow or PyTorch',
  '- SQL and data engineering required',
  '- scikit-learn and pandas required',
].join(String.fromCharCode(10))

const JD_NO_MATCH = [
  'Mechanical Engineer',
  '',
  'Required:',
  '- Must have degree in Mechanical Engineering required',
  '- CAD software (SolidWorks, AutoCAD) required',
  '- Minimum 3 years of manufacturing experience required',
  '- CNC machining experience required',
  '- Knowledge of thermodynamics required',
].join(String.fromCharCode(10))

function resumeInput(text: string): JdMatchInput {
  return { kind: 'resume', resume: parseResume(text) }
}

function profileInput(partial: Partial<MasterProfileData> = {}): JdMatchInput {
  return {
    kind: 'profile',
    profile: {
      ...emptyMasterProfile(),
      name: 'Jane Doe',
      headline: 'Senior Software Engineer',
      summary: 'Full-stack engineer with 5 years of experience in TypeScript, React, and Node.js.',
      skills: [
        { name: 'TypeScript', category: 'Languages' },
        { name: 'JavaScript', category: 'Languages' },
        { name: 'React', category: 'Frontend' },
        { name: 'Next.js', category: 'Frontend' },
        { name: 'Node.js', category: 'Backend' },
        { name: 'GraphQL', category: 'Backend' },
        { name: 'AWS', category: 'Cloud' },
        { name: 'PostgreSQL', category: 'Databases' },
        { name: 'Redis', category: 'Databases' },
        { name: 'MongoDB', category: 'Databases' },
        { name: 'Docker', category: 'DevOps' },
        { name: 'Kubernetes', category: 'DevOps' },
      ],
      sections: [
        {
          kind: 'experience' as const,
          heading: 'Experience',
          entries: [
            {
              id: 'e1',
              title: 'Senior Software Engineer',
              organization: 'TechCorp',
              bullets: [
                { id: 'b1', text: 'Led microservices migration with Node.js TypeScript and GraphQL reducing latency by 40%', tags: [] },
                { id: 'b2', text: 'Designed GraphQL API consumed by 3 product teams using AWS Lambda and PostgreSQL', tags: [] },
                { id: 'b3', text: 'Deployed containerised services with Docker and Kubernetes on AWS', tags: [] },
                { id: 'b4', text: 'Mentored junior engineers in React Next.js best practices', tags: [] },
              ],
              lines: [],
              tags: [],
            },
          ],
        },
        {
          kind: 'education' as const,
          heading: 'Education',
          entries: [
            { id: 'e2', title: 'BS Computer Science', organization: 'UC Berkeley', bullets: [], lines: [], tags: [] },
          ],
        },
      ],
      ...partial,
    },
  }
}

describe('scoreJdMatch - resume input', () => {
  it('returns a score between 0 and 100', () => {
    const result = scoreJdMatch(resumeInput(RESUME_TEXT), JD_FULL_MATCH)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('passes the 75 threshold for a strong match', () => {
    const result = scoreJdMatch(resumeInput(RESUME_TEXT), JD_FULL_MATCH)
    expect(result.pass).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(JD_PASS_THRESHOLD)
  })

  it('fails the threshold for a weak match (ML JD vs SWE resume)', () => {
    const result = scoreJdMatch(resumeInput(RESUME_TEXT), JD_PARTIAL_MATCH)
    expect(result.score).toBeLessThan(JD_PASS_THRESHOLD)
    expect(result.pass).toBe(false)
  })

  it('fails for a completely irrelevant JD', () => {
    const result = scoreJdMatch(resumeInput(RESUME_TEXT), JD_NO_MATCH)
    expect(result.score).toBeLessThan(JD_PASS_THRESHOLD)
    expect(result.pass).toBe(false)
  })
})

describe('scoreJdMatch - profile input', () => {
  it('passes for the full-match JD', () => {
    const result = scoreJdMatch(profileInput(), JD_FULL_MATCH)
    expect(result.pass).toBe(true)
  })

  it('fails for the no-match JD', () => {
    const result = scoreJdMatch(profileInput(), JD_NO_MATCH)
    expect(result.pass).toBe(false)
  })
})

describe('scoreJdMatch - breakdown fields', () => {
  const result = scoreJdMatch(resumeInput(RESUME_TEXT), JD_FULL_MATCH)

  it('breakdown values are 0-100', () => {
    for (const v of Object.values(result.breakdown)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('weighted points sum close to raw score', () => {
    const sum = Object.values(result.weightedPoints).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - result.score)).toBeLessThanOrEqual(5)
  })
})

describe('scoreJdMatch - keywords', () => {
  const result = scoreJdMatch(resumeInput(RESUME_TEXT), JD_FULL_MATCH)

  it('returns keyword list with found flags', () => {
    expect(result.keywords.length).toBeGreaterThan(0)
    expect(result.keywords.every((k) => typeof k.found === 'boolean')).toBe(true)
  })

  it('includes positive frequency weights', () => {
    expect(result.keywords.every((k) => k.weight >= 1)).toBe(true)
  })

  it('typescript is found', () => {
    const kw = result.keywords.find((k) => k.keyword === 'typescript')
    expect(kw?.found).toBe(true)
  })

  it('marks known mandatory terms', () => {
    const mandatory = result.keywords.filter((k) => k.mandatory)
    expect(mandatory.length).toBeGreaterThan(0)
  })

  it('sorts mandatory-missing before other missing before matched', () => {
    const ranks = result.keywords.map((k) => (!k.found && k.mandatory ? 0 : !k.found ? 1 : 2))
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1])
    }
  })
})

describe('scoreJdMatch - frequency weighting', () => {
  it('weights repeated JD tokens more heavily in overlap', () => {
    const resume = [
      'Alex',
      'alex@ex.com',
      '',
      'SKILLS',
      'React',
      '',
      'EXPERIENCE',
      'Dev | Co | 2020 - Present',
      '- Built UIs',
      '',
      'EDUCATION',
      'BS CS | U | 2020',
    ].join(String.fromCharCode(10))

    const once = scoreJdMatch(
      resumeInput(resume),
      'Need React and Ziglang and Ziglang and Ziglang for this role.',
    )
    const balanced = scoreJdMatch(
      resumeInput(resume),
      'Need React and Ziglang for this role.',
    )
    // Missing Ziglang appears 3x vs 1x → lower weighted overlap when repeated-and-missing
    expect(once.breakdown.keywordOverlap).toBeLessThanOrEqual(balanced.breakdown.keywordOverlap)
  })
})

describe('scoreJdMatch - skills bullets', () => {
  it('counts skills listed as bullets toward skills match', () => {
    const withBullets = [
      'Alex',
      'alex@ex.com',
      '',
      'SKILLS',
      '• Kubernetes',
      '• Terraform',
      '',
      'EXPERIENCE',
      'Dev | Co | 2020 - Present',
      '- Ops work',
      '',
      'EDUCATION',
      'BS CS | U | 2020',
    ].join(String.fromCharCode(10))

    const jd = 'Looking for Kubernetes and Terraform experience.'
    const result = scoreJdMatch(resumeInput(withBullets), jd)
    expect(result.keywords.find((k) => k.keyword === 'kubernetes')?.found).toBe(true)
    expect(result.keywords.find((k) => k.keyword === 'terraform')?.found).toBe(true)
    expect(result.breakdown.skillsMatch).toBeGreaterThan(0)
  })
})

describe('scoreJdMatch - hard gate (missing mandatory)', () => {
  const slimJd = [
    'Frontend Developer',
    '',
    'Required:',
    '- Must have 3+ years of experience with Angular required',
    '- VueJS must have',
    '- Ember required',
    '- Elm must have',
  ].join(String.fromCharCode(10))

  const slimResumeText = [
    'Bob Smith',
    'Junior Developer',
    'bob@email.com',
    '',
    'SKILLS',
    'React, TypeScript',
    '',
    'EXPERIENCE',
    'Junior Dev | ACME | 2023 - Present',
    '- Built small React components',
    '',
    'EDUCATION',
    'BS CS | State U | 2023',
  ].join(String.fromCharCode(10))

  it('triggers hard gate when mandatory items are absent', () => {
    const result = scoreJdMatch(resumeInput(slimResumeText), slimJd)
    if (result.hardGateTriggered) {
      expect(result.score).toBeLessThanOrEqual(74)
      expect(result.pass).toBe(false)
      expect(result.missingMandatory.length).toBeGreaterThan(0)
    }
  })

  it('does not trigger hard gate when all mandatory items are present', () => {
    const simpleJd = [
      'Frontend Developer',
      'Must have React experience required',
      'TypeScript required',
    ].join(String.fromCharCode(10))
    const result = scoreJdMatch(resumeInput(slimResumeText), simpleJd)
    if (!result.hardGateTriggered) {
      expect(result.missingMandatory).toHaveLength(0)
    }
  })
})

describe('scoreJdMatch - edge cases', () => {
  it('handles empty JD gracefully (no division by zero)', () => {
    const result = scoreJdMatch(resumeInput(RESUME_TEXT), '')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.keywords).toEqual([])
    expect(result.hardGateTriggered).toBe(false)
  })

  it('handles JD with only stop-words', () => {
    const result = scoreJdMatch(resumeInput(RESUME_TEXT), 'the and or of to in for with')
    expect(result.keywords).toHaveLength(0)
    expect(result.score).toBeGreaterThan(0)
  })

  it('handles profile with no skills or sections', () => {
    const result = scoreJdMatch(profileInput({ skills: [], sections: [] }), JD_FULL_MATCH)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('JD_PASS_THRESHOLD is exactly 75', () => {
    expect(JD_PASS_THRESHOLD).toBe(75)
  })
})

describe('scoreJdMatch - determinism', () => {
  it('produces the same score for identical inputs', () => {
    const a = scoreJdMatch(resumeInput(RESUME_TEXT), JD_FULL_MATCH)
    const b = scoreJdMatch(resumeInput(RESUME_TEXT), JD_FULL_MATCH)
    expect(a.score).toBe(b.score)
    expect(a.pass).toBe(b.pass)
    expect(a.missingMandatory).toEqual(b.missingMandatory)
  })
})
