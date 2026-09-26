import { describe, expect, it } from 'vitest'
import { parseResume } from './parseResume'
import { verbatimCheck } from './verbatimCheck'
import { extractDates, isLocation } from './patterns'

const SAMPLE = `Priya Sharma
Senior Software Engineer
priya.sharma@gmail.com | +91 98765 43210 | linkedin.com/in/priyasharma | Bengaluru, India

PROFESSIONAL SUMMARY
Backend engineer with 6 years of experience building scalable payment systems
and distributed services.

TECHNICAL SKILLS
Languages: Java, Python, Go
Cloud: AWS (EC2, S3, Lambda), Docker, Kubernetes

WORK EXPERIENCE
Senior Software Engineer | Razorpay | Jan 2021 - Present
Bengaluru, India
• Led migration of payment gateway to microservices, cutting latency by 40%
• Mentored 5 junior engineers
Software Engineer | Infosys | Jul 2018 - Dec 2020
- Built REST APIs in Spring Boot serving 2M requests/day
- Automated deployment pipeline with Jenkins

Projects
UPI Fraud Detector — Python, scikit-learn
• Trained a model on 1M transactions with 94% precision

EDUCATION
B.Tech in Computer Science, IIT Delhi, 2018

Certifications
AWS Certified Solutions Architect – Associate (2022)
Certified Kubernetes Administrator, 2023
`

describe('patterns', () => {
  it('extracts date ranges verbatim', () => {
    expect(extractDates('Engineer | Acme | Jan 2021 - Present')).toEqual({
      dates: 'Jan 2021 - Present',
      rest: 'Engineer | Acme',
    })
    expect(extractDates('B.Tech, IIT Delhi, 2018')?.dates).toBe('2018')
    expect(extractDates('Mar 2019 – Aug 2020')?.dates).toBe('Mar 2019 – Aug 2020')
  })

  it('detects locations', () => {
    expect(isLocation('Bengaluru, India')).toBe(true)
    expect(isLocation('San Francisco, CA')).toBe(true)
    expect(isLocation('Remote')).toBe(true)
    expect(isLocation('Computer Science')).toBe(false)
  })
})

describe('parseResume', () => {
  const resume = parseResume(SAMPLE)

  it('parses header', () => {
    expect(resume.name).toBe('Priya Sharma')
    expect(resume.headline).toBe('Senior Software Engineer')
    const kinds = resume.contact.map((c) => c.kind)
    expect(kinds).toEqual(['email', 'phone', 'linkedin', 'location'])
  })

  it('finds all sections in order', () => {
    expect(resume.sections.map((s) => s.kind)).toEqual([
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
      'certifications',
    ])
  })

  it('joins wrapped summary lines', () => {
    expect(resume.sections[0].entries[0].lines).toHaveLength(1)
  })

  it('parses skills groups', () => {
    const skills = resume.sections[1].entries
    expect(skills.map((e) => e.title)).toEqual(['Languages', 'Cloud'])
    expect(skills[1].lines[0]).toBe('AWS (EC2, S3, Lambda), Docker, Kubernetes')
  })

  it('splits experience entries', () => {
    const exp = resume.sections[2].entries
    expect(exp).toHaveLength(2)
    expect(exp[0]).toMatchObject({
      title: 'Senior Software Engineer',
      subtitle: 'Razorpay',
      dates: 'Jan 2021 - Present',
      location: 'Bengaluru, India',
    })
    expect(exp[0].bullets).toHaveLength(2)
    expect(exp[1].bullets[0].text).toBe('Built REST APIs in Spring Boot serving 2M requests/day')
  })

  it('parses education and certifications', () => {
    expect(resume.sections[4].entries[0]).toMatchObject({ dates: '2018' })
    const certs = resume.sections[5].entries
    expect(certs).toHaveLength(2)
    expect(certs[0].dates).toBe('2022')
  })

  it('keeps every word', () => {
    const report = verbatimCheck(resume)
    expect(report.missing).toEqual([])
    expect(report.added).toEqual([])
    expect(resume.unsorted).toEqual([])
  })

  it('handles a differently formatted resume', () => {
    const r = parseResume(`JOHN DOE
john.doe@mail.com    (555) 123-4567    San Francisco, CA

## Work History
Acme Corp — Remote
Frontend Developer, March 2020 to Present
- Built the design system used by 12 teams
- Reduced bundle size by 35% through code
splitting and lazy loading

Globex
Intern   06/2019 - 08/2019
* Wrote unit tests

Education:
University of California, Berkeley
BS Computer Science, 2019

Skills: React, TypeScript, Node.js, C++, C#

Languages
English, Spanish
`)
    expect(r.name).toBe('JOHN DOE')
    expect(r.contact.map((c) => c.kind)).toEqual(['email', 'phone', 'location'])
    const kinds = r.sections.map((s) => s.kind)
    expect(kinds).toEqual(['skills', 'experience', 'education', 'custom'])
    const exp = r.sections[1].entries
    expect(exp).toHaveLength(2)
    expect(exp[0]).toMatchObject({ title: 'Frontend Developer', subtitle: 'Acme Corp', location: 'Remote', dates: 'March 2020 to Present' })
    expect(exp[0].bullets[1].text).toBe('Reduced bundle size by 35% through code splitting and lazy loading')
    expect(exp[1]).toMatchObject({ title: 'Intern', subtitle: 'Globex', dates: '06/2019 - 08/2019' })
    expect(r.sections[0].entries[0].lines[0]).toBe('React, TypeScript, Node.js, C++, C#')
    expect(verbatimCheck(r).missing).toEqual([])
    expect(r.unsorted).toEqual([])
  })

  it('keeps unplaced text in unsorted', () => {
    const r = parseResume('Jane Doe\njane@x.com\nsome random note about things\nanother loose line')
    expect(r.unsorted.length).toBeGreaterThan(0)
    expect(verbatimCheck({ ...r, sections: r.sections }).missing.length).toBeGreaterThan(0)
  })
})
