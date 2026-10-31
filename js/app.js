import { Game } from "./game.js";
import { loadScores, addScore, resetScores } from "./storage.js";
import { ShowAudio } from "./audio.js";
import { Camera, cameraError } from "./camera.js";
import { Leaderboard } from "./leaderboard.js";
import { sleep, confetti, replayAnimation } from "./effects.js";

const $ = (id) => document.getElementById(id);
const audio = new ShowAudio();
const camera = new Camera($("camera"));
const leaderboard = new Leaderboard($("scores-list"), audio);
let game,
  screen = "home",
  accepting = false,
  starting = false,
  run = 0,
  photo = null,
  saving = false;
let wakeLock;
let photoAttempt = 0,
  takingPhoto = false;

function show(name) {
  screen = name;
  for (const section of document.querySelectorAll(".screen"))
    section.hidden = section.id !== `${name}-screen`;
  document.body.dataset.screen = name;
  $("brand").disabled = name === "result";
}
function soundButton() {
  $("sound-toggle").classList.toggle("is-muted", audio.muted);
  $("sound-toggle").setAttribute("aria-pressed", String(audio.muted));
  $("sound-toggle").setAttribute(
    "aria-label",
    audio.muted ? "Ton einschalten" : "Ton ausschalten",
  );
}
async function keepAwake() {
  try {
    if ("wakeLock" in navigator && !document.hidden)
      wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    /* Optional on older iPads. */
  }
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
function home() {
  run++;
  photoAttempt++;
  takingPhoto = false;
  accepting = false;
  starting = false;
  leaderboard.cancel();
  camera.stop();
  audio.stopMusic();
  releaseWakeLock();
  $("play").classList.remove("loading");
  $("play-again").classList.remove("loading");
  delete document.body.dataset.lives;
  show("home");
}
function requestHome() {
  if (starting) return;
  if (screen === "game") $("leave-dialog").showModal();
  else if (screen !== "result") home();
}
function scores() {
  leaderboard.cancel();
  audio.stopMusic();
  releaseWakeLock();
  show("scores");
  try {
    leaderboard.render(loadScores());
  } catch (error) {
    $("score-summary").textContent = error.message;
  }
}
async function startGame() {
  if (starting || screen === "result") return;
  starting = true;
  const token = ++run;
  $("play").classList.add("loading");
  $("play-again").classList.add("loading");
  // Unlock audio on the tap. Camera access is deferred until the visible photo step.
  await audio.unlock().catch(() => {});
  if (token !== run) return;
  leaderboard.cancel();
  game = new Game();
  photo = null;
  accepting = false;
  starting = false;
  $("play").classList.remove("loading");
  $("play-again").classList.remove("loading");
  $("intro").hidden = false;
  $("digit-stage").hidden = true;
  $("intro").textContent = "Pi ist …";
  replayAnimation($("intro"), "correct-pop");
  $("feedback").textContent = "\u00a0";
  renderGame();
  show("game");
  audio.startMusic();
  keepAwake();
  await sleep(1100);
  if (token !== run) return;
  $("intro").textContent = "3.";
  replayAnimation($("intro"), "correct-pop");
  audio.cue("correct");
  await sleep(900);
  if (token !== run) return;
  $("intro").hidden = true;
  $("digit-stage").hidden = false;
  accepting = true;
  enableDigits(true);
}
function enableDigits(enabled) {
  $("keyboard")
    .querySelectorAll("button")
    .forEach((button) => {
      button.disabled = !enabled;
    });
}
function renderGame() {
  $("score").textContent = game.score;
  document.body.dataset.lives = game.hearts;
  audio.setLives(game.hearts);
  $("hearts").replaceChildren(
    ...Array.from({ length: 3 }, (_, i) => {
      const heart = document.createElement("span");
      heart.textContent = "♥";
      if (i >= game.hearts) heart.className = "lost";
      return heart;
    }),
  );
  $("hearts").setAttribute(
    "aria-label",
    `${game.hearts} ${game.hearts === 1 ? "Herz" : "Herzen"}`,
  );
  $("sequence").textContent =
    (game.score > 9 ? "…" : "") + game.sequence.slice(-9);
  $("sequence").classList.toggle("older", game.score > 9);
  enableDigits(accepting);
}
function guess(digit) {
  if (!accepting || screen !== "game" || document.querySelector("dialog[open]"))
    return;
  const result = game.guess(digit);
  if (!result) return;
  audio.cue(result.correct ? "correct" : "wrong");
  renderGame();
  if (result.correct) {
    $("feedback").textContent = "Richtig!";
    replayAnimation($("sequence"), "correct-pop");
    replayAnimation($("score"), "correct-pop");
  } else {
    $("feedback").textContent = game.hearts
      ? "Falsch. Nochmal!"
      : "Keine Leben mehr.";
    replayAnimation($("impact-overlay"), "hit");
    replayAnimation($("digit-stage"), "wrong");
    replayAnimation($("hearts"), "wrong");
  }
  if (result.over) {
    accepting = false;
    enableDigits(false);
    finishRound();
  }
}
async function finishRound() {
  const token = run;
  audio.endRound();
  await sleep(600);
  if (token !== run) return;
  $("final-score").textContent = game.score;
  $("result-description").textContent = game.score === 1 ? "Punkt" : "Punkte";
  $("camera").hidden = false;
  $("captured-photo").hidden = true;
  $("camera-count").textContent = "";
  $("camera-title").textContent = "Dein Foto";
  $("camera-message").textContent = "Gleich geht’s los.";
  $("retry-camera").hidden = true;
  $("retry-save").hidden = true;
  show("result");
  replayAnimation($("final-score"), "correct-pop");
  audio.fanfare();
  replayAnimation($("impact-overlay"), "win");
  confetti();
  const attempt = photoAttempt;
  await sleep(2200);
  if (token !== run || attempt !== photoAttempt) return;
  await takePhoto(token);
}
// A background interruption cancels this countdown and requires a retry tap.
async function visibleSecond(token, attempt) {
  let elapsed = 0,
    previous = performance.now();
  while (elapsed < 1000 && token === run && attempt === photoAttempt) {
    await sleep(100);
    const now = performance.now();
    if (!document.hidden) elapsed += Math.min(now - previous, 150);
    previous = now;
  }
}
function photoError(error) {
  $("camera-count").textContent = "";
  $("camera-title").textContent = "Kamera unterbrochen.";
  $("camera-message").textContent = cameraError(error);
  $("retry-camera").hidden = false;
}
function interruptPhoto() {
  photoAttempt++;
  takingPhoto = false;
  camera.stop();
  if (screen === "result" && !photo) {
    photoError(
      new Error(
        "Bitte tippe auf „Kamera erneut starten“, wenn du wieder bereit bist.",
      ),
    );
  }
}
async function takePhoto(token = run) {
  if (takingPhoto || photo || screen !== "result") return;
  if (document.hidden) {
    interruptPhoto();
    return;
  }
  takingPhoto = true;
  const attempt = ++photoAttempt;
  const current = () => token === run && attempt === photoAttempt;
  $("retry-camera").hidden = true;
  $("camera-title").textContent = "Dein Foto";
  $("camera-message").textContent = "Kamera startet …";
  try {
    await camera.ready();
    if (!current()) return;
    for (let count = 5; count > 0; count--) {
      if (!current()) return;
      $("camera-count").textContent = count;
      $("camera-message").textContent = `Foto in ${count} …`;
      replayAnimation($("camera-count"), "correct-pop");
      audio.cue("tick");
      await visibleSecond(token, attempt);
    }
    if (!current()) return;
    const captured = await camera.capture();
    if (!current()) return;
    photo = captured;
    $("captured-photo").src = photo;
    $("captured-photo").hidden = false;
    $("camera").hidden = true;
    $("camera-count").textContent = "";
    replayAnimation($("camera-flash"), "flash");
    audio.shutter();
    camera.stop();
    $("camera-title").textContent = "Foto gespeichert.";
    $("camera-message").textContent = "";
    await sleep(1100);
    if (!current()) return;
    await saveResult();
  } catch (error) {
    if (current()) {
      camera.stop();
      photoError(error);
    }
  } finally {
    if (current()) takingPhoto = false;
  }
}
async function saveResult() {
  if (saving || !photo) return;
  saving = true;
  $("retry-save").hidden = true;
  try {
    const { entry, scores } = addScore(game.score, photo);
    show("scores");
    releaseWakeLock();
    await leaderboard.climb(scores, entry);
  } catch (error) {
    $("camera-title").textContent = "Speichern fehlgeschlagen.";
    $("camera-message").textContent = error.message;
    $("retry-save").hidden = false;
  } finally {
    saving = false;
  }
}

for (let digit = 0; digit <= 9; digit++) {
  const button = document.createElement("button");
  button.className = "digit-button";
  button.textContent = digit;
  button.dataset.digit = digit;
  button.setAttribute("aria-label", `Ziffer ${digit}`);
  button.addEventListener("click", () => guess(String(digit)));
  $("keyboard").append(button);
}
$("play").addEventListener("click", startGame);
$("play-again").addEventListener("click", startGame);
$("highscores").addEventListener("click", () => {
  audio.unlock();
  audio.cue("click");
  scores();
});
$("brand").addEventListener("click", requestHome);
$("leave-game").addEventListener("click", requestHome);
$("back-home").addEventListener("click", home);
$("keep-playing").addEventListener("click", () => $("leave-dialog").close());
$("confirm-leave").addEventListener("click", () => {
  $("leave-dialog").close();
  home();
});
// Keep the host control out of the game UI: five taps within five seconds.
let creditTaps = 0,
  creditTapStart = 0;
$("music-credit").addEventListener("click", (event) => {
  event.preventDefault();
  if (
    (screen !== "home" && screen !== "scores") ||
    starting ||
    saving ||
    document.querySelector("dialog[open]")
  ) {
    creditTaps = 0;
    return;
  }
  const now = performance.now();
  if (!creditTaps || now - creditTapStart > 5000) {
    creditTaps = 0;
    creditTapStart = now;
  }
  if (++creditTaps !== 5) return;
  creditTaps = 0;
  $("reset-form").reset();
  $("confirm-reset").disabled = true;
  $("reset-error").hidden = true;
  $("reset-dialog").showModal();
  $("reset-confirmation").focus();
});
$("reset-confirmation").addEventListener("input", () => {
  $("confirm-reset").disabled = $("reset-confirmation").value !== "Reset";
});
$("reset-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("reset-confirmation").value !== "Reset") return;
  try {
    resetScores();
    leaderboard.cancel();
    if (screen === "scores") leaderboard.render([]);
    $("reset-dialog").close();
  } catch (error) {
    $("reset-error").textContent = error.message;
    $("reset-error").hidden = false;
  }
});
$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("reset-dialog").addEventListener("close", () => {
  $("reset-form").reset();
  $("confirm-reset").disabled = true;
});
$("sound-toggle").addEventListener("click", () => {
  audio.unlock();
  audio.toggle();
  soundButton();
});
$("retry-camera").addEventListener("click", () => {
  audio.unlock();
  takePhoto();
});
$("retry-save").addEventListener("click", saveResult);
document.addEventListener("keydown", (event) => {
  if (/^[0-9]$/.test(event.key) && !event.repeat && screen === "game") {
    event.preventDefault();
    guess(event.key);
    const button = $(`keyboard`).querySelector(`[data-digit="${event.key}"]`);
    if (accepting) {
      button.classList.add("pressed");
      setTimeout(() => button.classList.remove("pressed"), 100);
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (screen === "result" && !photo) interruptPhoto();
    audio.suspend();
    releaseWakeLock();
  } else {
    audio.resume();
    if (screen === "game" || screen === "result") keepAwake();
  }
});
window.addEventListener("pagehide", () => {
  if (screen === "result" && !photo) interruptPhoto();
  else camera.stop();
  audio.suspend();
  releaseWakeLock();
});

$("impact-overlay").addEventListener("animationend", () => {
  $("impact-overlay").className = "impact-overlay";
});

soundButton();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(async (registration) => {
      const ready = () => {
        $("offline-status").textContent = "Offline bereit";
        $("status-dot").classList.add("ready");
      };
      if (registration.active) ready();
      const installing = registration.installing;
      if (installing)
        installing.addEventListener("statechange", () => {
          if (installing.state === "activated") ready();
          if (installing.state === "redundant")
            $("offline-status").textContent =
              "Offline-Download fehlgeschlagen. Neu laden.";
        });
      await navigator.serviceWorker.ready;
      ready();
    })
    .catch(() => {
      $("offline-status").textContent =
        "Offline-Download fehlgeschlagen. Neu laden.";
    });
} else
  $("offline-status").textContent = "Für Offline-Betrieb über HTTPS öffnen.";
