const path = require("path");

const MIN_QUESTIONS_PER_GENRE = 10;

const VALID_GENRES = [
  "mixed",
  "science",
  "geography",
  "politics",
  "history",
  "sports",
  "entertainment",
];

const GENRE_LABELS = {
  mixed: "Mixed",
  science: "Science",
  geography: "Geography",
  politics: "Politics",
  history: "History",
  sports: "Sports",
  entertainment: "Entertainment",
};

// Load all genre banks at module load time so misconfiguration fails at startup
const banks = {};

for (const genre of VALID_GENRES) {
  const filePath = path.join(__dirname, "../data/questions", `${genre}.json`);
  let questions;
  try {
    questions = require(filePath);
  } catch (err) {
    throw new Error(`Question bank missing for genre "${genre}": ${filePath}`);
  }
  if (!Array.isArray(questions) || questions.length < MIN_QUESTIONS_PER_GENRE) {
    throw new Error(
      `Question bank for genre "${genre}" has ${Array.isArray(questions) ? questions.length : 0} questions — minimum is ${MIN_QUESTIONS_PER_GENRE}.`
    );
  }
  banks[genre] = questions;
}

function getQuestionsByGenre(genre) {
  return banks[genre] || [];
}

function isValidGenre(genre) {
  return VALID_GENRES.includes(genre);
}

module.exports = { getQuestionsByGenre, isValidGenre, VALID_GENRES, GENRE_LABELS, MIN_QUESTIONS_PER_GENRE };
