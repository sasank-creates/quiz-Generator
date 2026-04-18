const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");

async function normalizeText() {
  try {

    // Safe paths
    const inputPath = path.join(__dirname, "../test_text.png");
    const cleanPath = path.join(__dirname, "../clean_test.png");

    // -------- STEP 1: Preprocess Image --------
    await sharp(inputPath)
      .resize(2200)        // enlarge text
      .grayscale()         // remove colors
      .normalize()         // improve contrast
      .median(3)           // remove noise
      .threshold(140)      // strong B/W
      .sharpen()           // sharpen text
      .toFile(cleanPath);

    console.log("Image preprocessed.");

    // -------- STEP 2: OCR --------
    const result = await Tesseract.recognize(
      cleanPath,
      "eng",
      {
        tessedit_pageseg_mode: 6,
        preserve_interword_spaces: 1,
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:'-()"
      }
    );

    console.log("\nRaw OCR Output:\n", result.data.text);

    // -------- STEP 3: Normalize Text --------
    let text = result.data.text;

    text = text
      .replace(/[^\w\s.,:'()-]/g, "")     // remove junk
      .replace(/\s{2,}/g, " ")            // extra spaces
      .replace(/\n{3,}/g, "\n\n")         // extra lines
      .replace(/\b0\b/g, "O")             // common OCR fix
      .replace(/\b1\b/g, "I");            // common OCR fix

    console.log("\nNormalized Text:\n", text);

    return text;

  } catch (err) {
    console.error("OCR Error:", err);
  }
}

normalizeText();
