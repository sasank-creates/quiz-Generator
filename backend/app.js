const express = require("express");
const multer = require("multer");
const cors = require("cors");
const cron = require("node-cron");
const mongoose = require("mongoose");
const Quiz = require("./models/Quiz");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ── AI Client ──────────────────────────────────────────────────────────
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ── CORS ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  process.env.FRONTEND_URL, // e.g. https://your-app.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.some(
          (allowed) => origin === allowed || origin.endsWith(".vercel.app")
        )
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── MongoDB ────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ── Multer Config ──────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error("Only PDF and image files (JPEG/PNG/WEBP) are allowed.")
      );
    }
    cb(null, true);
  },
});

// ── Cron: clean up old quizzes ─────────────────────────────────────────
cron.schedule("0 * * * *", async () => {
  try {
    const hundredHoursAgo = new Date(Date.now() - 100 * 60 * 60 * 1000);
    const result = await Quiz.deleteMany({
      createdAt: { $lt: hundredHoursAgo },
    });
    console.log(`Cron: Deleted ${result.deletedCount} old quizzes`);
  } catch (err) {
    console.error("Cron job error:", err);
  }
});

// ── Health Check ───────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Quizzify API is running" });
});

// ── GET /quiz/:id ──────────────────────────────────────────────────────
app.get("/quiz/:id", async (req, res) => {
  try {
    console.log("Fetching quiz with ID:", req.params.id);
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json(quiz);
  } catch (err) {
    console.error("Quiz fetch error:", err.message);
    res.status(500).json({ error: "Server error fetching quiz" });
  }
});

// ── POST /upload ───────────────────────────────────────────────────────
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log(
      "File received:",
      req.file ? req.file.originalname : "None",
      "| Size:",
      req.file ? `${(req.file.size / 1024).toFixed(1)}KB` : "N/A",
      "| Type:",
      req.file ? req.file.mimetype : "N/A"
    );

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const base64Data = req.file.buffer.toString("base64");
    const questions = await processFileWithGemini(base64Data, req.file.mimetype);

    if (!questions || questions.length === 0) {
      return res.status(422).json({
        error: "No questions could be extracted from this file. Please upload a file containing multiple choice questions.",
      });
    }

    const quiz = await Quiz.create({ questions });
    console.log(`Quiz created with ${questions.length} questions, ID: ${quiz._id}`);

    res.status(201).json({
      message: "Quiz saved successfully",
      id: quiz._id,
      data: quiz,
    });
  } catch (err) {
    console.error("Upload error:", err.message || err);

    // Return specific error messages based on the type of failure
    if (err.status === 429) {
      return res.status(429).json({
        error: "AI service is rate-limited. Please wait a moment and try again.",
      });
    }
    if (err.status === 503) {
      return res.status(503).json({
        error: "AI service is temporarily unavailable. Please try again shortly.",
      });
    }
    if (err.message?.includes("Empty response")) {
      return res.status(422).json({
        error: "Could not extract questions from this file. Try a clearer document.",
      });
    }
    if (err.message?.includes("JSON")) {
      return res.status(422).json({
        error: "Failed to parse extracted questions. The document format may not be supported.",
      });
    }

    res.status(500).json({
      error: "Failed to process the uploaded file. Please try again.",
    });
  }
});

// ── Multer error handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Maximum size is 25MB." });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err.message === "Only PDF and image files (JPEG/PNG/WEBP) are allowed.") {
    return res.status(415).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "An unexpected error occurred." });
});

// ── Gemini Processing ──────────────────────────────────────────────────
async function processFileWithGemini(
  base64Data,
  mimeType,
  retries = 3,
  baseDelay = 2000
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType,
                },
              },
              {
                text: `Extract all multiple choice questions from this document.
Respond strictly with a JSON array of objects, with NO markdown formatting, using this exact schema for each object:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "optionscount": 4,
  "answer": "The correct option text",
  "explanation": "Brief 2-3 sentence explanation"
}

Rules:
- Include all available options exactly as present.
- optionscount must exactly equal options.length.
- If there is no correct answer indicated, find out the correct answer yourself.
- If explanation is missing, research and add strictly within two or three sentences.
- Output ONLY valid JSON array.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const text =
        response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI");

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed))
        throw new Error("AI did not return a JSON array");
      return parsed;
    } catch (err) {
      console.error(
        `Gemini attempt ${attempt}/${retries} failed:`,
        err.message || err.status
      );
      if ((err.status === 503 || err.status === 429) && attempt < retries) {
        const delay = baseDelay * attempt;
        console.warn(`Retrying in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

// ── Start Server ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
