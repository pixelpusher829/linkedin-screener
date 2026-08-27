# LinkedIn Screener & Pruner

LinkedIn Screener & Pruner is a self-hosted React app for reviewing job opportunities in bulk. Import saved jobs or job links, evaluate them against a candidate context document and screening rubric, organize the results, generate application answers, and identify low-fit roles for pruning.

## Features

- **Candidate profile and rubric:** Store a context document with work history, skills, achievements, and career preferences. The rubric defines target titles, seniority, location rules, salary expectations, required technologies, preferred industries, and dealbreakers.
- **Flexible imports:** Add jobs from direct LinkedIn or career-page URLs, copied Saved Jobs text or HTML, extractor-generated JSON, or a manual form.
- **Batch qualification:** Score many jobs at once and classify them as **Strong Keep**, **Consider**, or **Prune**. Results include a match score, fit summary, score modifiers, matched skills, missing requirements, and dealbreaker triggers.
- **Search, filters, and views:** Search by title, company, skills, or dealbreakers. Switch between a dense compact table and expanded job cards, then filter to all, keep, prune, or applied jobs.
- **LinkedIn two-way helper:** Pull saved jobs from the current authenticated LinkedIn tab and generate a script that highlights and unsaves jobs marked for pruning.
- **Application support:** Generate first-person answers to application questions using the candidate context and selected job, with standard, concise, storytelling, and direct tones.
- **Shortlist export:** Export non-pruned opportunities as CSV, JSON, or Markdown for spreadsheets, Notion, or another tracking system.

## Requirements

- Node.js 18+ or [Bun](https://bun.sh/)
- A Google Gemini API key for AI parsing, qualification, rubric syncing, and answer generation
- A modern browser for the web app and LinkedIn browser scripts

## Quick Start

```bash
bun install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set `GEMINI_API_KEY` in `.env`, then start the app:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app starts with a fictional demo context document so you can explore the workflow safely. Replace it through **Context Doc** before using the app for real applications. Your jobs, rubric, context document, and view settings are stored in your browser's local storage and are not shared with other visitors.

## Using The App

### 1. Configure your profile

Open **Context Doc** to add the candidate's background and evidence that should guide application answers. Open **Rubric** to review or edit the structured screening rules. The app includes defaults, and the rubric can be generated from the context document when Gemini is configured.

### 2. Import opportunities

Open **Import** and choose the method that matches your source:

- **Job URLs / Links:** Paste one or more links, one per line. LinkedIn job URLs and several common career-page formats are supported. The server attempts to extract the title, company, location, salary, and description.
- **Paste Tracker Text / HTML:** Copy the contents of your LinkedIn Saved Jobs list and paste it into the app. Valid extracted JSON is parsed immediately; other text and HTML can be parsed by Gemini or the local fallback extractor.
- **1-Click LinkedIn Tool:** Open your LinkedIn Saved Jobs page, copy the provided browser script, run it in the browser developer console, then paste the resulting JSON or URLs back into the app. This is useful when LinkedIn does not expose the saved-job list to a third-party API.
- **Manual Add:** Enter a title and company, then optionally add location, workplace type, salary, and URL.

Imported jobs remain in the local tracker and duplicate jobs are detected by the app's import helpers.

### 3. Qualify and review

Select **Qualify All** after importing jobs. The app processes the batch and displays a score and verdict for each role. Open a row or card to inspect the one-sentence assessment, score modifiers, matched and missing skills, location and salary fit, and any dealbreakers. Use search, status filters, sorting, and the compact or detailed view to narrow the list.

Mark promising jobs as applied with the bookmark action. Use **Answer Gen** to select a job and enter an application question; the generated response is grounded in the context document and can be refined by tone.

### 4. Prune or export

Jobs classified as **Prune** are marked for review rather than immediately deleted. You can manually mark or unmark jobs, remove tracker entries, or open **LinkedIn Sync** to generate a browser script that targets the marked LinkedIn listings for unsaving. Review the targets before running that script.

When you have a shortlist, choose **Export** to download qualified jobs as CSV, JSON, or Markdown. Exported records include the role details, score, verdict, URL, and summary where available.

The LinkedIn scripts run in your browser session. They do not require LinkedIn credentials in this app, and LinkedIn may change its page structure or restrict automated requests at any time.

## Configuration

The server reads these environment variables:

| Variable         | Required    | Description                                                                                      |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `GEMINI_API_KEY` | Recommended | Enables Gemini-powered parsing, rubric extraction, qualification support, and applicant answers. |
| `APP_URL`        | Optional    | The hosted app URL used by some hosted environments.                                             |
| `PORT`           | No          | The current local server listens on port `3000`.                                                 |

When no Gemini key is available, local parsing and heuristic qualification fallbacks may still handle some workflows, but AI features will be unavailable or less complete.

## Commands

| Command           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `bun run dev`     | Start the local Express/Vite development server.    |
| `bun run build`   | Build the frontend and bundled server.              |
| `bun run start`   | Start the bundled production server after building. |
| `bun run lint`    | Run TypeScript validation.                          |
| `bun test`        | Run the test suite.                                 |
| `bun run preview` | Preview the Vite production build.                  |

## Deployment

The repository includes a `vercel.json` configuration for Vercel:

```bash
bun run build
```

Set `GEMINI_API_KEY` in the deployment provider's environment variables. The app intentionally does not use server-side persistence. Browser-local storage keeps each visitor's data separate, but clearing browser storage removes that data. Add authenticated external storage before relying on hosted persistence across devices.

## Public Repository Checklist

Before publishing this repository:

- Do not commit `app_state.json`; it is local runtime state and is ignored by Git.
- Purge any previously committed `app_state.json` and private context history before publishing this repository.
- Do not commit `.env` or any API keys. Only `.env.example` should be shared.
- Review the bundled browser scripts and the provider terms for any workflow you use.
- Confirm that your deployment has appropriate rate limits and access controls if it will not be private.

## Technology

- React 19 and TypeScript
- Vite
- Express
- Tailwind CSS
- Google Gemini API
- Cheerio
- Bun-compatible scripts and tooling
