import { Game } from "./game.js";
import { loadScores, addScore } from "./storage.js";
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

function show(name) {
  screen = name;
  for (const section of document.querySelectorAll(".screen"))
    section.hidden = section.id !== `${name}-screen`;
  $("help").hidden = name === "result";
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
  accepting = false;
  starting = false;
  leaderboard.cancel();
  camera.stop();
  audio.stopMusic();
  releaseWakeLock();
  $("play").classList.remove("loading");
  $("play-again").classList.remove("loading");
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
  // Both calls begin inside the user gesture, so iPad Safari can unlock media.
  const unlocked = audio.unlock();
  try {
    await camera.start();
    await unlocked;
  } catch (error) {
    if (token !== run) {
      camera.stop();
      return;
    }
    starting = false;
    $("play").classList.remove("loading");
    $("play-again").classList.remove("loading");
    $("camera-error").textContent = cameraError(error);
    if (!$("camera-dialog").open) $("camera-dialog").showModal();
    return;
  }
  if (token !== run) {
    camera.stop();
    return;
  }
  $("camera-dialog").close();
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
  $("feedback").textContent = "Tippe auf die nächste Ziffer.";
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
    $("feedback").textContent = [
      "Richtig! Weiter geht’s, Zahlenpirat.",
      "Ahoi! Die nächste Ziffer wartet.",
      "Stark! Du bist auf Kurs.",
    ][game.score % 3];
    replayAnimation($("sequence"), "correct-pop");
    replayAnimation($("score"), "correct-pop");
  } else {
    $("feedback").textContent = game.hearts
      ? "Daneben! Versuch dieselbe Ziffer nochmal."
      : "Alle Herzen verspielt. Was für ein Auftritt!";
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
  audio.stopMusic();
  await sleep(600);
  if (token !== run) return;
  $("final-score").textContent = game.score;
  $("result-description").textContent =
    game.score === 1 ? "richtige Nachkommastelle" : "richtige Nachkommastellen";
  try {
    const rank = loadScores().filter((e) => e.score >= game.score).length + 1;
    $("result-rank").textContent =
      rank === 1 ? "✦ Dein Kurs: Platz 1!" : `✦ Dein Kurs: Platz ${rank}!`;
  } catch {
    $("result-rank").textContent = "✦ Ein Auftritt für die Ewigkeit!";
  }
  $("camera").hidden = false;
  $("captured-photo").hidden = true;
  $("camera-count").textContent = "";
  $("camera-title").textContent = "Lächeln, Zahlenpirat!";
  $("camera-message").textContent = "Dein Foto wird gleich aufgenommen.";
  $("retry-camera").hidden = true;
  $("retry-save").hidden = true;
  show("result");
  replayAnimation($("final-score"), "correct-pop");
  audio.fanfare();
  confetti();
  await sleep(2200);
  if (token !== run) return;
  await takePhoto(token);
}
// Countdown time advances only while the app is visible, never in a background tab.
async function visibleSecond(token) {
  let elapsed = 0,
    previous = performance.now();
  while (elapsed < 1000 && token === run) {
    await sleep(100);
    const now = performance.now();
    if (!document.hidden) elapsed += Math.min(now - previous, 150);
    previous = now;
  }
}
async function takePhoto(token = run) {
  $("retry-camera").hidden = true;
  $("camera-title").textContent = "Lächeln, Zahlenpirat!";
  try {
    await camera.ready();
    if (token !== run) return;
    for (let count = 5; count > 0; count--) {
      while (document.hidden && token === run) await sleep(200);
      if (token !== run) return;
      $("camera-count").textContent = count;
      $("camera-message").textContent =
        `Dein Foto wird in ${count} ${count === 1 ? "Sekunde" : "Sekunden"} aufgenommen.`;
      replayAnimation($("camera-count"), "correct-pop");
      audio.cue("tick");
      await visibleSecond(token);
    }
    if (token !== run) return;
    photo = camera.capture();
    $("captured-photo").src = photo;
    $("captured-photo").hidden = false;
    $("camera").hidden = true;
    $("camera-count").textContent = "";
    replayAnimation($("camera-flash"), "flash");
    audio.shutter();
    camera.stop();
    $("camera-title").textContent = "Ab in die Hall of Fame!";
    $("camera-message").textContent = "Dein großer Moment ist im Kasten.";
    await sleep(1100);
    if (token !== run) return;
    await saveResult();
  } catch (error) {
    $("camera-count").textContent = "";
    $("camera-title").textContent = "Die Kamera braucht dich.";
    $("camera-message").textContent = cameraError(error);
    $("retry-camera").hidden = false;
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
    $("camera-title").textContent = "Dein Auftritt bleibt hier.";
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
$("help").addEventListener("click", () => $("help-dialog").showModal());
$("close-help").addEventListener("click", () => $("help-dialog").close());
$("sound-toggle").addEventListener("click", () => {
  audio.unlock();
  audio.toggle();
  soundButton();
});
$("camera-start-retry").addEventListener("click", startGame);
$("camera-cancel").addEventListener("click", () => {
  $("camera-dialog").close();
  home();
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
    audio.suspend();
    releaseWakeLock();
  } else {
    audio.resume();
    if (screen === "game" || screen === "result") keepAwake();
  }
});
window.addEventListener("pagehide", () => {
  camera.stop();
  audio.suspend();
  releaseWakeLock();
});

soundButton();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(async (registration) => {
      const ready = () => {
        $("offline-status").textContent = "OFFLINE BEREIT";
        $("status-dot").classList.add("ready");
      };
      if (registration.active) ready();
      const installing = registration.installing;
      if (installing)
        installing.addEventListener("statechange", () => {
          if (installing.state === "activated") ready();
          if (installing.state === "redundant")
            $("offline-status").textContent =
              "OFFLINE-DOWNLOAD FEHLGESCHLAGEN – BITTE NEU LADEN";
        });
      await navigator.serviceWorker.ready;
      ready();
    })
    .catch(() => {
      $("offline-status").textContent =
        "OFFLINE-DOWNLOAD FEHLGESCHLAGEN – BITTE NEU LADEN";
    });
} else
  $("offline-status").textContent = "FÜR OFFLINE-BETRIEB ÜBER HTTPS ÖFFNEN";
