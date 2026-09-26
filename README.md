# ResBuild - ATS Resume Formatter

Paste (or upload) your exact resume content and get a clean, ATS-optimized resume as **DOCX** or **PDF**.

- **Your words are never changed.** The app only organizes content into sections and optimizes the layout. A built-in verbatim check confirms every word of your input is in the output.
- **Runs on any device, free, offline.** It is a static web app (PWA) with no server, no AI model and no account. Everything happens in your browser; nothing is uploaded.
- **ATS-safe by design.** Single column, standard headings, no tables, text boxes, images or header/footer content.

## How it works

1. **Content**: paste text, or upload `.docx`, `.pdf` or `.txt`.
2. **Review**: check the detected structure. Drag to reorder sections and entries, move items between sections, split or merge entries, and place any "Unsorted" lines. Text is read-only unless you turn on "Edit text".
3. **Layout & export**: pick a template (Classic, Modern, Compact), a page target (1 or 2) and let **Auto-fit** choose the most readable font size, spacing and margins that fit. Then download a DOCX or print to PDF. The ATS check lists issues such as a missing email, inconsistent date formats, long bullets or special characters. It only warns; it never edits your text.

Drafts are saved automatically in the browser (IndexedDB).

## Writing content the parser understands best

```
Jane Doe
Software Engineer
jane@email.com | +1 555 123 4567 | linkedin.com/in/janedoe | Austin, TX

SUMMARY
One or two sentences...

SKILLS
Languages: Python, TypeScript
Tools: Docker, AWS

EXPERIENCE
Software Engineer | Acme Corp | Jan 2022 - Present
Austin, TX
• What you did and the result
• Another bullet

EDUCATION
BS Computer Science | University of Texas | 2018 - 2022
```

## Development

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # parser, verbatim and DOCX tests
npm run build    # production build in dist/
```

### Project layout

| Path | Purpose |
| --- | --- |
| `src/core/schema.ts` | Resume types and defaults |
| `src/core/parse/` | File to text, rule-based parser, heading aliases, verbatim check |
| `src/core/edit.ts` | Review-screen operations (never drop words) |
| `src/core/layout/` | Shared metrics and the auto-fit optimizer |
| `src/core/ats/atsChecks.ts` | ATS warning report |
| `src/templates/` | Template specs plus the DOCX and HTML renderers (built from the same block model) |
| `src/ui/` | React screens |

## Free deployment

The build is a static folder (`dist/`) that works offline after the first visit.

- **GitHub Pages**: push to a GitHub repo, then in *Settings > Pages* set *Source* to **GitHub Actions**. The included workflow `.github/workflows/deploy.yml` tests, builds (with the correct `/repo-name/` base path) and deploys on every push to `main`.
- **Cloudflare Pages / Netlify / Vercel**: build command `npm run build`, output directory `dist`. No base path is needed.
- **Any device without internet**: run `npm run build` and serve `dist/` with any static server (for example `npx serve dist`). You can also install the app from the browser menu ("Install app" / "Add to Home screen").

## Notes

- Page counts in the preview are measured in the browser. Word can lay text out slightly differently, so auto-fit keeps a small safety margin.
- If Calibri or Garamond is not installed on a device, the preview uses a metric-compatible fallback, and the DOCX still specifies the chosen font.
