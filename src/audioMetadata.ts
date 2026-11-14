// A short-lived, muted metadata probe; it never plays audio.
// Files are probed sequentially so imports cannot create an unbounded set of elements.
export function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      const duration = probe.duration;
      probe.onloadedmetadata = null;
      probe.onerror = null;
      probe.removeAttribute("src");
      probe.load();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(Number.isFinite(duration) ? duration : 0);
    };
    const timeout = setTimeout(
      () => finish(new Error("Metadata timed out")),
      5000,
    );
    probe.preload = "metadata";
    probe.muted = true;
    probe.onloadedmetadata = () => finish();
    probe.onerror = () => finish(new Error("Unsupported audio"));
    probe.src = url;
  });
}
