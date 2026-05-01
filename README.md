# Syllabus Planner

A React app with a small Vercel serverless route that turns pasted syllabus text into an editable course calendar and task list.

## Features

- Paste syllabus text.
- Import copied Blackboard calendar due-date text.
- Extract dated assignments, readings, quizzes, exams, projects, discussion posts, replies, and weekly reading items with OpenAI through a serverless backend route.
- Preserve the source syllabus excerpt for every item.
- Generate study reminders for exams and milestone reminders for projects.
- Calculate dates for Week 1, Week 2, Week 3, and similar syllabus sections from a course start date.
- Use meeting days such as Monday and Wednesday to schedule readings or prep before the first class meeting of the week.
- Edit every extracted field before exporting.
- Switch between an editable List View and a monthly Calendar View.
- Export CSV and `.ics` calendar files for Apple Calendar or Google Calendar import.
- CSV and calendar exports include imported Blackboard status, source, course code, due date, and due time where available.
- Store tasks in browser `localStorage`.
- Falls back to local date and keyword extraction when the backend route or OpenAI request fails.
- Installs on Windows with normal Node.js. No SQLite, native modules, node-gyp, or Visual Studio Build Tools required.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your OpenAI API key to `.env`:

   ```bash
   OPENAI_API_KEY=your_api_key_here
   ```

   You can also set `OPENAI_MODEL`; the default is `gpt-5.4-mini`.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://127.0.0.1:5173`.

For local AI parsing through the serverless route, run the project with Vercel's local dev server:

```bash
npx vercel dev
```

Running plain `npm run dev` starts the Vite frontend; if `/api/parse-syllabus` is not available locally, the app will use local fallback parsing.

## Vercel

When deploying to Vercel, add this Environment Variable in the Vercel project settings:

```bash
OPENAI_API_KEY=your_api_key_here
```

Optionally add `OPENAI_MODEL` to change the model. Do not use `VITE_OPENAI_API_KEY`. API keys with the `VITE_` prefix are exposed to browser code.

## Notes

Version 1 calls OpenAI from `api/parse-syllabus.js`, a Vercel serverless route. The browser calls `/api/parse-syllabus`, so the OpenAI API key stays on the server.

The parser organizes deadlines and readings only; it does not write student assignments. Every extracted or generated item includes the original syllabus source text so the student can verify it before exporting.
