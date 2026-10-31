const FILES = {
  click: "click.wav",
  correct: "correct.wav",
  wrong: "wrong.wav",
  tick: "tick.wav",
  rise: "rise.wav",
};
export class ShowAudio {
  constructor() {
    this.muted = false;
    try {
      this.muted = localStorage.getItem("pi-raten.muted") === "true";
    } catch {
      /* Session-only audio preference. */
    }
    this.context = null;
    this.buffers = new Map();
    this.music = new Audio(
      new URL("../assets/audio/cipher.mp3", import.meta.url),
    );
    this.music.loop = true;
    this.music.volume = 0.25;
    this.music.preload = "auto";
    this.music.muted = this.muted;
    this.playing = false;
  }
  // Invoked from a real tap, before awaiting camera permissions (iOS audio unlock).
  async unlock() {
    this.context ??= new (window.AudioContext || window.webkitAudioContext)();
    const resumed = this.context.resume();
    if (!this.loading)
      this.loading = Promise.all(
        Object.entries(FILES).map(async ([name, file]) => {
          try {
            const response = await fetch(
              new URL(`../assets/audio/${file}`, import.meta.url),
            );
            this.buffers.set(
              name,
              await this.context.decodeAudioData(await response.arrayBuffer()),
            );
          } catch {
            /* Procedural cues still work when an audio decoder is unavailable. */
          }
        }),
      );
    // Prime the HTML media element in the gesture on iPad.
    if (!this.playing) {
      const volume = this.music.volume;
      this.music.volume = 0;
      try {
        const primed = this.music.play();
        await resumed;
        await primed;
        if (!this.playing) {
          this.music.pause();
          this.music.currentTime = 0;
        }
      } catch {
        /* Retried at game start. */
      }
      this.music.volume = volume;
    }
  }
  toggle() {
    this.muted = !this.muted;
    try {
      localStorage.setItem("pi-raten.muted", String(this.muted));
    } catch {
      /* Volume still works. */
    }
    this.music.muted = this.muted;
    if (!this.muted && this.playing) this.music.play().catch(() => {});
    return this.muted;
  }
  startMusic() {
    this.playing = true;
    this.music.currentTime = 0;
    this.music.play().catch(() => {});
  }
  stopMusic() {
    this.playing = false;
    this.music.pause();
    this.music.currentTime = 0;
  }
  cue(name) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const buffer = this.buffers.get(name);
    if (buffer) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = name === "wrong" ? 0.45 : 0.65;
      source.connect(gain).connect(this.context.destination);
      source.start();
    } else
      this.tone(name === "wrong" ? 150 : name === "tick" ? 700 : 520, 0.09);
  }
  tone(frequency, duration, offset = 0, type = "sine", volume = 0.13) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const at = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.01);
  }
  fanfare() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      this.tone(f, 0.3, i * 0.13, "triangle", 0.2),
    );
  }
  shutter() {
    [1600, 900, 500].forEach((f, i) =>
      this.tone(f, 0.045, i * 0.035, "square", 0.05),
    );
  }
  suspend() {
    this.music.pause();
  }
  resume() {
    if (this.playing) this.music.play().catch(() => {});
    this.context?.resume();
  }
}
