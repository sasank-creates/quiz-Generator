"use client";

import Fab from "@mui/material/Fab";
import AddIcon from "@mui/icons-material/Add";
import { useDropzone } from "react-dropzone";
import styles from "./styles.module.css";
import { useDispatch, useSelector } from "react-redux";
import { uploadFile } from "@/config/redux/action/index";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { reset } from "@/config/redux/reducer/index";
function Uploads() {
  const dispatch = useDispatch();
  const [progress, setProgress] = useState(0);
  const Router = useRouter();
  const { loading, error, latestUploadedId } = useSelector(
    (state) => state.file
  );

  const {
    getRootProps,
    getInputProps,
    open,
    isDragActive,
  } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    noClick: true,
    noKeyboard: true,
    onDrop: (files) => {
      const file = files[0];
      if (!file) return;
      dispatch(uploadFile(file));
    },
  });
  useEffect(() => {
    let interval;

    if (loading) {
      setProgress(0);

      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 85) {
            return prev + Math.random() * 5; // slow fake progress
          }
          return prev;
        });
      }, 300);
    }

    if (!loading && latestUploadedId) {
      setProgress(100); // finish ONLY when data arrives
      const id = latestUploadedId;
      console.log(latestUploadedId);

      setTimeout(() => {
        dispatch(reset());
        Router.push(`/quiz/${id}`);
      }, 0);
    }

    return () => clearInterval(interval);
  }, [loading, latestUploadedId]);

  return (
    <div className={styles.main}>
      <div className={styles.heading}>
        <h1>Quizzify</h1>
        <div>A platform to create quizzes from PDF or Image assignments</div>
      </div>

      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.active : ""
          }`}

      >

        <input {...getInputProps()} />

        <div className={styles.content}>
          <Fab
            onClick={open}
            sx={{
              backgroundColor: isDragActive ? "#5fb0bf" : "#84c7d4",
              color: "#1f2d30",
              transform: isDragActive ? "scale(1.1)" : "scale(1)",
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "#5fb0bf",
              },
            }}
            aria-label="add"
            disabled={loading}
          >
            <AddIcon />
          </Fab>

          <div className={styles.text}>
            {loading
              ? <div> Uploading... Please wait a moment. </div>
              : isDragActive
                ? <div>Release to upload files</div>
                : <div>Drag and drop a PDF or Image here</div>}
          </div>
          {loading && (
            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {error && (
            <p style={{ color: "red" }}>
              Upload failed: {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Uploads;
