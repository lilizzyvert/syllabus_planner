import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORAGE_KEY = "syllabus-planner-tasks-v1";
const taskTypes = ["assignment", "reading", "quiz", "exam", "project", "presentation", "discussion_post", "reply", "study", "project_milestone", "other"];
const priorities = ["low", "medium", "high"];
const calendarTaskTypes = ["reading", "assignment", "discussion_post", "reply", "quiz", "exam", "project", "presentation", "other"];
const taskTypeColors = {
  reading: "#2f675f",
  assignment: "#7d5fb2",
  discussion_post: "#b06a2c",
  reply: "#6f7f2d",
  quiz: "#2f5f9f",
  exam: "#b64031",
  project: "#8b4d35",
  presentation: "#9a4e82",
  study: "#4b7280",
  project_milestone: "#8b4d35",
  other: "#66706b"
};
const meetingDayOptions = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const meetingDayIndexes = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
};

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatType(type) {
  return type.replaceAll("_", " ");
}

function addDays(dateString, days) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function changeMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildCalendarDays(monthDate) {
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstGridDay = new Date(firstOfMonth);
  firstGridDay.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_item, index) => {
    const date = new Date(firstGridDay);
    date.setDate(firstGridDay.getDate() + index);
    return {
      date,
      key: dateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth()
    };
  });
}

function parseMeetingDays(value) {
  return String(value || "")
    .split(/[,/&\s]+/)
    .map((day) => meetingDayIndexes[day.toLowerCase()])
    .filter((day) => Number.isInteger(day));
}

function weekDate(courseStartDate, weekNumber) {
  if (!courseStartDate || !weekNumber) return "";
  return addDays(courseStartDate, (Number(weekNumber) - 1) * 7);
}

function firstMeetingDateForWeek(courseStartDate, weekNumber, meetingDays) {
  const start = weekDate(courseStartDate, weekNumber);
  const dayIndexes = parseMeetingDays(meetingDays);
  if (!start || dayIndexes.length === 0) return start;

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(start, offset);
    const day = new Date(`${candidate}T12:00:00`).getDay();
    if (dayIndexes.includes(day)) return candidate;
  }

  return start;
}

function weekNumberFromText(value) {
  const match = String(value || "").match(/\bweek\s*(\d{1,2})\b/i);
  return match ? Number(match[1]) : null;
}

function hasWeeklyLabels(value) {
  return /\bweek\s*\d{1,2}\b/i.test(String(value || ""));
}

function dateInWeek(dateString) {
  if (!dateString) return false;
  const date = new Date(`${dateString}T12:00:00`);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date <= end;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => (a.dueDate || a.suggestedStartDate || "9999").localeCompare(b.dueDate || b.suggestedStartDate || "9999"));
}

function isCompleted(task) {
  return task.status === "completed";
}

function priorityFor(type, title = "") {
  const value = `${type} ${title}`.toLowerCase();
  if (value.includes("exam") || value.includes("test") || value.includes("final") || value.includes("project")) return "high";
  if (value.includes("quiz") || value.includes("assignment") || value.includes("discussion")) return "medium";
  return "low";
}

