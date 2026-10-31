const KEY = "pi-raten.highscores.v1";
// Stable chronological order for equal scores: the earlier score keeps its place.
export function sortScores(scores) {
  return [...scores].sort(
    (a, b) =>
      b.score - a.score ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );
}
export function loadScores() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  let entries;
  try {
    entries = JSON.parse(raw);
  } catch {
    throw new Error(
      "Die gespeicherte Bestenliste kann nicht gelesen werden. Deine Daten wurden nicht verändert.",
    );
  }
  if (!Array.isArray(entries))
    throw new Error("Die gespeicherte Bestenliste hat ein ungültiges Format.");
  return sortScores(
    entries.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        Number.isInteger(e.score) &&
        e.score >= 0 &&
        Number.isFinite(e.createdAt) &&
        typeof e.photo === "string" &&
        /^data:image\/jpeg;base64,/.test(e.photo),
    ),
  );
}
export function addScore(score, photo) {
  const entry = {
    id: crypto.randomUUID(),
    score,
    photo,
    createdAt: Date.now(),
  };
  const scores = sortScores([...loadScores(), entry]);
  try {
    localStorage.setItem(KEY, JSON.stringify(scores));
  } catch {
    throw new Error(
      "Der Gerätespeicher ist voll oder nicht verfügbar. Bitte schaffe Platz, ohne die Websitedaten zu löschen, und tippe auf „Nochmal speichern“. Dein Foto bleibt solange hier.",
    );
  }
  return {
    entry,
    scores,
    rank: scores.findIndex((e) => e.id === entry.id) + 1,
  };
}

// Remove only leaderboard data, leaving audio settings and offline assets intact.
export function resetScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    throw new Error(
      "Die Highscores konnten nicht gelöscht werden. Bitte versuche es erneut.",
    );
  }
}
