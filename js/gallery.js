const COLUMNS = 6;

/** Prepare the file before the share tap, preserving iPad's user activation. */
export class Gallery {
  constructor(grid, shareButton, status) {
    this.grid = grid;
    this.shareButton = shareButton;
    this.status = status;
    this.version = 0;
    this.file = null;
    shareButton.addEventListener("click", () => this.share());
  }
  async render(entries) {
    const version = ++this.version;
    this.file = null;
    this.shareButton.disabled = true;
    this.grid.replaceChildren(
      ...entries.map((entry) => {
        const card = document.createElement("figure");
        card.className = "gallery-card";
        const image = document.createElement("img");
        image.src = entry.photo;
        image.alt = `Foto mit ${entry.score} Punkten`;
        image.loading = "lazy";
        const badge = document.createElement("figcaption");
        badge.textContent = entry.score;
        badge.setAttribute("aria-label", `${entry.score} Punkte`);
        card.append(image, badge);
        return card;
      }),
    );
    this.status.textContent = entries.length
      ? "Bild wird vorbereitet …"
      : "Noch keine Fotos.";
    if (!entries.length) return;
    try {
      const blob = await exportGrid(entries);
      if (version !== this.version) return;
      this.file = new File([blob], "PIRATEN.png", { type: "image/png" });
      this.shareButton.disabled = false;
      this.shareButton.textContent = navigator.canShare?.({
        files: [this.file],
      })
        ? "Bild teilen ↗"
        : "Bild herunterladen ↓";
      this.status.textContent = "";
    } catch {
      if (version === this.version)
        this.status.textContent =
          "Bild konnte nicht erstellt werden. Bitte öffne die Galerie erneut.";
    }
  }
  async share() {
    if (!this.file) return;
    const file = this.file;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "PIRATEN" });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (error) {
      if (error.name !== "AbortError")
        this.status.textContent =
          "Teilen fehlgeschlagen. Bitte erneut versuchen.";
    }
  }
}

export async function exportGrid(entries) {
  const tile = 224,
    gap = 16,
    padding = 32,
    header = 180;
  const rows = Math.ceil(entries.length / COLUMNS);
  const width = padding * 2 + COLUMNS * tile + (COLUMNS - 1) * gap;
  const height = header + rows * (tile + gap) - gap + padding;
  // Bound canvas dimensions and memory for long galleries on iPad, keeping every photo.
  const scale = Math.min(
    1,
    8192 / height,
    Math.sqrt(12000000 / (width * height)),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bildexport nicht verfügbar.");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#09090d";
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(
    width * 0.5,
    0,
    0,
    width * 0.5,
    0,
    width * 0.8,
  );
  glow.addColorStop(0, "#6f0b22");
  glow.addColorStop(1, "#09090d");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, header);
  ctx.fillStyle = "#ffffff";
  ctx.font = '900 96px "Avenir Next", "Trebuchet MS", sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText("PIRATEN", padding, header / 2 - 5);
  ctx.fillStyle = "#ff173f";
  ctx.fillRect(padding, header - 25, width - padding * 2, 4);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const image = new Image();
    image.src = entry.photo;
    await image.decode();
    const x = padding + (i % COLUMNS) * (tile + gap),
      y = header + Math.floor(i / COLUMNS) * (tile + gap);
    const crop = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(
      image,
      (image.naturalWidth - crop) / 2,
      (image.naturalHeight - crop) / 2,
      crop,
      crop,
      x,
      y,
      tile,
      tile,
    );
    ctx.strokeStyle = "#ffffff30";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, tile, tile);
    ctx.font = '900 37px "Avenir Next", "Trebuchet MS", sans-serif';
    const text = String(entry.score),
      badge = Math.max(62, ctx.measureText(text).width + 24);
    ctx.fillStyle = "#d20b32";
    ctx.fillRect(x, y, badge, 55);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x + 12, y + 28);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Bildexport fehlgeschlagen.")),
      "image/png",
    ),
  );
}
