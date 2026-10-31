export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function replayAnimation(element, name) {
  element.classList.remove(name);
  void element.offsetWidth;
  element.classList.add(name);
}
export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const container = document.getElementById("confetti");
  container.replaceChildren();
  for (let i = 0; i < 65; i++) {
    const piece = document.createElement("i");
    piece.style.cssText = `left:${Math.random() * 100}%;background:${["#ff173f", "#b5072b", "#ffffff", "#ffffff", "#ff5975"][i % 5]};animation-delay:${Math.random() * 0.6}s;--drift:${Math.random() * 240 - 120}px;--spin:${Math.random() * 900 - 450}deg;border-radius:${i % 3 === 0 ? "50%" : "2px"}`;
    container.append(piece);
  }
  setTimeout(() => container.replaceChildren(), 4500);
}
