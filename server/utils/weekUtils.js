function padNumber(value) {
  return String(value).padStart(2, "0");
}

function getIsoWeek(date = new Date()) {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);

  return {
    year: utcDate.getUTCFullYear(),
    week: weekNumber,
  };
}

function getIsoWeeksInYear(year) {
  const dec31 = new Date(Date.UTC(year, 11, 31));
  return getIsoWeek(dec31).week;
}

function getCurrentUtcWeekId() {
  const { year, week } = getIsoWeek(new Date());
  return `${year}-${padNumber(week)}`;
}

function parseWeekId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > getIsoWeeksInYear(year)) return null;

  return `${year}-${padNumber(week)}`;
}

module.exports = {
  getCurrentUtcWeekId,
  parseWeekId,
  getIsoWeek,
  getIsoWeeksInYear,
};
