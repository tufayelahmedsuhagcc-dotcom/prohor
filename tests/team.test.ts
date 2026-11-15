import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TeamSection } from "../src/components/TeamSection";
import { TEAM } from "../src/data/team";
import { ProjectVideo } from "../src/components/Presentation";

const team = () => renderToStaticMarkup(createElement(TeamSection));

describe("team section", () => {
  it("renders one card per member, with a name, a role and what they own", () => {
    // Compare against readable text: React escapes & as &amp; in the markup.
    const html = team().replace(/&amp;/g, "&");
    expect(html).toContain("Skorpe Monad");
    expect((html.match(/class="team-card"/g) ?? []).length).toBe(TEAM.length);
    for (const member of TEAM) {
      expect(html).toContain(member.name);
      expect(html).toContain(member.role);
      expect(html).toContain(member.owns);
      expect(html).toContain(member.initials);
    }
  });

  it("keeps the honesty line and does not invent portraits", () => {
    const html = team();
    expect(html).toContain("not job titles");
    expect(html).toContain("AI assistance");
    // No stock photos or avatars pretending to be the team: initials only.
    expect(html).not.toContain("<img");
    expect(html).toContain('aria-hidden="true"');
    // One heading per person, so a screen reader can step through the team.
    expect((html.match(/<h3>/g) ?? []).length).toBe(TEAM.length);
  });

  it("is a list, not a wall of paragraphs", () => {
    const html = team();
    expect(html).toContain('<ul class="team-grid">');
    expect(html).toContain("<li");
    expect(html).toContain('aria-label="The team"');
  });
});

describe("video player", () => {
  const video = (kind: "short" | "long") =>
    renderToStaticMarkup(createElement(ProjectVideo, { kind }));

  it("offers captions as a real track instead of claiming they are embedded", () => {
    const html = video("short");
    expect(html).toContain('kind="captions"');
    expect(html).toContain('src="/media/prohor-30-second.vtt"');
    expect(html).toContain('srcLang="en"');
    expect(html).not.toContain("captions are embedded");
  });

  it("shows a poster, does not autoplay, and links the file and transcript", () => {
    const html = video("long");
    expect(html).toContain('preload="none"');
    expect(html).not.toContain("autoplay");
    expect(html).toContain('poster="/media/prohor-long-poster.jpg"');
    expect(html).toContain('href="/media/prohor-four-minute.mp4"');
    expect(html).toContain('href="/media/prohor-four-minute-transcript.txt"');
    expect(html).toContain('href="/media/prohor-four-minute.srt"');
  });
});

describe("browser test scripts", () => {
  // presentation.py once shipped with an `await` in sync Playwright code: valid Python
  // syntax, so ast.parse passed, and it only failed when CI finally ran it. Compile them.
  it("all import cleanly", () => {
    let python = "";
    for (const bin of ["python3", "python"]) {
      try {
        execFileSync(bin, ["--version"], { stdio: "ignore" });
        python = bin;
        break;
      } catch {
        /* try the next name */
      }
    }
    if (!python) return; // no interpreter here; CI runs the scripts themselves
    const cache = mkdtempSync(join(tmpdir(), "prohor-pyc-"));
    const dir = new URL("../tests/", import.meta.url);
    const scripts = readdirSync(dir).filter((f) => f.endsWith(".py"));
    expect(scripts.length).toBeGreaterThan(5);
    for (const script of scripts) {
      execFileSync(
        python,
        ["-m", "py_compile", fileURLToPath(new URL(script, dir))],
        {
          stdio: "pipe",
          env: { ...process.env, PYTHONPYCACHEPREFIX: cache },
        },
      );
    }
    rmSync(cache, { recursive: true, force: true });
  });
});
