import { PI_DIGITS } from "./pi.js";

/** A wrong answer costs a heart but never advances the decimal position. */
export class Game {
  constructor() {
    this.score = 0;
    this.hearts = 3;
  }
  get over() {
    return this.hearts === 0 || this.score === PI_DIGITS.length;
  }
  guess(digit) {
    if (this.over || !/^[0-9]$/.test(String(digit))) return null;
    const correct = String(digit) === PI_DIGITS[this.score];
    if (correct) this.score++;
    else this.hearts--;
    return { correct, score: this.score, hearts: this.hearts, over: this.over };
  }
  get sequence() {
    return PI_DIGITS.slice(0, this.score);
  }
}
