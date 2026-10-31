import { sleep, confetti } from "./effects.js";

function row(entry, index, freshId) {
  const element = document.createElement("div");
  element.className = "score-row" + (entry.id === freshId ? " new-score" : "");
  element.dataset.id = entry.id;
  const rank = document.createElement("div");
  rank.className = "rank-number" + (index < 3 ? " top" : "");
  rank.textContent = String(index + 1).padStart(2, "0");
  const scorer = document.createElement("div");
  scorer.className = "scorer";
  const image = document.createElement("img");
  image.src = entry.photo;
  image.alt = `Foto auf Platz ${index + 1}`;
  const label = document.createElement("div");
  label.className = "scorer-label";
  label.textContent =
    index === 0
      ? "Kapitän der Ziffern"
      : index < 3
        ? "Pi-Legende"
        : "Zahlenpirat";
  if (entry.id === freshId) {
    const badge = document.createElement("span");
    badge.className = "new-label";
    badge.textContent = "DU!";
    label.append(badge);
  }
  const date = document.createElement("small");
  date.textContent = new Date(entry.createdAt).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  label.append(date);
  scorer.append(image, label);
  const score = document.createElement("div");
  score.className = "row-score";
  score.textContent = entry.score;
  element.append(rank, scorer, score);
  return element;
}
export class Leaderboard {
  constructor(list, audio) {
    this.list = list;
    this.audio = audio;
    this.run = 0;
  }
  render(scores, freshId = null) {
    this.run++;
    this.list.replaceChildren(
      ...scores.map((entry, index) => row(entry, index, freshId)),
    );
    document.getElementById("empty-scores").hidden = scores.length > 0;
    document.getElementById("score-summary").textContent = scores.length
      ? `${scores.length} AUFTRITTE. EINE UNENDLICHE ZAHL.`
      : "DEIN RUHM BLEIBT AUF DIESER INSEL.";
    this.list.scrollTop = 0;
  }
  async climb(scores, entry) {
    this.render(scores, entry.id);
    const run = this.run;
    const target = [...this.list.children].find(
      (el) => el.dataset.id === entry.id,
    );
    const rank = scores.findIndex((e) => e.id === entry.id) + 1;
    const summary = document.getElementById("score-summary");
    summary.textContent = "DEIN HIGHSCORE ENTERT DIE BESTENLISTE …";
    await sleep(150);
    if (run !== this.run) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.scrollIntoView({ block: "center" });
      summary.textContent = `AHOI! DEIN PLATZ: ${rank}.`;
      return;
    }
    const floating = target.cloneNode(true);
    floating.classList.add("rank-flying");
    const panel = this.list.parentElement;
    panel.append(floating);
    const headerHeight = panel.querySelector(".table-heading").offsetHeight;
    floating.style.top = `${headerHeight}px`;
    floating.style.left = "10px";
    floating.style.right = "10px";
    target.style.visibility = "hidden";
    const startScroll = Math.max(
      0,
      this.list.scrollHeight - this.list.clientHeight,
    );
    const endScroll = Math.max(
      0,
      Math.min(
        startScroll,
        target.offsetTop - this.list.clientHeight / 2 + target.offsetHeight / 2,
      ),
    );
    this.list.scrollTop = startScroll;
    const startY = Math.max(
      0,
      this.list.clientHeight - target.offsetHeight - 8,
    );
    floating.style.transform = `translateY(${startY}px)`;
    this.audio.cue("rise");
    const started = performance.now();
    const duration = 2400;
    await new Promise((resolve) => {
      const animate = (now) => {
        if (run !== this.run) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - started) / duration);
        const eased = 1 - (1 - t) ** 3;
        this.list.scrollTop = startScroll + (endScroll - startScroll) * eased;
        const destination = target.offsetTop - endScroll;
        floating.style.transform = `translateY(${startY + (destination - startY) * eased}px)`;
        const visualRank = Math.round(
          scores.length + (rank - scores.length) * eased,
        );
        floating.querySelector(".rank-number").textContent = String(
          visualRank,
        ).padStart(2, "0");
        if (t < 1) requestAnimationFrame(animate);
        else resolve();
      };
      requestAnimationFrame(animate);
    });
    floating.remove();
    target.style.visibility = "";
    if (run !== this.run) return;
    target.classList.add("rank-landed");
    summary.textContent = `AHOI! DEIN PLATZ: ${rank}. ${rank === 1 ? "NEUER INSELREKORD!" : "STARK GEENTERT!"}`;
    this.audio.fanfare();
    confetti();
  }
  cancel() {
    this.run++;
    document.querySelector(".rank-flying")?.remove();
  }
}
