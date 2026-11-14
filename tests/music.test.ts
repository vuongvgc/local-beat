import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextTrack,
  fileIdentity,
  fileLabels,
  formatTime,
} from "../src/music.ts";
const ids = ["a", "b", "c"];
test("manual navigation wraps and empty libraries stop", () => {
  assert.equal(nextTrack(ids, "c", 1, false, "off"), "a");
  assert.equal(nextTrack(ids, "a", -1, false, "off"), "c");
  assert.equal(nextTrack([], null, 1, true, "all"), null);
});
test("end of queue respects every repeat mode", () => {
  assert.equal(nextTrack(ids, "c", 1, false, "off", true), null);
  assert.equal(nextTrack(ids, "c", 1, false, "all", true), "a");
  assert.equal(nextTrack(ids, "b", 1, true, "one", true), "b");
  assert.equal(nextTrack(ids, "b", 1, false, "one"), "c");
});
test("shuffle chooses a different track; single-track queues stay valid", () => {
  assert.equal(
    nextTrack(ids, "b", 1, true, "off", false, () => 0),
    "a",
  );
  assert.equal(
    nextTrack(ids, "b", 1, true, "off", false, () => 0.99),
    "c",
  );
  assert.equal(nextTrack(["a"], "a", 1, true, "all", true), "a");
});
test("file labels, duplicate identity and invalid durations", () => {
  assert.deepEqual(fileLabels("Artist - Song.mp3"), {
    artist: "Artist",
    title: "Song",
  });
  assert.deepEqual(fileLabels("My_song.m4a"), {
    artist: "Unknown artist",
    title: "My song",
  });
  assert.equal(
    fileIdentity({ name: "a.mp3", size: 42, lastModified: 1 }),
    "a.mp3:42:1",
  );
  assert.equal(formatTime(Infinity), "0:00");
  assert.equal(formatTime(125), "2:05");
});
