import sharp from "sharp";
import { escapeXml } from "../escape.ts";
import type { PersonProfile } from "./person.ts";

/** Open Graph cards are read at a fixed aspect ratio by every consumer. */
const WIDTH = 1200;
const HEIGHT = 630;

const BACKGROUND = "#f8fafc";
const INK = "#0f172a";
const MUTED = "#475569";
const ACCENT = "#2563eb";

/** Longest line before the name is wrapped. */
const WRAP_AT = 22;

function wrap(text: string, at: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length > at && current !== "") {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines.slice(0, 3);
}

/**
 * Render the sharing card for a person.
 *
 * Deliberately not a portrait: the image is a generated banner, which is also
 * why the page does not claim it as the person's `image` in structured data.
 */
export async function renderOgImage(
  profile: PersonProfile,
  fontFamily: string,
  fontBase64: string,
): Promise<Buffer> {
  const nameLines = wrap(profile.displayName, WRAP_AT);
  const fontSize = nameLines.length > 2 ? 72 : 88;

  const count = profile.records.length;
  const subtitle = `${String(count)} publication${count > 1 ? "s" : ""} au Journal officiel`;
  const detail = profile.latestOrganisation ?? profile.latestGrade ?? "";

  const nameTspans = nameLines
    .map(
      (line, i) =>
        `<tspan x="80" dy="${i === 0 ? "0" : String(fontSize * 1.15)}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const svg = `<svg width="${String(WIDTH)}" height="${String(HEIGHT)}" viewBox="0 0 ${String(WIDTH)} ${String(HEIGHT)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: '${fontFamily}';
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
        font-weight: 700;
      }
      .n { font-family: '${fontFamily}', sans-serif; font-weight: 700; font-size: ${String(fontSize)}px; fill: ${INK}; }
      .s { font-family: '${fontFamily}', sans-serif; font-weight: 700; font-size: 34px; fill: ${MUTED}; }
      .d { font-family: '${fontFamily}', sans-serif; font-weight: 700; font-size: 26px; fill: ${MUTED}; }
      .b { font-family: '${fontFamily}', sans-serif; font-weight: 700; font-size: 30px; fill: ${ACCENT}; }
    </style>
  </defs>
  <rect width="${String(WIDTH)}" height="${String(HEIGHT)}" fill="${BACKGROUND}" />
  <rect x="0" y="0" width="16" height="${String(HEIGHT)}" fill="${ACCENT}" />
  <text x="80" y="120" class="b">JOEL — Journal Officiel Électronique</text>
  <text x="80" y="270" class="n">${nameTspans}</text>
  <text x="80" y="${String(HEIGHT - 150)}" class="s">${escapeXml(subtitle)}</text>
  <text x="80" y="${String(HEIGHT - 100)}" class="d">${escapeXml(detail.slice(0, 70))}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export { HEIGHT, WIDTH };
