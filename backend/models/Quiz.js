const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  originalFileName: String,

  questions: [
    {
      question: String,
      options: [String],
      optionscount: Number,
      answer: String,
      explanation: String,
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("QuizResult", quizSchema);