function parseDateFromLine(line) {
  const year = new Date().getFullYear();
  const numeric = line.match(/\b(?:due\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/i);
  if (numeric) {
    const parsedYear = numeric[3] ? (numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : year;
    return `${parsedYear}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}`;
  }

  const natural = line.match(/\b(?:due\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b/i);
  if (!natural) return "";
  const cleaned = natural[0].replace(/^due\s*/i, "").trim();
  const hasYear = /\b\d{4}\b/.test(cleaned);
  const parsed = new Date(hasYear ? cleaned : `${cleaned} ${year}`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function detectType(line) {
  if (/chapter|reading|read\b|prep/i.test(line)) return "reading";
  if (/quiz/i.test(line)) return "quiz";
  if (/exam|test|midterm|final/i.test(line)) return "exam";
  if (/presentation/i.test(line)) return "presentation";
  if (/project|proposal/i.test(line)) return "project";
  if (/discussion|post/i.test(line)) return "discussion_post";
  if (/reply|response/i.test(line)) return "reply";
  if (/paper|essay|assignment|homework|problem set|proposal|due/i.test(line)) return "assignment";
  return "other";
}

function cleanTitle(line) {
  return line
    .replace(/\b(?:due\s*)?\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/i, "")
    .replace(/\b(?:due\s*)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b/i, "")
    .replace(/[-:|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTask(line, courseName, courseStartDate = "", meetingDays = "") {
  const type = detectType(line);
  const dueDate = parseDateFromLine(line);
  const title = cleanTitle(line) || line;
  const weekNumber = weekNumberFromText(line);
  const calculatedDate = !dueDate && weekNumber ? weekDate(courseStartDate, weekNumber) : "";
  const firstMeetingDate = !dueDate && weekNumber ? firstMeetingDateForWeek(courseStartDate, weekNumber, meetingDays) : "";
  return {
    id: makeId(),
    courseName: courseName || "Imported course",
    title,
    type,
    dueDate: dueDate || calculatedDate,
    suggestedStartDate: dueDate ? addDays(dueDate, type === "reading" ? -3 : -2) : suggestedStartForWeeklyTask(type, calculatedDate, firstMeetingDate),
    priority: priorityFor(type, title),
    notes: weekNumber && calculatedDate
      ? `Week ${weekNumber} date calculated from the course start date. Please verify before exporting.`
      : "Extracted locally from pasted syllabus text. Please verify before exporting.",
    sourceText: line,
    status: "planned",
    createdAt: new Date().toISOString()
  };
}

function suggestedStartForWeeklyTask(type, calculatedDate, firstMeetingDate = calculatedDate) {
  if (!calculatedDate) return "";
  if (type === "reading") return addDays(firstMeetingDate || calculatedDate, -1);
  return addDays(calculatedDate, -2);
}

function applyWeeklyDates(tasks, courseStartDate, meetingDays) {
  if (!courseStartDate) return tasks;

  return tasks.map((task) => {
    if (task.dueDate) return task;

    const weekNumber = weekNumberFromText(`${task.title} ${task.notes} ${task.sourceText}`);
    if (!weekNumber) return task;

    const calculatedDate = weekDate(courseStartDate, weekNumber);
    const firstMeetingDate = firstMeetingDateForWeek(courseStartDate, weekNumber, meetingDays);
    if (!calculatedDate) return task;

    return {
      ...task,
      dueDate: calculatedDate,
      suggestedStartDate: task.suggestedStartDate || suggestedStartForWeeklyTask(task.type, calculatedDate, firstMeetingDate),
      notes: `${task.notes ? `${task.notes} ` : ""}Week ${weekNumber} date calculated from the course start date.`
    };
  });
}

function normalizeOpenAITask(task, courseName) {
  const incomingType = task.type === "discussion" ? "discussion_post" : task.type;
  const dueDate = task.dueDate || task.due_date || "";
  const title = task.title || task.taskTitle || task.task_title || "Untitled syllabus item";
  const sourceText = task.sourceText || task.source_text || task.source || "Source excerpt unavailable. Please verify against the syllabus.";
  const inferredWeeklyType = detectType(`${title} ${sourceText}`);
  const type = taskTypes.includes(incomingType) && incomingType !== "other" ? incomingType : inferredWeeklyType;
  return {
    id: makeId(),
    courseName: task.courseName || task.course_name || courseName || "Imported course",
    title,
    type,
    dueDate,
    suggestedStartDate: task.suggestedStartDate || task.suggested_start_date || (dueDate ? addDays(dueDate, type === "reading" ? -3 : -2) : ""),
    priority: task.priority || priorityFor(type, title),
    notes: task.notes || "",
    sourceText,
    status: "planned",
    createdAt: new Date().toISOString()
  };
}

function generateStudyPlan(tasks) {
  const generated = [];
  for (const task of tasks) {
    if (!task.dueDate) continue;

    if (task.type === "exam") {
      for (const daysBefore of [7, 3, 1]) {
        generated.push({
          ...task,
          id: makeId(),
          title: `Study for ${task.title} (${daysBefore} day${daysBefore === 1 ? "" : "s"} before)`,
          type: "study",
          dueDate: addDays(task.dueDate, -daysBefore),
          suggestedStartDate: addDays(task.dueDate, -daysBefore),
          priority: daysBefore === 1 ? "high" : "medium",
          notes: `Auto-generated study session for ${task.title}.`,
          sourceText: task.sourceText
        });
      }
    }

    if (task.type === "project") {
      const milestones = [
        ["Choose topic / confirm requirements", -21],
        ["Outline and gather sources", -14],
        ["Complete first draft or build", -7],
        ["Revise and submit-ready review", -2]
      ];

      for (const [label, offset] of milestones) {
        generated.push({
          ...task,
          id: makeId(),
          title: `${task.title}: ${label}`,
          type: "project_milestone",
          dueDate: addDays(task.dueDate, offset),
          suggestedStartDate: addDays(task.dueDate, offset),
          priority: offset >= -7 ? "high" : "medium",
          notes: `Auto-generated project milestone for ${task.title}.`,
          sourceText: task.sourceText
        });
      }
    }
  }
  return generated;
}

function extractTasks(text, courseName, courseStartDate = "", meetingDays = "") {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = lines.filter((line) => {
    const hasDate = parseDateFromLine(line);
    const hasWeek = weekNumberFromText(line);
    const hasTaskKeyword = /(assignment|homework|reading|chapter|quiz|exam|test|project|discussion|reply|paper|essay|due|midterm|final|presentation|proposal|prep)/i.test(line);
    return (hasDate || hasWeek) && hasTaskKeyword;
  });

  const extracted = candidates.map((line) => normalizeTask(line, courseName, courseStartDate, meetingDays));
  const dated = applyWeeklyDates(extracted, courseStartDate, meetingDays);
  return sortTasks([...dated, ...generateStudyPlan(dated)]);
}

async function extractTasksWithBackend(text, courseName, courseStartDate = "", meetingDays = "") {
  let response = null;
  try {
    response = await fetch("/api/parse-syllabus", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        syllabusText: text,
        courseName,
        courseStartDate,
        meetingDays
      })
    });
  } catch (error) {
    error.isApiFailure = true;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  console.log("Syllabus parse backend response:", { status: response.status, ok: response.ok });

  if (!response.ok) {
    const error = new Error(payload.error || "Syllabus parsing backend request failed.");
    error.isApiFailure = true;
    throw error;
  }

  const parsedCourseName = payload.courseName || courseName || "Imported course";
  const extracted = (payload.tasks || []).map((task) => normalizeOpenAITask(task, parsedCourseName));
  const dated = applyWeeklyDates(extracted, courseStartDate, meetingDays);
  return sortTasks([...dated, ...generateStudyPlan(dated)]);
}

function downloadFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(tasks) {
  const headers = ["courseName", "title", "type", "dueDate", "suggestedStartDate", "priority", "status", "notes", "sourceText"];
  const escape = (value) => `"${String(value || "").replaceAll('"', '""')}"`;
  const csv = [headers.join(","), ...sortTasks(tasks).map((task) => headers.map((header) => escape(task[header])).join(","))].join("\n");
  downloadFile("syllabus-planner.csv", "text/csv;charset=utf-8", csv);
}

function icsDate(dateString) {
  return dateString.replaceAll("-", "");
}

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function exportIcs(tasks) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Syllabus Planner//EN", "CALSCALE:GREGORIAN"];
  for (const task of sortTasks(tasks)) {
    const date = task.dueDate || task.suggestedStartDate;
    if (!date) continue;
    const endDate = addDays(date, 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@syllabus-planner`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;VALUE=DATE:${icsDate(date)}`,
      `DTEND;VALUE=DATE:${icsDate(endDate)}`,
      `SUMMARY:${escapeIcs(`${task.courseName}: ${task.title}`)}`,
      `DESCRIPTION:${escapeIcs(`${formatType(task.type)} | Priority: ${task.priority} | Status: ${task.status || "planned"}\n\n${task.notes}\n\nSource: ${task.sourceText}`)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  downloadFile("syllabus-planner.ics", "text/calendar;charset=utf-8", lines.join("\r\n"));
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState("");
  const [courseName, setCourseName] = useState("");
  const [courseStartDate, setCourseStartDate] = useState("");
  const [meetingDays, setMeetingDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [parserStatus, setParserStatus] = useState("");
  const [weeklyWarning, setWeeklyWarning] = useState("");
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarTask, setSelectedCalendarTask] = useState(null);

  const thisWeek = useMemo(() => sortTasks(tasks).filter((task) => dateInWeek(task.dueDate || task.suggestedStartDate)), [tasks]);
  const completedCount = useMemo(() => tasks.filter(isCompleted).length, [tasks]);
  const visibleTasks = useMemo(() => {
    const typeFiltered = filter === "all" ? tasks : tasks.filter((task) => task.type === filter);
    const statusFiltered = typeFiltered.filter((task) => {
      if (statusFilter === "active") return !isCompleted(task);
      if (statusFilter === "completed") return isCompleted(task);
      return true;
    });
    return sortTasks(statusFiltered);
  }, [tasks, filter, statusFilter]);
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const liveWeeklyWarning = hasWeeklyLabels(text) && !courseStartDate
    ? "This syllabus uses weekly labels. Add a course start date so the app can calculate real dates."
    : "";
  const tasksByDate = useMemo(() => {
    return sortTasks(tasks).reduce((groups, task) => {
      if (!task.dueDate) return groups;
      groups[task.dueDate] = [...(groups[task.dueDate] || []), task];
      return groups;
    }, {});
  }, [tasks]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      setTasks(JSON.parse(saved).map((task) => ({ status: "planned", ...task })));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  async function parseSyllabus(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("Extracting dates and planning study tasks...");
    setParserStatus("");
    setWeeklyWarning("");

    if (!text.trim()) {
      setMessage("Paste syllabus text first.");
      setLoading(false);
      return;
    }

    const shouldWarnAboutWeeklyLabels = hasWeeklyLabels(text) && !courseStartDate;
    if (shouldWarnAboutWeeklyLabels) {
      setWeeklyWarning("This syllabus uses weekly labels. Add a course start date so the app can calculate real dates.");
    }

    try {
      let extracted = [];
      let nextParserStatus = "";

      try {
        extracted = await extractTasksWithBackend(text, courseName, courseStartDate, meetingDays);
        nextParserStatus = "AI extraction used successfully.";
      } catch (error) {
        if (!error.isApiFailure) throw error;
        extracted = extractTasks(text, courseName, courseStartDate, meetingDays);
        nextParserStatus = error.message.includes("OPENAI_API_KEY")
          ? "Local parsing used because no API key was found."
          : "AI extraction failed, so local fallback parsing was used.";
      }

      setTasks((current) => sortTasks([...extracted, ...current]));
      setText("");
      setParserStatus(nextParserStatus);
      setMessage(`Added ${extracted.length} editable planning items. Review source text before exporting.`);
    } catch (error) {
      setMessage(`OpenAI returned a response, but the app could not read the JSON: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function updateTask(id, patch) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
    if (selectedCalendarTask?.id === id) {
      setSelectedCalendarTask((task) => ({ ...task, ...patch }));
    }
  }

  function removeTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
    if (selectedCalendarTask?.id === id) setSelectedCalendarTask(null);
  }

  function clearAllTasks() {
    if (!window.confirm("Are you sure you want to remove all tasks?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setTasks([]);
    setSelectedCalendarTask(null);
    setMessage("All tasks removed.");
    setParserStatus("");
  }

  return (
    <main>
      <header className="appHeader">
        <div>
          <p className="eyebrow">Course deadline organizer</p>
          <h1>Syllabus Planner</h1>
        </div>
        <div className="exports">
          <button type="button" onClick={() => exportCsv(tasks)}>CSV</button>
          <button type="button" onClick={() => exportIcs(tasks)}>Apple Calendar</button>
          <button type="button" onClick={() => exportIcs(tasks)}>Google Calendar</button>
          <button type="button" className="clearButton" onClick={clearAllTasks}>Clear All</button>
        </div>
      </header>

      <p className="exportReminder">Review all dates before exporting. Syllabus formats can vary.</p>

      <section className="dashboard">
        <div>
          <span className="metric">{tasks.length}</span>
          <span>Total items</span>
        </div>
        <div>
          <span className="metric">{thisWeek.length}</span>
          <span>Due this week</span>
        </div>
        <div>
          <span className="metric">{tasks.filter((task) => task.priority === "high").length}</span>
          <span>High priority</span>
        </div>
        <div>
          <span className="metric">{completedCount}</span>
          <span>Completed</span>
        </div>
      </section>

      <section className="workspace">
        <form className="uploadPanel" onSubmit={parseSyllabus}>
          <h2>Add syllabus text</h2>
          <section className="helpBox" aria-label="How to use this planner">
            <h2>How to use this planner</h2>
            <ol>
              <li>Enter the course name.</li>
              <li>Add the course start date if the syllabus uses Week 1, Week 2, etc.</li>
              <li>Paste the syllabus schedule or assignment section.</li>
              <li>Click Extract dates.</li>
              <li>Review and edit the dates.</li>
              <li>Export to CSV, Apple Calendar, or Google Calendar.</li>
            </ol>
          </section>
          <label>
            Course name
            <input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="BIO 101, History Seminar..." />
          </label>
          <div className="formRow">
            <label>
              Course start date
              <input type="date" value={courseStartDate} onChange={(event) => setCourseStartDate(event.target.value)} />
            </label>
            <label>
              Meeting days
              <input value={meetingDays} onChange={(event) => setMeetingDays(event.target.value)} placeholder="Monday, Wednesday" />
            </label>
          </div>
          <div className="dayButtons" aria-label="Common meeting days">
            {meetingDayOptions.map((day) => (
              <button
                type="button"
                className={parseMeetingDays(meetingDays).includes(meetingDayIndexes[day.toLowerCase()]) ? "selectedDay" : ""}
                key={day}
                onClick={() => {
                  const current = meetingDays.split(",").map((item) => item.trim()).filter(Boolean);
                  const dayIndex = meetingDayIndexes[day.toLowerCase()];
                  const hasDay = current.some((item) => meetingDayIndexes[item.toLowerCase()] === dayIndex);
                  setMeetingDays(hasDay ? current.filter((item) => meetingDayIndexes[item.toLowerCase()] !== dayIndex).join(", ") : [...current, day].join(", "));
                }}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          <label>
            Pasted syllabus text
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Paste schedule or assignment sections here, for example:\n\nWeek 1: Introduction, discussion forum\nWeek 2: Chapter 1 reading, Paper #1\nWeek 10: Proposal due\nFinal Exam Week: Final assessment`}
            />
          </label>
          <button disabled={loading}>{loading ? "Extracting..." : "Extract dates"}</button>
          {(weeklyWarning || liveWeeklyWarning) && <p className="warningMessage">{weeklyWarning || liveWeeklyWarning}</p>}
          {parserStatus && <p className="statusMessage">{parserStatus}</p>}
          {message && <p className="message">{message}</p>}
        </form>

        <aside className="weekPanel">
          <h2>Due this week</h2>
          {thisWeek.length === 0 && <p className="empty">Nothing due in the next seven days.</p>}
          {thisWeek.map((task) => (
            <div className="weekItem" key={task.id}>
              <strong>{task.title}</strong>
              <span>{task.courseName} / {task.dueDate || task.suggestedStartDate}</span>
            </div>
          ))}
        </aside>
      </section>

      <section className="taskHeader">
        <div>
          <h2>Review extracted items</h2>
          <div className="viewTabs" aria-label="Task view">
            <button type="button" className={viewMode === "list" ? "activeTab" : ""} onClick={() => setViewMode("list")}>List View</button>
            <button type="button" className={viewMode === "calendar" ? "activeTab" : ""} onClick={() => setViewMode("calendar")}>Calendar View</button>
          </div>
        </div>
        {viewMode === "list" && (
          <div className="filters">
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All types</option>
              {taskTypes.map((type) => <option key={type} value={type}>{formatType(type)}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All tasks</option>
              <option value="active">Active tasks</option>
              <option value="completed">Completed tasks</option>
            </select>
          </div>
        )}
      </section>

      {viewMode === "list" && (
      <section className="taskList">
        {visibleTasks.length === 0 && <p className="empty">Paste a syllabus schedule to start building your plan.</p>}
        {visibleTasks.length > 0 && (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Done</th>
                  <th>Course</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Due</th>
                  <th>Start</th>
                  <th>Priority</th>
                  <th>Notes</th>
                  <th>Source text</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr className={`priority-${task.priority} ${isCompleted(task) ? "completedTask" : ""}`} key={task.id}>
                    <td>
                      <input
                        className="taskCheckbox"
                        type="checkbox"
                        checked={isCompleted(task)}
                        onChange={(event) => updateTask(task.id, { status: event.target.checked ? "completed" : "planned" })}
                        aria-label={`Mark ${task.title} as completed`}
                      />
                    </td>
                    <td><input value={task.courseName} onChange={(event) => updateTask(task.id, { courseName: event.target.value })} /></td>
                    <td><input className="titleInput" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} /></td>
                    <td>
                      <select value={task.type} onChange={(event) => updateTask(task.id, { type: event.target.value })}>
                        {taskTypes.map((type) => <option key={type} value={type}>{formatType(type)}</option>)}
                      </select>
                    </td>
                    <td><input type="date" value={task.dueDate} onChange={(event) => updateTask(task.id, { dueDate: event.target.value })} /></td>
                    <td><input type="date" value={task.suggestedStartDate} onChange={(event) => updateTask(task.id, { suggestedStartDate: event.target.value })} /></td>
                    <td>
                      <select value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value })}>
                        {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                      </select>
                    </td>
                    <td><textarea value={task.notes} onChange={(event) => updateTask(task.id, { notes: event.target.value })} /></td>
                    <td><textarea className="sourceTextarea" value={task.sourceText} onChange={(event) => updateTask(task.id, { sourceText: event.target.value })} /></td>
                    <td><button className="delete" onClick={() => removeTask(task.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {viewMode === "calendar" && (
        <section className="calendarView">
          <div className="calendarToolbar">
            <button type="button" onClick={() => setCalendarMonth((month) => changeMonth(month, -1))}>Previous</button>
            <h2>{monthLabel(calendarMonth)}</h2>
            <div>
              <button type="button" onClick={() => setCalendarMonth(new Date())}>Today</button>
              <button type="button" onClick={() => setCalendarMonth((month) => changeMonth(month, 1))}>Next</button>
            </div>
          </div>

          <div className="calendarLegend">
            {calendarTaskTypes.map((type) => (
              <span key={type}><i style={{ background: taskTypeColors[type] }} />{formatType(type)}</span>
            ))}
          </div>

          <div className="calendarGrid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div className="calendarWeekday" key={day}>{day}</div>
            ))}
            {calendarDays.map((day) => (
              <div className={`calendarDay ${day.isCurrentMonth ? "" : "outsideMonth"}`} key={day.key}>
                <span className="dayNumber">{day.dayNumber}</span>
                <div className="calendarTasks">
                  {(tasksByDate[day.key] || []).map((task) => (
                    <button
                      type="button"
                      className={`calendarTask ${isCompleted(task) ? "completedCalendarTask" : ""}`}
                      style={{ borderLeftColor: taskTypeColors[task.type] || taskTypeColors.other }}
                      key={task.id}
                      onClick={() => setSelectedCalendarTask(task)}
                    >
                      <span>{formatType(task.type)}</span>
                      {isCompleted(task) && <strong>Completed</strong>}
                      <em>{task.title}</em>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <aside className="calendarDetails">
            {!selectedCalendarTask && <p className="empty">Click a calendar task to see details.</p>}
            {selectedCalendarTask && (
              <>
                <div className="detailHeader">
                  <h2>{selectedCalendarTask.title}</h2>
                  <button type="button" className="delete" onClick={() => setSelectedCalendarTask(null)}>Close</button>
                </div>
                <dl>
                  <dt>Course</dt>
                  <dd>{selectedCalendarTask.courseName}</dd>
                  <dt>Type</dt>
                  <dd>{formatType(selectedCalendarTask.type)}</dd>
                  <dt>Due date</dt>
                  <dd>{selectedCalendarTask.dueDate || "Not set"}</dd>
                  <dt>Suggested start date</dt>
                  <dd>{selectedCalendarTask.suggestedStartDate || "Not set"}</dd>
                  <dt>Priority</dt>
                  <dd>{selectedCalendarTask.priority}</dd>
                  <dt>Status</dt>
                  <dd>{isCompleted(selectedCalendarTask) ? "completed" : "planned"}</dd>
                  <dt>Notes</dt>
                  <dd>{selectedCalendarTask.notes || "No notes"}</dd>
                  <dt>Source text</dt>
                  <dd>{selectedCalendarTask.sourceText || "No source text"}</dd>
                </dl>
              </>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
