import type { TemplateId } from '../core/schema'

export interface TemplateSpec {
  id: TemplateId
  name: string
  description: string
  nameAlign: 'left' | 'center'
  /** Name font size = body size x nameScale. */
  nameScale: number
  nameUppercase: boolean
  /** Hex without #. Name color (usually black for ATS). */
  nameColor: string
  headlineItalic: boolean
  /** Hex without #. Optional accent on the headline line. */
  headlineColor: string
  contactSeparator: string
  /** Hex without #. Color for email / LinkedIn / GitHub in the contact line. */
  linkColor: string
  /** Thin rule under the header block (name / headline / contact). */
  headerRule: boolean
  headingUppercase: boolean
  /** Heading font size = body size x headingScale. */
  headingScale: number
  headingRule: boolean
  /** Hex without #. Section heading color. */
  headingColor: string
  /** Hex without #. Project tech-stack line. */
  techColor: string
  /** Hex without #. Keywords meta line. */
  keywordsColor: string
  subtitleItalic: boolean
  /**
   * Experience/projects header as "Company — Role" on one line with
   * "Location | Dates" right-aligned (recruiter scan pattern).
   */
  companyRoleLine: boolean
  /** Bold the label before the first colon in experience bullets. */
  boldBulletPrefix: boolean
  /** Join short list sections (certs) with middle dots on one line. */
  joinListWithDots: boolean
  /** Multiplies the vertical gaps between entries and after headings. */
  spacingScale: number
  bulletIndentIn: number

  /** Header: centered contact line vs Deedy-style name left / contact right. */
  headerLayout: 'centered' | 'splitContact'
  /** Experience line order (ignored when companyRoleLine is true). */
  experienceOrder: 'companyFirst' | 'roleFirst' | 'combined'
  /** How project titles are laid out. */
  projectTitleStyle: 'titleOnly' | 'namePipeTech' | 'boldPrefix'
  /** Deedy: open-circle nested bullets under org/role. */
  nestedBullets: boolean
  /** Classic: 2-col skill table. Jake/Deedy: plain lines. */
  skillsTable: boolean
  /** Bold skill/tech tokens inside bullets and skill item text. */
  boldKeywords: boolean
  /** Deedy: solid bullet marker before org/school lines. */
  entryBulletMarker: boolean
}
