const CAMERA_TIMEOUT = 12000;
const interrupted = () =>
  new DOMException("Kamera unterbrochen.", "AbortError");

// Permission prompts and video.play() can stay pending on iOS. Bound each wait,
// and let stop() cancel it even when the underlying browser call cannot cancel.
function waitFor(promise, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", aborted);
    };
    const aborted = () => {
      cleanup();
      reject(interrupted());
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Die Kamera antwortet nicht. Bitte tippe auf „Kamera erneut starten“.",
        ),
      );
    }, CAMERA_TIMEOUT);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    Promise.resolve(promise).then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.pending = null;
    this.controller = null;
  }
  get usable() {
    const track = this.stream?.getVideoTracks()[0];
    return !!(
      track?.readyState === "live" &&
      track.enabled &&
      !track.muted &&
      this.video.srcObject === this.stream &&
      !this.video.paused &&
      this.video.readyState >= 2 &&
      this.video.videoWidth
    );
  }
  ready() {
    // Share one in-flight request; never ask for a second concurrent stream.
    if (this.pending) return this.pending;
    if (this.usable) return Promise.resolve();
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const pending = this.open(controller.signal)
      .catch((error) => {
        if (this.controller === controller) this.stop();
        throw error;
      })
      .finally(() => {
        if (this.pending === pending) this.pending = null;
      });
    this.pending = pending;
    return pending;
  }
  async open(signal) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Die Kamera braucht HTTPS oder localhost. Bitte öffne die App über eine sichere Adresse.",
      );
    }
    const request = navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
      })
      .then((stream) => {
        // A permission prompt may resolve after a timeout, cancellation or pagehide.
        // Release that late stream instead of letting it reactivate the camera.
        if (signal.aborted) {
          stream.getTracks().forEach((track) => track.stop());
          throw interrupted();
        }
        return stream;
      });
    const stream = await waitFor(request, signal);
    if (signal.aborted) {
      stream.getTracks().forEach((track) => track.stop());
      throw interrupted();
    }
    this.stream = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await waitFor(this.video.play(), signal);
    await this.nextFrame(signal);
    if (!this.usable)
      throw new Error("Die Kamera liefert kein Bild. Bitte starte sie erneut.");
  }
  nextFrame(signal = this.controller?.signal) {
    if (!signal || signal.aborted) return Promise.reject(interrupted());
    const video = this.video;
    // Wait for an actual decoded frame, not just metadata or an old loadeddata event.
    return new Promise((resolve, reject) => {
      let frameId, poll;
      const initialTime = video.currentTime;
      const cleanup = () => {
        clearTimeout(timer);
        clearInterval(poll);
        if (frameId !== undefined) video.cancelVideoFrameCallback(frameId);
        signal.removeEventListener("abort", aborted);
      };
      const aborted = () => {
        cleanup();
        reject(interrupted());
      };
      const loaded = () => {
        if (this.usable) {
          cleanup();
          resolve();
        } else {
          cleanup();
          reject(
            new Error(
              "Die Kamera wurde unterbrochen. Bitte starte sie erneut.",
            ),
          );
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "Kein aktuelles Kamerabild. Bitte starte die Kamera erneut.",
          ),
        );
      }, CAMERA_TIMEOUT);
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) {
        aborted();
        return;
      }
      if (typeof video.requestVideoFrameCallback === "function") {
        frameId = video.requestVideoFrameCallback(loaded);
      } else {
        poll = setInterval(() => {
          if (this.usable && video.currentTime > initialTime) loaded();
        }, 80);
      }
    });
  }
  async capture() {
    if (!this.usable)
      throw new Error(
        "Die Kamera wurde unterbrochen. Bitte starte sie erneut.",
      );
    await this.nextFrame();
    const video = this.video;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const context = canvas.getContext("2d");
    // Match the mirrored preview, cropped to a square.
    context.translate(160, 0);
    context.scale(-1, 1);
    context.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      160,
      160,
    );
    return canvas.toDataURL("image/jpeg", 0.58);
  }
  stop() {
    this.controller?.abort();
    this.controller = null;
    this.pending = null;
    this.video.pause();
    this.video.srcObject = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
export function cameraError(error) {
  if (error.name === "NotAllowedError")
    return "Bitte erlaube die Kamera in den Safari-Einstellungen und versuche es erneut.";
  if (error.name === "NotFoundError")
    return "Keine Kamera gefunden. Bitte prüfe deine Geräteeinstellungen.";
  if (error.name === "NotReadableError")
    return "Die Kamera wird gerade verwendet. Schließe die andere Kamera-App und versuche es erneut.";
  return (
    error.message ||
    "Die Kamera konnte nicht gestartet werden. Bitte versuche es erneut."
  );
}
