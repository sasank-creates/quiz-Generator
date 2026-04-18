const express = require("express");
const multer = require("multer");
const cors = require("cors");
const mongoose = require("mongoose");
const Quiz = require("./models/Quiz");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF and image files (JPEG/PNG/WEBP) are allowed."));
    }
    cb(null, true);
  },
});

app.get("/quiz/:id", async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    res.json(quiz);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: "Server error fetching quiz" });
  }
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Free Tier Optimization: Cleanup old quizzes (>48h) on every upload
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await Quiz.deleteMany({ createdAt: { $lt: fortyEightHoursAgo } });
    } catch (cleanupErr) {
      console.error("Cleanup Error (non-blocking):", cleanupErr);
    }

    console.log(`Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    const base64Data = req.file.buffer.toString("base64");

    const questions = await processFileWithGemini(base64Data, req.file.mimetype);

    const quiz = await Quiz.create({
      originalFileName: req.file.originalname,
      questions
    });

    res.status(201).json({
      message: "Quiz saved successfully",
      id: quiz._id,
      data: quiz,
    });
  } catch (err) {
    console.error("Upload process error:", err);
    res.status(500).json({
      error: "Failed to process the uploaded file.",
      details: err.message
    });
  }
});

async function processFileWithGemini(base64Data, mimeType, retries = 2) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `Extract all multiple choice questions from this document.
Respond strictly with a JSON array of objects, using this exact schema for each object:
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
- If there is no correct answer indicated in the text, determine the correct answer based on the content.
- Provide a brief explanation strictly within 2-3 sentences.
- Output ONLY valid JSON array.`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ]);

      const response = await result.response;
      const text = response.text();

      // Clean up potential markdown if needed (though responseMimeType: "application/json" should handle it)
      const cleanedText = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanedText);

      if (!Array.isArray(parsed)) throw new Error("AI did not return a JSON array");
      return parsed;

    } catch (err) {
      console.warn(`Attempt ${attempt} failed:`, err.message);
      if (attempt === retries) throw err;
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

