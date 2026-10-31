export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
  }
  async start() {
    if (
      this.stream?.getVideoTracks().some((track) => track.readyState === "live")
    ) {
      await this.video.play();
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Die Kamera braucht HTTPS oder localhost. Bitte öffne die App über eine sichere Adresse.",
      );
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 480 },
        height: { ideal: 480 },
      },
    });
    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  async ready() {
    await this.start();
    if (this.video.readyState >= 2 && this.video.videoWidth) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "Das Kamerabild ist noch nicht bereit. Bitte starte die Kamera erneut.",
          ),
        );
      }, 10000);
      const loaded = () => {
        if (this.video.videoWidth) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        this.video.removeEventListener("loadeddata", loaded);
      };
      this.video.addEventListener("loadeddata", loaded);
    });
  }
  capture() {
    const video = this.video;
    if (
      video.readyState < 2 ||
      !video.videoWidth ||
      !this.stream?.getVideoTracks().some((t) => t.readyState === "live")
    )
      throw new Error(
        "Die Kamera wurde unterbrochen. Bitte starte sie erneut.",
      );
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const context = canvas.getContext("2d");
    // Store what the player saw in the mirrored preview, cropped to a square.
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
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
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
