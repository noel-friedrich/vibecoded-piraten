import { test } from "node:test";
import assert from "node:assert/strict";
import { Camera } from "../js/camera.js";

function stream() {
  const track = {
    readyState: "live",
    enabled: true,
    muted: false,
    stop() {
      this.readyState = "ended";
    },
  };
  return { getTracks: () => [track], getVideoTracks: () => [track] };
}
function setup(getUserMedia) {
  globalThis.window = { isSecureContext: true };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
  const video = {
    paused: true,
    readyState: 2,
    videoWidth: 480,
    videoHeight: 480,
    currentTime: 0,
    srcObject: null,
    play() {
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
    requestVideoFrameCallback(callback) {
      return setTimeout(callback, 0);
    },
    cancelVideoFrameCallback(id) {
      clearTimeout(id);
    },
  };
  return { video, camera: new Camera(video) };
}

test("camera is lazy, shares concurrent requests, and reuses a healthy preview", async () => {
  let requests = 0;
  const source = stream();
  const { camera, video } = setup(async () => {
    requests++;
    return source;
  });
  assert.equal(requests, 0);
  const first = camera.ready();
  assert.equal(camera.ready(), first);
  await first;
  assert.equal(requests, 1);
  assert.equal(camera.usable, true);
  await camera.ready();
  assert.equal(requests, 1);
  camera.stop();
  assert.equal(source.getTracks()[0].readyState, "ended");
  assert.equal(video.srcObject, null);
  assert.equal(video.paused, true);
});

test("a muted live track is not a usable camera and retry replaces it", async () => {
  const sources = [stream(), stream()];
  let requests = 0;
  const { camera } = setup(async () => sources[requests++]);
  await camera.ready();
  sources[0].getTracks()[0].muted = true;
  assert.equal(camera.usable, false);
  await assert.rejects(camera.capture(), /unterbrochen/);
  await camera.ready();
  assert.equal(requests, 2);
  assert.equal(sources[0].getTracks()[0].readyState, "ended");
  assert.equal(camera.usable, true);
  camera.stop();
});

test("a late permission response after cancellation is released immediately", async () => {
  let deliver;
  const source = stream();
  const { camera, video } = setup(
    () =>
      new Promise((resolve) => {
        deliver = resolve;
      }),
  );
  const pending = camera.ready();
  const rejected = assert.rejects(pending, { name: "AbortError" });
  camera.stop();
  await rejected;
  deliver(source);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(source.getTracks()[0].readyState, "ended");
  assert.equal(camera.stream, null);
  assert.equal(video.srcObject, null);
});

test("a cancelled old request cannot stop or replace the next photo stream", async () => {
  let deliver;
  const oldSource = stream(),
    newSource = stream();
  let requests = 0;
  const { camera, video } = setup(() =>
    ++requests === 1
      ? new Promise((resolve) => {
          deliver = resolve;
        })
      : Promise.resolve(newSource),
  );
  const old = camera.ready();
  const rejected = assert.rejects(old, { name: "AbortError" });
  camera.stop();
  await camera.ready();
  deliver(oldSource);
  await rejected;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(video.srcObject, newSource);
  assert.equal(camera.usable, true);
  assert.equal(oldSource.getTracks()[0].readyState, "ended");
  camera.stop();
});

test("playback failure releases the camera so a retry can start cleanly", async () => {
  const sources = [stream(), stream()];
  let requests = 0;
  const { camera, video } = setup(async () => sources[requests++]);
  const play = video.play;
  video.play = () => Promise.reject(new Error("Playback interrupted"));
  await assert.rejects(camera.ready(), /Playback interrupted/);
  assert.equal(sources[0].getTracks()[0].readyState, "ended");
  assert.equal(video.srcObject, null);
  video.play = play;
  await camera.ready();
  assert.equal(camera.usable, true);
  camera.stop();
});

test("stalled video fails with a retry message and releases its stream", async (t) => {
  const source = stream();
  const { camera, video } = setup(async () => source);
  video.requestVideoFrameCallback = () => 42;
  video.cancelVideoFrameCallback = () => {};
  const original = globalThis.setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, delay, ...args) =>
    original(callback, delay === 12000 ? 10 : delay, ...args),
  );
  await assert.rejects(camera.ready(), /Kamerabild/);
  assert.equal(source.getTracks()[0].readyState, "ended");
  assert.equal(video.srcObject, null);
});
