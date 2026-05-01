const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

function getResponseText(payload) {
  const primaryText = payload.output?.[0]?.content?.[0]?.text;
  if (typeof primaryText === "string" && primaryText.trim()) return primaryText;

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const contentItems = (payload.output || []).flatMap((item) => item.content || []);
  const directText = contentItems.find((content) => typeof content.text === "string" && content.text.trim())?.text;
  if (directText) return directText;

  throw new Error("OpenAI responded, but no text output was found.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST requests are allowed." });
  }

  const { syllabusText = "", courseName = "", courseStartDate = "", meetingDays = "" } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
  }

  if (!syllabusText.trim()) {
    return res.status(400).json({ error: "syllabusText is required." });
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        text: {
          format: {
            type: "json_schema",
            name: "syllabus_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["courseName", "tasks"],
              properties: {
                courseName: { type: "string" },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "type", "dueDate", "suggestedStartDate", "priority", "notes", "sourceText"],
                    properties: {
                      title: { type: "string" },
                      type: { type: "string", enum: ["assignment", "reading", "quiz", "exam", "project", "presentation", "discussion_post", "reply", "other"] },
                      dueDate: { type: "string" },
                      suggestedStartDate: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      notes: { type: "string" },
                      sourceText: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        input: [
          {
            role: "system",
            content:
              "You extract course planning tasks from syllabi. Do not write, draft, solve, or complete student assignments. Only organize deadlines, readings, study dates, and project milestones. Return valid JSON only."
          },
          {
            role: "user",
            content: `Extract syllabus planning items from this text.

Return exactly this JSON shape:
{
  "courseName": "string",
  "tasks": [
    {
      "title": "string",
      "type": "assignment|reading|quiz|exam|project|presentation|discussion_post|reply|other",
      "dueDate": "YYYY-MM-DD or empty string",
      "suggestedStartDate": "YYYY-MM-DD or empty string",
      "priority": "low|medium|high",
      "notes": "brief note for the student",
      "sourceText": "short original syllabus excerpt that caused this task"
    }
  ]
}

Rules:
- Include assignments, readings, quizzes, exams/tests, projects, discussion post due dates, reply due dates, weekly chapters/readings, and other dated coursework.
- Every task must include sourceText from the syllabus so the student can verify accuracy.
- Reading start dates should be 2 to 4 days before class or the related due date.
- If items are listed only as Week 1, Week 2, Week 3, etc., keep the week label in title or sourceText. The app will calculate dates from course start date: ${courseStartDate || "(none provided)"}.
- Class meeting days: ${meetingDays || "(none provided)"}. For readings or prep, prefer dates before the first meeting day of the week when possible.
- Do not invent coursework beyond planning reminders.
- Use the provided course name if it is present: ${courseName || "(none provided)"}

Syllabus text:
${syllabusText.slice(0, 50000)}`
          }
        ]
      })
    });

    const payload = await openAIResponse.json();
    console.log("OpenAI parse response status:", openAIResponse.status);

    if (!openAIResponse.ok) {
      return res.status(openAIResponse.status).json({
        error: payload.error?.message || "OpenAI API request failed."
      });
    }

    const parsed = JSON.parse(getResponseText(payload));
    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Syllabus parsing failed:", error.message);
    return res.status(500).json({
      error: error.message || "Syllabus parsing failed."
    });
  }
}
