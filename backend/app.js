const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const cron = require("node-cron");
const mongoose = require("mongoose");
const Quiz = require("./models/Quiz");
const app = express();
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");
dotenv.config();
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
// const models = await genAI.listModels();
// console.log(models);
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF and image files (JPEG/PNG/WEBP) are allowed."));
    }
    cb(null, true);
  },
});

cron.schedule("0 * * * *", async () => {
  try {
    const hundredHoursAgo = new Date(Date.now() - 100 * 60 * 60 * 1000);
    const result = await Quiz.deleteMany({ createdAt: { $lt: hundredHoursAgo } });
    console.log(`Cron: Deleted ${result.deletedCount} old quizzes`);
  } catch (err) {
    console.error("Cron job error:", err);
  }
});

app.get("/quiz/:id", async (req, res) => {
  try {
    console.log("Fetching quiz with ID:", req.params.id);
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("File received:", req.file ? req.file.originalname : "None");
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const base64Data = req.file.buffer.toString("base64");

    const questions = await processFileWithGemini(base64Data, req.file.mimetype);

    const quiz = await Quiz.create({ questions });

    console.log(`Quiz created with ${questions.length} questions`);
    res.status(201).json({
      message: "Quiz saved successfully",
      id: quiz._id,
      data: quiz,
    });
  } catch (err) {
    console.error("Upload error:", err.message || err);
    res.status(500).json({ error: "Failed to process the uploaded file." });
  }
});

async function processFileWithGemini(base64Data, mimeType, retries = 3, baseDelay = 2000) {
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
                  mimeType: mimeType
                }
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
- Output ONLY valid JSON array.`
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI");

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("AI did not return a JSON array");
      return parsed;

    } catch (err) {
      if ((err.status === 503 || err.status === 429) && attempt < retries) {
        const delay = baseDelay * attempt;
        console.warn(`Gemini API overloaded/rate-limited (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

app.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});
