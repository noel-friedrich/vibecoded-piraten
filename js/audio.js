/** Locally bundled score + synthesized broadcast stings; no network at runtime. */
export class ShowAudio {
  constructor() {
    this.muted = false;
    try {
      this.muted = localStorage.getItem("pi-raten.muted") === "true";
    } catch {
      /* Session-only preference. */
    }
    this.context = null;
    this.music = new Audio(
      new URL("../assets/audio/five-armies.mp3", import.meta.url),
    );
    this.music.loop = true;
    this.music.volume = 0.48;
    this.music.preload = "auto";
    this.music.muted = this.muted;
    this.playing = false;
    this.lives = 3;
    this.heartbeat = null;
  }
  // Unlock both Web Audio and HTML media directly from the first tap on iPad.
  async unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 5;
      this.master.connect(compressor).connect(this.context.destination);
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const resumed = this.context.resume();
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
        /* Retried when the round starts. */
      }
      this.music.volume = volume;
    } else await resumed;
  }
  toggle() {
    this.muted = !this.muted;
    try {
      localStorage.setItem("pi-raten.muted", String(this.muted));
    } catch {
      /* Session-only preference. */
    }
    this.music.muted = this.muted;
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 0.7,
        this.context.currentTime,
        0.015,
      );
    if (!this.muted && this.playing) this.music.play().catch(() => {});
    return this.muted;
  }
  startMusic() {
    this.playing = true;
    this.music.currentTime = 0;
    this.music.play().catch(() => {});
    this.setLives(3);
    this.cue("rise");
  }
  stopMusic() {
    this.playing = false;
    this.music.pause();
    this.music.currentTime = 0;
    this.stopHeartbeat();
  }
  setLives(lives) {
    this.lives = lives;
    this.music.volume = lives === 1 ? 0.58 : 0.48;
    this.stopHeartbeat();
    if (lives === 1 && this.playing && !document.hidden) {
      this.heartbeat = setInterval(() => {
        this.tone(65, 0.18, 0, "sine", 0.38, 38);
        this.tone(58, 0.16, 0.21, "sine", 0.25, 33);
      }, 1050);
    }
  }
  stopHeartbeat() {
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
  get audible() {
    return !this.muted && this.context?.state === "running";
  }
  tone(
    frequency,
    duration,
    offset = 0,
    type = "sine",
    volume = 0.2,
    endFrequency = frequency,
  ) {
    if (!this.audible) return;
    const at = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      at + duration,
    );
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  burst(duration = 0.25, offset = 0, volume = 0.3, frequency = 1700) {
    if (!this.audible) return;
    const at = this.context.currentTime + offset;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(at);
    source.stop(at + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  cue(name) {
    if (!this.audible) return;
    switch (name) {
      case "wrong":
        this.burst(0.45, 0, 0.6, 1100);
        this.tone(115, 0.48, 0, "sawtooth", 0.23, 72);
        this.tone(121, 0.48, 0, "sawtooth", 0.19, 76);
        this.tone(72, 0.65, 0, "sine", 0.5, 30);
        break;
      case "correct":
        this.tone(90, 0.2, 0, "sine", 0.4, 40);
        [587, 880, 1175].forEach((f, i) =>
          this.tone(f, 0.21, i * 0.055, "triangle", 0.23),
        );
        this.burst(0.08, 0, 0.12, 4000);
        break;
      case "tick":
        this.tone(100, 0.3, 0, "sine", 0.55, 38);
        this.tone(1000, 0.09, 0, "square", 0.09, 650);
        this.burst(0.08, 0, 0.15, 2800);
        break;
      case "rise":
        this.tone(70, 0.8, 0, "sawtooth", 0.14, 750);
        this.tone(73, 0.8, 0, "sawtooth", 0.1, 780);
        this.burst(0.65, 0.18, 0.25, 3000);
        this.tone(50, 0.7, 0.7, "sine", 0.4, 27);
        break;
      default:
        this.tone(280, 0.15, 0, "square", 0.12, 80);
        this.burst(0.05, 0, 0.12, 2400);
    }
  }
  endRound() {
    this.stopMusic();
    this.tone(70, 1.2, 0, "sine", 0.5, 25);
    [146.83, 155.56, 220].forEach((f) =>
      this.tone(f, 0.95, 0, "sawtooth", 0.12, f * 0.5),
    );
    this.burst(0.8, 0, 0.45, 1300);
  }
  fanfare() {
    this.tone(85, 1, 0, "sine", 0.6, 30);
    this.burst(0.7, 0, 0.4, 2200);
    [293.66, 349.23, 440, 587.33].forEach((f, i) => {
      this.tone(f, 0.55, i * 0.12, "sawtooth", 0.12);
      this.tone(f * 2, 0.65, 0.5 + i * 0.05, "triangle", 0.16);
    });
  }
  shutter() {
    this.burst(0.06, 0, 0.45, 6000);
    this.burst(0.13, 0.08, 0.3, 2500);
    this.tone(100, 0.18, 0, "sine", 0.3, 40);
  }
  suspend() {
    this.music.pause();
    this.stopHeartbeat();
    this.context?.suspend();
  }
  resume() {
    if (this.playing) this.music.play().catch(() => {});
    this.context?.resume();
    this.setLives(this.lives);
  }
}
