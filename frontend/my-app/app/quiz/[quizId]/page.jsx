"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import styles from "./styles.module.css";

const Page = () => {
  const { quizId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  // Fetch quiz
  useEffect(() => {

    if (!quizId) return;

    const fetchQuiz = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const res = await axios.get(
          `${API_URL}/quiz/${quizId}`
        );
        if (res.data?.questions) {
          setQuestions(res.data.questions); // ✅ store in state
        }

        setLoading(false);

      } catch (err) {
        console.error("Error fetching quiz:", err);
        setLoading(false);
      }
    };

    fetchQuiz();

  }, [quizId]);


  // Select option
  const handleSelect = (qid, option) => {
    setAnswers((prev) => ({
      ...prev,
      [qid]: option,
    }));
  };

  const handleSubmit = () => {
    // if(Object.keys(answers).length != questions.length) {
    //   alert("Please select at least one answer before submitting.");
    //   return;
    // }
    let totalScore = 0;

    questions.forEach((q, index) => {
      if (answers[index] === q.answer) {
        totalScore++;
      }
    });

    setScore(totalScore);
    setSubmitted(true);
    console.log("User answers:", answers);
  };


  if (loading) {
    return <p>Loading quiz...</p>;
  }


  return (

    <div className={styles.main}>
      {
        submitted && (
          <div className={styles.score}>
            <h2>Your Score: {score} / {questions.length}</h2>
          </div>
        )
      }

      {questions.map((q, index) => (

        <div key={index} className={styles.Container}>

          <div className={styles.MCQContent}>

            <div className={styles.Header}>
              <h2>
                {q.question}
              </h2>

              <div className={styles.required}>*</div>
            </div>


            <div className={styles.Options}>

              {q.options.map((opt, i) => (

                <label
                  key={i}
                  className={`${styles.Option}
                    ${submitted && opt === q.answer
                      ? styles.correct
                      : ""
                    }
                    ${submitted &&
                      answers[index] === opt &&
                      opt !== q.answer
                      ? styles.wrong
                      : ""
                    }
                    ${!submitted && answers[index] === opt
                      ? styles.selected
                      : ""
                    }
                  `}
                >

                  {!submitted && (
                    <input
                      type="radio"
                      name={`q-${index}`}
                      checked={answers[index] === opt}
                      onChange={() =>
                        handleSelect(index, opt)
                      }
                    />
                  )}

                  <span>
                    {submitted && opt === q.answer && (
                      <span style={{ marginRight: "6px", color: "green", fontSize: "1.4rem" }}>
                        ✔
                      </span>
                    )}

                    {submitted && answers[index] === opt && opt !== q.answer && (
                      <span style={{ marginRight: "6px", color: "red", fontSize: "1.4rem" }}>
                        ✖
                      </span>
                    )}
                    {opt}

                  </span>


                </label>
              ))}

            </div>


            {submitted && (
              <div>
                <div><p style={{ color: "black", fontSize: "20px" }}>Correct Answer:  {q.answer}</p></div>

                <div className={styles.explanation}>
                  <h2>Explanation:</h2><br />
                  <p>{q.explanation}</p>
                </div>
              </div>
            )}

          </div>
        </div>
      ))}


      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitted}
      >
        Submit
      </button>

    </div>
  );
};

export default Page;
