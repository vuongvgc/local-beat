export type Track = {
  id: string;
  title: string;
  artist: string;
  name: string;
  size: number;
  added: number;
  duration: number;
  blob: Blob;
};
export type Repeat = "off" | "all" | "one";
export function nextTrack(
  ids: string[],
  current: string | null,
  direction: 1 | -1,
  shuffle: boolean,
  repeat: Repeat,
  ended = false,
  random = Math.random,
): string | null {
  if (!ids.length) return null;
  if (ended && repeat === "one" && current && ids.includes(current))
    return current;
  const index = ids.indexOf(current ?? "");
  if (shuffle && ids.length > 1) {
    const choices = ids.filter((id) => id !== current);
    return choices[Math.floor(random() * choices.length)];
  }
  const next = index + direction;
  if (ended && repeat === "off" && next >= ids.length) return null;
  return ids[(next + ids.length) % ids.length];
}
export function fileIdentity(
  file: Pick<File, "name" | "size" | "lastModified">,
) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
export function fileLabels(name: string) {
  const stem = name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
  const split = stem.indexOf(" - ");
  return split > 0
    ? { artist: stem.slice(0, split), title: stem.slice(split + 3) }
    : { title: stem, artist: "Unknown artist" };
}
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
