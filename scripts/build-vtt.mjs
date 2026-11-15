import { readdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * WebVTT captions beside every .srt.
 *
 * The films ship with English subtitles as .srt, which browsers do not accept in
 * a <track>. Without a .vtt the player shows no captions at all, so the note that
 * called them "embedded" was simply wrong. This converts each .srt into a
 * .vtt — same cues, same timing — so the <track> element has something to load.
 *
 * Run with `npm run captions`; tests/performance.test.ts fails if a .vtt drifts
 * from its .srt.
 */
export function srtToVtt(srt) {
  const clean = srt
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  const cues = clean
    .split(/\n{2,}/)
    .map((block) =>
      block.replace(
        /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
        "$1.$2 --> $3.$4",
      ),
    )
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

export const mediaDir = new URL("../public/media/", import.meta.url);

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const files = (await readdir(mediaDir)).filter((f) => f.endsWith(".srt"));
  for (const file of files) {
    const srt = await readFile(new URL(file, mediaDir), "utf8");
    await writeFile(
      new URL(file.replace(/\.srt$/, ".vtt"), mediaDir),
      srtToVtt(srt),
    );
    console.log("captions:", file, "->", file.replace(/\.srt$/, ".vtt"));
  }
}
