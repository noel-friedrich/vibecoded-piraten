import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { Game } from "../js/game.js";
import { PI_DIGITS } from "../js/pi.js";
import {
  sortScores,
  loadScores,
  addScore,
  resetScores,
} from "../js/storage.js";

test("Pi contains 10,000 decimals and the known first 100 digits", () => {
  assert.equal(PI_DIGITS.length, 10000);
  assert.match(PI_DIGITS, /^\d+$/);
  assert.equal(
    PI_DIGITS.slice(0, 100),
    "1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679",
  );
});
test("correct digits advance, mistakes cost hearts and retry the same position", () => {
  const game = new Game();
  assert.equal(game.guess(1).score, 1);
  assert.equal(game.guess(9).hearts, 2);
  assert.equal(game.score, 1);
  assert.equal(game.guess(4).correct, true);
  assert.equal(game.sequence, "14");
  game.guess(0);
  game.guess(0);
  assert.equal(game.over, true);
  assert.equal(game.score, 2);
  assert.equal(game.guess(1), null);
});
test("invalid inputs do not cost hearts", () => {
  const game = new Game();
  for (const value of ["x", "", "12", -1, undefined])
    assert.equal(game.guess(value), null);
  assert.equal(game.hearts, 3);
});
test("all supplied digits can be completed", () => {
  const game = new Game();
  for (const digit of PI_DIGITS) assert.equal(game.guess(digit).correct, true);
  assert.equal(game.score, 10000);
  assert.equal(game.over, true);
  assert.equal(game.hearts, 3);
});
test("ranking is descending and ties retain earlier entry", () => {
  const scores = [
    { id: "a", score: 3, createdAt: 1 },
    { id: "b", score: 9, createdAt: 3 },
    { id: "c", score: 9, createdAt: 2 },
  ];
  assert.deepEqual(
    sortScores(scores).map((e) => e.id),
    ["c", "b", "a"],
  );
  assert.equal(scores[0].id, "a");
});
test("storage saves photos, reloads scores, and keeps originals on quota failure", () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const photo = "data:image/jpeg;base64,AA==";
  assert.deepEqual(loadScores(), []);
  const first = addScore(5, photo);
  assert.equal(first.rank, 1);
  assert.equal(loadScores()[0].photo, photo);
  assert.equal(addScore(8, photo).rank, 1);
  assert.equal(addScore(1, photo).rank, 3);
  const before = data.get("pi-raten.highscores.v1");
  globalThis.localStorage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.throws(() => addScore(9, photo), /Gerätespeicher/);
  assert.equal(data.get("pi-raten.highscores.v1"), before);
  data.set("pi-raten.highscores.v1", "invalid");
  assert.throws(() => loadScores(), /nicht gelesen/);
});
test("every offline asset exists, including all imported JS and referenced local audio", () => {
  let files;
  const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const sandbox = { self: { addEventListener() {} } };
  vm.runInNewContext(source + "\nglobalThis.files=FILES;", sandbox);
  files = sandbox.files;
  for (const file of files)
    assert.ok(existsSync(new URL("../" + file, import.meta.url)), file);
  for (const file of [
    "app",
    "audio",
    "camera",
    "effects",
    "game",
    "leaderboard",
    "pi",
    "storage",
  ]) {
    assert.ok(files.includes(`./js/${file}.js`));
  }
});
test("offline audio handles Safari byte ranges and rejects invalid ranges", async () => {
  const sandbox = { self: { addEventListener() {} }, Response };
  vm.runInNewContext(
    readFileSync(new URL("../sw.js", import.meta.url), "utf8"),
    sandbox,
  );
  const request = (range) => ({ headers: new Headers({ range }) });
  const full = () =>
    new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), {
      headers: { "Content-Type": "audio/mpeg" },
    });
  const partial = await sandbox.rangeResponse(request("bytes=1-3"), full());
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("Content-Range"), "bytes 1-3/6");
  assert.deepEqual([...new Uint8Array(await partial.arrayBuffer())], [1, 2, 3]);
  const suffix = await sandbox.rangeResponse(request("bytes=-2"), full());
  assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())], [4, 5]);
  assert.equal(
    (await sandbox.rangeResponse(request("bytes=9-"), full())).status,
    416,
  );
  assert.equal(
    (await sandbox.rangeResponse(request("bytes=5-2"), full())).status,
    416,
  );
});

test("reset deletes all leaderboard data without touching other settings", () => {
  const key = "pi-raten.highscores.v1";
  const data = new Map([
    [key, "invalid data"],
    ["pi-raten.muted", "true"],
  ]);
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    removeItem: (key) => data.delete(key),
  };
  resetScores();
  assert.deepEqual(loadScores(), []);
  assert.equal(data.get("pi-raten.muted"), "true");
  globalThis.localStorage.removeItem = () => {
    throw new Error("SecurityError");
  };
  assert.throws(() => resetScores(), /nicht gelöscht/);
});
