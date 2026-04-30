# Syllabus Planner

A browser-only React app that turns pasted syllabus text into an editable course calendar and task list.

## Features

- Paste syllabus text.
- Extract dated assignments, readings, quizzes, exams, projects, discussion posts, replies, and weekly reading items with OpenAI when `VITE_OPENAI_API_KEY` is set.
- Preserve the source syllabus excerpt for every item.
- Generate study reminders for exams and milestone reminders for projects.
- Calculate dates for Week 1, Week 2, Week 3, and similar syllabus sections from a course start date.
- Use meeting days such as Monday and Wednesday to schedule readings or prep before the first class meeting of the week.
- Edit every extracted field before exporting.
- Switch between an editable List View and a monthly Calendar View.
- Export CSV and `.ics` calendar files for Apple Calendar or Google Calendar import.
- Store tasks in browser `localStorage`.
- Falls back to local date and keyword extraction when no OpenAI API key is present.
- Installs on Windows with normal Node.js. No SQLite, native modules, node-gyp, or Visual Studio Build Tools required.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your OpenAI API key to `.env`:

   ```bash
   VITE_OPENAI_API_KEY=your_api_key_here
   ```

   You can also set `VITE_OPENAI_MODEL`; the default is `gpt-5.4-mini`.

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://127.0.0.1:5173`.

## Notes

Version 1 calls OpenAI directly from the browser for simplicity. That means `VITE_OPENAI_API_KEY` is visible to anyone using the built frontend, so this setup is best for local use or prototypes. A production version should proxy OpenAI calls through a small backend.

The parser organizes deadlines and readings only; it does not write student assignments. Every extracted or generated item includes the original syllabus source text so the student can verify it before exporting.
