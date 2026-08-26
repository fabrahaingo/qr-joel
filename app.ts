import "dotenv/config";
import express from "express";
import path from "path";
import QRCode from "qrcode";
import sharp from "sharp";
import { fileURLToPath } from "url";
import {
  callJORFSearchOrganisationByWikidataId,
  callJORFSearchPeople,
  callJORFSearchTag,
  jorfCacheStats,
} from "./JORFSearch.utils.ts";
import { clientStats } from "./jorf/client.ts";
import { runWithContext } from "./requestContext.ts";
import { canonicaliseSlug, parseSlug, slugifyPersonName } from "./seo/slug.ts";
import { buildProfile } from "./seo/person.ts";
import { indexTier } from "./seo/tier.ts";
import { renderPersonPage } from "./seo/renderPerson.ts";
import { renderNotFound } from "./seo/renderNotFound.ts";
import { renderLetterPage, renderPeopleHub } from "./seo/renderIndex.ts";
import { renderOgImage } from "./seo/ogImage.ts";
import {
  chunkCount,
  chunkFor,
  getIndex,
  renderSitemapChunk,
  renderSitemapIndex,
} from "./seo/sitemap.ts";
import umami from "./umami.ts";
import fs from "fs/promises";
import { escapeHtmlText, escapeXml } from "./escape.ts";
import { functionTagLabel } from "./functionTags.ts";
import {
  isValidFunctionTag,
  isValidPersonName,
  isValidWikidataId,
  parseBooleanParam,
  parsePageParam,
} from "./validate.ts";

type FollowType = "people" | "function_tag" | "organisation";

const app = express();

const {
  TELEGRAM_BOT_NAME,
  WHATSAPP_BOT_PHONE_NUMBER,
  MATRIX_BOT_USERNAME,
  TCHAP_BOT_USERNAME,
} = process.env;

const isDev = process.env.NODE_ENV === "development";

const devPort = 8080;

const PORT = isDev ? devPort : 3000;

const HOME_WEBSITE_URL = "https://joel-officiel.fr";
const APP_URL = isDev
  ? `http://localhost:${String(PORT)}`
  : "https://links.joel-officiel.fr";

/**
 * Origin that serves the canonical person pages.
 *
 * Defaults to this host so the pages work before any CDN routing exists.
 * Point it at the marketing domain only once a rule there actually reaches
 * this origin, otherwise every canonical link and redirect lands on a 404.
 */
const PERSON_ORIGIN = process.env.PERSON_PAGE_ORIGIN ?? APP_URL;

/** Whether legacy `?name=` links should redirect to the person page. */
const REDIRECT_LEGACY_NAME = process.env.REDIRECT_LEGACY_NAME === "true";

function personUrl(slug: string): string {
  return `${PERSON_ORIGIN}/personne/${slug}`;
}

const PAGE_TITLE_DEFAULT = "JOEL - Journal Electronique";
const PAGE_TITLE_WITH_NAME = "Suivre {NAME} sur JOEL - Journal Electronique";

const whatsappLinkBase = WHATSAPP_BOT_PHONE_NUMBER
  ? `https://wa.me/${WHATSAPP_BOT_PHONE_NUMBER}?text=Bonjour JOEL!`
  : null;
const hasWhatsapp = WHATSAPP_BOT_PHONE_NUMBER != null;

const telegramLinkBase = TELEGRAM_BOT_NAME
  ? `https://t.me/${TELEGRAM_BOT_NAME}?text=Bonjour JOEL!`
  : null;
const hasTelegram = TELEGRAM_BOT_NAME != null;

const matrixLinkBase = MATRIX_BOT_USERNAME
  ? `https://matrix.to/#/@${MATRIX_BOT_USERNAME}`
  : null;
const hasMatrix = MATRIX_BOT_USERNAME != null;

const tchapLinkBase = TCHAP_BOT_USERNAME
  ? `https://www.tchap.gouv.fr/#/user/@${TCHAP_BOT_USERNAME}`
  : null;
const hasTchap = TCHAP_BOT_USERNAME != null;

const signalLinkBase = null;
const hasSignal = false;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!hasTelegram && !hasWhatsapp && !hasMatrix && !hasTchap && !hasSignal) {
  throw new Error(
    "Missing messenger configuration. Set TELEGRAM_BOT_NAME, WHATSAPP_PHONE_NUMBER, MATRIX_BOT_USERNAME or TCHAP_BOT_USERNAME environment variables.",
  );
}

if (
  process.env.NODE_ENV !== "development" &&
  (process.env.UMAMI_HOST === undefined || process.env.UMAMI_ID === undefined)
) {
  throw new Error("UMAMI env not set");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_PAGE_CONTENT = await fs.readFile(
  path.join(__dirname, "main.html"),
  "utf8",
);

const WHATSAPP_BLOCK = `<div class="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <a
                    id="wa-link"
                    class="app"
                    href="{WHATSAPP_LINK}"
                    aria-label="WhatsApp"
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                      alt=""
                      class="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  </a>
                </div>`;

const TELEGRAM_BLOCK = `<div class="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <a
                    id="tg-link"
                    class="app"
                    href="{TELEGRAM_LINK}"
                    aria-label="Telegram"
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg"
                      alt=""
                      class="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  </a>
                </div>`;

const MATRIX_BLOCK = ` <div class="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <a
                    id="mx-link"
                    class="app"
                    href="{MATRIX_LINK}"
                    aria-label="Matrix"
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/1/13/Element_%28software%29_logo_%282024%29.svg"
                      alt=""
                      class="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  </a>
                </div>`;

const TCHAP_BLOCK = `<div class="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <a
                    id="tc-link"
                    class="app"
                    href="{TCHAP_LINK}"
                    aria-label="Tchap"
                  >
                    <img
                      src="https://www.tchap.gouv.fr/themes/tchap/img/logos/tchap-logo.svg"
                      alt=""
                      class="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  </a>
                </div>`;

const APP_URL_QR = APP_URL + "/qrcode";

const FRAME_PATH = path.join(__dirname, "frame.png");
const FONT_PATH = path.join(__dirname, "DejaVuSans-Bold.ttf");
const FONT_BASE64 = await fs.readFile(FONT_PATH, { encoding: "base64" });
const FONT_FAMILY = "JoelSans";

const FONTCONFIG_FILE_PATH = path.join(__dirname, "fontconfig.conf");
if (process.env.FONTCONFIG_FILE === undefined) {
  try {
    await fs.access(FONTCONFIG_FILE_PATH);
  } catch {
    const fontConfig = `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${path.dirname(
      FONT_PATH,
    )}</dir>\n</fontconfig>\n`;
    await fs.writeFile(FONTCONFIG_FILE_PATH, fontConfig, "utf8");
  }
  process.env.FONTCONFIG_FILE = FONTCONFIG_FILE_PATH;
}

/**
 * Crawlers would otherwise mirror their traffic one-for-one into analytics,
 * which costs money and drowns the human numbers.
 */
const BOT_USER_AGENT =
  /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headlesschrome|curl|wget|python-requests/i;

export function isBotRequest(userAgent: string | undefined): boolean {
  return userAgent !== undefined && BOT_USER_AGENT.test(userAgent);
}

app.use((req, _res, next) => {
  runWithContext({ isBot: isBotRequest(req.get("user-agent")) }, next);
});

app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: https://upload.wikimedia.org https://www.tchap.gouv.fr",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self' https://umami.hellofabien.fr https://umami.joel-officiel.fr",
      "connect-src 'self' https://umami.hellofabien.fr https://umami.joel-officiel.fr",
    ].join("; "),
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=()",
  );
  next();
});

app.disable("x-powered-by");

// Scoped mount for assets referenced by absolute path, which is what pages
// served under /personne/<slug> require.
app.use(
  "/_assets",
  express.static(path.join(__dirname, "assets"), {
    maxAge: "1y",
    immutable: true,
  }),
);

app.use(express.static(path.join(__dirname)));

/**
 * Rendered pages change only when JORFSearch does, so the CDN holds them and
 * the origin is not in the path of crawler traffic. `stale-if-error` keeps
 * pages served when the upstream is down.
 */
const PAGE_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=2592000";

const IMAGE_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/** Analytics tag, injected only when analytics is configured. */
const UMAMI_SCRIPT =
  process.env.UMAMI_HOST === undefined || process.env.UMAMI_ID === undefined
    ? ""
    : `<script defer src="https://${process.env.UMAMI_HOST}/script.js" data-website-id="${process.env.UMAMI_ID}"></script>`;

const DEFAULT_QRCODE_SIZE = 500;

const FONT_SIZE = 40;
const TEXT_COLOR = "#62676c"; // gris JOÉL

// API endpoint: /api/qrcode?url=https://example.com&size=500
app.get("/qrcode", async (req, res) => {
  try {
    // Output size
    let qr_code_size = parseInt(req.query.size as string);
    if (isNaN(qr_code_size)) qr_code_size = DEFAULT_QRCODE_SIZE;

    let frameEnabled = true;
    if (req.query.frame != undefined && req.query.frame === "false")
      frameEnabled = false;

    if (req.query.size != undefined && frameEnabled)
      return res
        .status(400)
        .json({ error: "Cannot use fixed size and frame at the same tile." });

    // Verify on JORFSearch before generation
    let verifyOnJORFSearch = true;
    if (req.query.verify != undefined)
      verifyOnJORFSearch = parseBooleanParam(req.query.verify, true);

    // Type of follow: name, function_tag, organisation
    let followType: FollowType | undefined;

    // name for people
    const name = (req.query.name ?? "") as string;
    if (name.length > 0) {
      if (!isValidPersonName(name))
        return res.status(400).json({
          error:
            "Name parameter must be composed two words minimum: firstname lastname.",
        });
      followType = "people";
    }

    // organisation
    const organisation_id = (req.query.organisation_id ?? "") as string;
    if (organisation_id.length > 0) {
      if (followType != undefined)
        return res.status(400).json({
          error:
            "Parameters people, function_tag and organisations are exclusive.",
        });
      if (!isValidWikidataId(organisation_id.toUpperCase()))
        return res
          .status(400)
          .json({ error: "Invalid organisation_id parameter." });
      followType = "organisation";
      verifyOnJORFSearch = true; // must verify to get the name from JORF
    }

    // function_tag
    const function_tag = (req.query.function_tag ?? "") as string;
    if (function_tag.length > 0) {
      if (followType != undefined)
        return res.status(400).json({
          error:
            "Parameters people, function_tag and organisations are exclusive.",
        });
      if (!isValidFunctionTag(function_tag))
        return res
          .status(400)
          .json({ error: "Invalid function_tag parameter." });
      followType = "function_tag";
    }

    let followLabel;
    let qr_url;
    switch (followType) {
      case "people": {
        let prenomNom = name;
        if (verifyOnJORFSearch) {
          const JORFResult = await callJORFSearchPeople(name);
          if (JORFResult.length === 0)
            return res.status(400).json({
              error: "No result found on JORFSearch for this person.",
            });
          prenomNom = `${JORFResult[0].prenom} ${JORFResult[0].nom}`;
        }
        qr_url = `${APP_URL}?name=${encodeURIComponent(prenomNom)}`;
        followLabel = prenomNom;
        break;
      }

      case "organisation": {
        if (!verifyOnJORFSearch && !organisation_id.startsWith("Q"))
          return res.status(400).json({
            error:
              "Verification is mandatory when fetching organisation with WikidataId.",
          });
        if (verifyOnJORFSearch) {
          const JORFResult =
            await callJORFSearchOrganisationByWikidataId(organisation_id);
          if (JORFResult.length === 0)
            return res.status(400).json({
              error: "No result found on JORFSearch for this organisation.",
            });
          if (JORFResult.length > 1)
            return res
              .status(400)
              .json({ error: "Too many results found on JORFSearch." });
          qr_url = `${APP_URL}?organisation_id=${encodeURIComponent(organisation_id)}`;
          followLabel = JORFResult[0].name;
        }
        break;
      }

      case "function_tag": {
        if (verifyOnJORFSearch) {
          const JORFResult = await callJORFSearchTag(function_tag);
          if (JORFResult.length === 0)
            return res
              .status(400)
              .json({ error: "No result found on JORFSearch." });
        }
        qr_url = `${APP_URL}?function_tag=${encodeURIComponent(function_tag)}`;
        followLabel = functionTagLabel(function_tag);
        break;
      }
    }
    if (!qr_url)
      return res.status(400).json({
        error: "qr_url not initialized",
      });

    const qrBuffer = await generateQrWithLogo(qr_url);

    res.set("Content-Type", "image/png");

    if (!frameEnabled) {
      res.set("Cache-Control", IMAGE_CACHE_CONTROL);
      res.send(qrBuffer);
      return;
    }

    /* 2) métadonnées du template ------------------------------------------ */
    const frame = sharp(FRAME_PATH);
    const { width: frameW, height: frameH } = await frame.metadata();

    /* 3) coordonnées du QR (centre bas) ----------------------------------- */
    const left = Math.round((frameW - qr_code_size) / 2);
    const top = Math.round(frameH * 0.45); // ~55 % de hauteur

    /* 4) overlay SVG pour le texte dynamique ------------------------------ */
    const textSvg = `
    <svg width="${String(frameW)}" height="${String(FONT_SIZE * 3)}"
         viewBox="0 0 ${String(frameW)} ${String(FONT_SIZE * 3)}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          @font-face {
            font-family: '${FONT_FAMILY}';
            src: url('data:font/ttf;base64,${FONT_BASE64}') format('truetype');
            font-weight: 700;
            font-style: normal;
          }

          .label {
            font-family: '${FONT_FAMILY}', sans-serif;
            font-weight: 700;
            font-size: ${String(FONT_SIZE)};
            fill: ${TEXT_COLOR};
          }
        </style>
      </defs>

      <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" class="label" ${
        followLabel ? "" : 'style="display: none;"'
      }>
        ${escapeXml(followLabel ?? "")}
      </text>
    </svg>`;
    const textBuffer = Buffer.from(textSvg);

    /* 5) composition finale ----------------------------------------------- */
    const outputBuffer = await frame
      .composite([
        { input: qrBuffer, left, top }, // QR
        { input: textBuffer, left: 0, top: Math.round(frameH * 0.35) }, // ligne texte
      ])
      .png()
      .toBuffer();

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", IMAGE_CACHE_CONTROL);
    res.send(outputBuffer);

    switch (followType) {
      case "people":
        umami.log({ event: "/qr-people" });
        break;
      case "organisation":
        umami.log({ event: "/qr-organisation" });
        break;
      case "function_tag":
        umami.log({ event: "/qr-tag" });
        break;
    }
  } catch (err) {
    console.error("QR API error:", err);
    res.removeHeader("Content-Type");
    res.status(500).json({ error: "QR code generation failed." });
  }
});

app.get("/", async (req, res) => {
  try {
    let content = INDEX_PAGE_CONTENT;

    let followType: FollowType | undefined;
    let followArg = null; // to be sent to the start command
    let followLabel = null;

    let qr_url: string | null = null;

    let verifyOnJORFSearch = true;
    if (req.query.verify != undefined)
      verifyOnJORFSearch = parseBooleanParam(req.query.verify, true);

    if (req.query.name != undefined) {
      followArg = req.query.name as string;
      if (!isValidPersonName(followArg))
        return res.status(400).json({
          error:
            "Name parameter must be composed two words minimum: firstname lastname.",
        });
      followType = "people";

      if (verifyOnJORFSearch) {
        const JORFResult = await callJORFSearchPeople(followArg);
        if (JORFResult.length === 0)
          return res.status(400).json({
            error: "No result found on JORFSearch for this person.",
          });
        followArg = `${JORFResult[0].prenom} ${JORFResult[0].nom}`;

        // Send the legacy query-string URL to the canonical person page.
        // Printed QR codes keep working: that page carries the QR and the
        // messenger buttons too.
        if (REDIRECT_LEGACY_NAME) {
          const slug = slugifyPersonName(
            JORFResult[0].prenom,
            JORFResult[0].nom,
          );
          res.redirect(301, personUrl(slug));
          return;
        }

        qr_url = APP_URL_QR + "?name=" + encodeURIComponent(followArg);
      }
      followLabel = followArg;
    }

    if (req.query.organisation_id != undefined) {
      followArg = (req.query.organisation_id as string).toUpperCase();
      if (followType != undefined)
        return res.status(400).json({
          error:
            "Parameters people, function_tag and organisations are exclusive.",
        });
      if (!isValidWikidataId(followArg))
        return res
          .status(400)
          .json({ error: "Invalid organisation_id parameter." });
      if (verifyOnJORFSearch) {
        const JORFResult =
          await callJORFSearchOrganisationByWikidataId(followArg);
        if (JORFResult.length === 0)
          return res.status(400).json({
            error: "No result found on JORFSearch for this organisation.",
          });
        if (JORFResult.length > 1)
          return res
            .status(400)
            .json({ error: "Too many results found on JORFSearch." });
        followArg = JORFResult[0].id;
        followLabel = JORFResult[0].name;
      }
      followType = "organisation";

      qr_url = APP_URL_QR + "?organisation_id=" + encodeURIComponent(followArg);
    }

    if (req.query.function_tag != undefined) {
      followArg = req.query.function_tag as string;
      if (followType != undefined)
        return res.status(400).json({
          error:
            "Parameters people, function_tag and organisations are exclusive.",
        });
      if (!isValidFunctionTag(followArg))
        return res
          .status(400)
          .json({ error: "Invalid function_tag parameter." });
      if (verifyOnJORFSearch) {
        const JORFResult = await callJORFSearchTag(followArg);
        if (JORFResult.length === 0)
          return res
            .status(400)
            .json({ error: "No result found on JORFSearch." });
      }
      followType = "function_tag";
      followLabel = functionTagLabel(followArg);
      qr_url = APP_URL_QR + "?function_tag=" + encodeURIComponent(followArg);
    }

    // Hide the QR code if already on mobile
    let isMobile = MOBILE_USER_AGENT.test(req.get("user-agent") ?? "");

    if (!qr_url) {
      if (isDev) {
        isMobile = true;
        followLabel = "Sample label";
      } else {
        res.redirect(encodeURI(HOME_WEBSITE_URL));
        return;
      }
    }

    if (!isMobile && qr_url)
      content = content.replace(
        "{QRCODE_BLOCK}",
        `
          <div
              class="max-w-md mx-auto mt-5 sm:flex sm:justify-center md:mt-8"
          >
          <img id="qrcode" class="qrcode" alt="QR code" src=${encodeURI(qr_url + "&frame=false")} />
              </div>`,
      );
    else content = content.replace("{QRCODE_BLOCK}", "");

    if (followLabel == null)
      return res.status(400).json({ error: "Follow label not found." });

    // Replacements use a function so a `$&`-style sequence in the value is
    // inserted literally instead of being expanded as a replacement pattern.
    const label = followLabel;
    content = content.replace("{FOLLOW_LABEL}", () => escapeHtmlText(label));

    content = content.replace("{BASE_URL}", () => APP_URL);

    const pageTitle = label
      ? PAGE_TITLE_WITH_NAME.replace("{NAME}", () => label)
      : PAGE_TITLE_DEFAULT;
    content = content.replace("{PAGE_TITLE}", () => escapeHtmlText(pageTitle));

    let startCommand = null;

    followArg ??= ""; // for the TypeScript check only
    switch (followType) {
      case "people":
        startCommand = "Rechercher " + followArg;
        umami.log({ event: "/link-people" });
        break;
      case "organisation":
        startCommand = "SuivreO " + followArg;
        umami.log({ event: "/link-organisation" });
        break;
      case "function_tag":
        startCommand = "SuivreF " + followArg;
        umami.log({ event: "/link-tag" });
        break;

      default:
        umami.log({ event: "/link-default" });
        res.redirect(encodeURI("https://" + HOME_WEBSITE_URL));
        return;
    }

    const smoothFlowCommand = startCommand.replace("Suivre", "Rechercher"); // flow is prettier with "Rechercher"

    content = content.replace(
      "{WHATSAPP_BLOCK}",
      hasWhatsapp ? WHATSAPP_BLOCK : "",
    );
    content = content.replace(
      "{TELEGRAM_BLOCK}",
      hasTelegram ? TELEGRAM_BLOCK : "",
    );
    content = content.replace("{MATRIX_BLOCK}", hasMatrix ? MATRIX_BLOCK : "");

    content = content.replace("{TCHAP_BLOCK}", hasTchap ? TCHAP_BLOCK : "");

    if (whatsappLinkBase) {
      const whatsappLink = encodeURI(
        `${whatsappLinkBase} ${smoothFlowCommand}`,
      );
      content = content.replace("{WHATSAPP_LINK}", whatsappLink);
    }

    if (telegramLinkBase) {
      const telegramLink = encodeURI(
        `${telegramLinkBase} ${smoothFlowCommand}`,
      );
      content = content.replace("{TELEGRAM_LINK}", telegramLink);
    }

    if (matrixLinkBase) {
      content = content.replace("{MATRIX_LINK}", matrixLinkBase);
    }

    if (tchapLinkBase) {
      content = content.replace("{TCHAP_LINK}", tchapLinkBase);
    }

    res.set("Cache-Control", PAGE_CACHE_CONTROL);
    res.type("html").send(content);
  } catch (err) {
    console.error("QR API error:", err);
    res.removeHeader("Cache-Control");
    res.status(500).json({ error: "Page generation failed." });
  }
});

app.get("/whatsapp", (req, res) => {
  umami.log({ event: "/link-whatsapp" });
  if (whatsappLinkBase == null) {
    console.log("Missing whatsappLinkBase");
    res.redirect(HOME_WEBSITE_URL);
    return;
  }
  res.redirect(encodeURI(whatsappLinkBase));
});

app.get("/matrix", (req, res) => {
  umami.log({ event: "/link-matrix" });
  if (matrixLinkBase == null) {
    console.log("Missing matrixLinkBase");
    res.redirect(HOME_WEBSITE_URL);
    return;
  }
  res.redirect(encodeURI(matrixLinkBase));
});

app.get("/tchap", (req, res) => {
  umami.log({ event: "/link-tchap" });
  if (tchapLinkBase == null) {
    console.log("Missing tchapLinkBase");
    res.redirect(HOME_WEBSITE_URL);
    return;
  }
  res.redirect(encodeURI(tchapLinkBase));
});

app.get("/telegram", (req, res) => {
  umami.log({ event: "/link-telegram" });
  if (telegramLinkBase == null) {
    console.log("Missing telegramLinkBase");
    res.redirect(HOME_WEBSITE_URL);
    return;
  }
  res.redirect(encodeURI(telegramLinkBase));
});

app.get("/signal", (req, res) => {
  umami.log({ event: "/link-signal" });
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (signalLinkBase == null) {
    console.log("Missing signalLinkBase:");
    res.redirect(HOME_WEBSITE_URL);
    return;
  }
  res.redirect(encodeURI(signalLinkBase));
});

app.get("/status", (req, res) => {
  res.type("text/plain").send("JOEL QR server is running.");
});

app.get("/status/jorf", (req, res) => {
  res.json({ client: clientStats(), caches: jorfCacheStats() });
});

async function generateQrWithLogo(
  qr_url: string,
  {
    qrSize = 600,
    margin = 1,
    dark = "#000000",
    light = "#ffffff",
    logoPath = path.resolve(__dirname, "logo_round.png"),
    logoScale = 0.45, // slightly smaller without a white plate
  } = {},
) {
  // 1) QR buffer
  const qrBuffer = await QRCode.toBuffer(encodeURI(qr_url), {
    errorCorrectionLevel: "H",
    type: "png",
    width: qrSize,
    margin,
    color: { dark, light },
  });

  // 2) Transparent logo buffer at target size (keep alpha!)
  const targetLogoWidth = Math.floor(qrSize * logoScale);
  const logoBuf = await sharp(logoPath)
    .resize({ width: targetLogoWidth, fit: "inside" })
    .png() // preserve transparency
    .toBuffer();

  const logoMeta = await sharp(logoBuf).metadata();

  // 3) Center the logo directly onto the QR

  const left = Math.floor((qrSize - logoMeta.width) / 2);

  const top = Math.floor((qrSize - logoMeta.height) / 2);

  return await sharp(qrBuffer)
    .composite([{ input: logoBuf, left, top }]) // no background
    .png()
    .toBuffer();
}

/** Messenger buttons for a person, reusing the configured bot links. */
function buildFollowBlock(displayName: string): string {
  const command = `Rechercher ${displayName}`;
  let block = "";
  if (hasWhatsapp && whatsappLinkBase !== null) {
    block += WHATSAPP_BLOCK.replace("{WHATSAPP_LINK}", () =>
      encodeURI(`${whatsappLinkBase} ${command}`),
    );
  }
  if (hasTelegram && telegramLinkBase !== null) {
    block += TELEGRAM_BLOCK.replace("{TELEGRAM_LINK}", () =>
      encodeURI(`${telegramLinkBase} ${command}`),
    );
  }
  if (hasMatrix && matrixLinkBase !== null) {
    block += MATRIX_BLOCK.replace("{MATRIX_LINK}", () => matrixLinkBase);
  }
  if (hasTchap && tchapLinkBase !== null) {
    block += TCHAP_BLOCK.replace("{TCHAP_LINK}", () => tchapLinkBase);
  }
  return `<div class="person__apps">${block}</div>`;
}

app.get("/personne/:slug", async (req, res) => {
  try {
    const requested = req.params.slug;

    const canonical = canonicaliseSlug(requested);
    if (canonical !== null && canonical.length > 0) {
      res.redirect(301, `/personne/${canonical}`);
      return;
    }

    const { base } = parseSlug(requested);
    const name = base.split("-").join(" ");
    if (!isValidPersonName(name)) {
      res.status(404);
      res.set("X-Robots-Tag", "noindex");
      res.type("html").send(renderNotFound());
      return;
    }

    const records = await callJORFSearchPeople(name);
    const profile = buildProfile(records);

    if (profile === null) {
      // A real 404, never a redirect home: an empty page that answers 200 is
      // the classic soft 404 and search engines treat it as a quality signal.
      res.status(404);
      res.set("X-Robots-Tag", "noindex");
      res.type("html").send(renderNotFound(name));
      return;
    }

    const slug = slugifyPersonName(profile.prenom, profile.nom);
    if (slug !== requested) {
      res.redirect(301, `/personne/${slug}`);
      return;
    }

    const tier = indexTier(profile.records);
    const isMobile = MOBILE_USER_AGENT.test(req.get("user-agent") ?? "");

    const html = renderPersonPage({
      profile,
      canonicalUrl: personUrl(slug),
      tier,
      followBlock: buildFollowBlock(profile.displayName),
      qrImageUrl: isMobile
        ? undefined
        : `${APP_URL}/qrcode?name=${encodeURIComponent(profile.displayName)}&frame=false`,
      umamiScript: UMAMI_SCRIPT,
    });

    umami.log({ event: "/page-person" });
    res.set("Cache-Control", PAGE_CACHE_CONTROL);
    res.type("html").send(html);
  } catch (err) {
    console.error("Person page error:", err);
    res.removeHeader("Cache-Control");
    res.status(503).set("Retry-After", "3600").json({
      error: "Person page temporarily unavailable.",
    });
  }
});

const PEOPLE_PER_PAGE = 100;

app.get("/personnes", async (req, res) => {
  try {
    const { entries } = await getIndex();
    res.set("Cache-Control", PAGE_CACHE_CONTROL);
    res.type("html").send(renderPeopleHub(entries.length));
  } catch (err) {
    console.error("People hub error:", err);
    res.status(503).set("Retry-After", "3600").end();
  }
});

app.get("/personnes/:letter", async (req, res) => {
  try {
    const letter = req.params.letter.toLowerCase();
    if (!/^[a-z]$/.test(letter)) {
      res.status(404).set("X-Robots-Tag", "noindex");
      res.type("html").send(renderNotFound());
      return;
    }

    const { entries } = await getIndex();
    const matching = entries.filter((entry) => entry.slug.startsWith(letter));
    const pageCount = Math.max(1, Math.ceil(matching.length / PEOPLE_PER_PAGE));
    const page = parsePageParam(req.query.page, pageCount);
    const slice = matching.slice(
      (page - 1) * PEOPLE_PER_PAGE,
      page * PEOPLE_PER_PAGE,
    );

    res.set("Cache-Control", PAGE_CACHE_CONTROL);
    res.type("html").send(renderLetterPage(letter, slice, page, pageCount));
  } catch (err) {
    console.error("People letter error:", err);
    res.status(503).set("Retry-After", "3600").end();
  }
});

app.get("/personne/:slug/og.png", async (req, res) => {
  try {
    const { base } = parseSlug(req.params.slug);
    const name = base.split("-").join(" ");
    if (!isValidPersonName(name)) {
      res.status(404).end();
      return;
    }
    const profile = buildProfile(await callJORFSearchPeople(name));
    if (profile === null) {
      res.status(404).end();
      return;
    }
    const png = await renderOgImage(profile, FONT_FAMILY, FONT_BASE64);
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", IMAGE_CACHE_CONTROL);
    res.send(png);
  } catch (err) {
    console.error("OG image error:", err);
    res.removeHeader("Content-Type");
    res.status(500).json({ error: "OG image generation failed." });
  }
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const { entries } = await getIndex();
    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600, s-maxage=86400")
      .send(renderSitemapIndex(PERSON_ORIGIN, chunkCount(entries)));
  } catch (err) {
    console.error("Sitemap index error:", err);
    res.status(503).set("Retry-After", "3600").end();
  }
});

app.get("/sitemap-personnes-:n.xml", async (req, res) => {
  try {
    const n = Number.parseInt(req.params.n, 10);
    const { entries } = await getIndex();
    if (!Number.isInteger(n) || n < 1 || n > chunkCount(entries)) {
      res.status(404).end();
      return;
    }
    res
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600, s-maxage=86400")
      .send(renderSitemapChunk(PERSON_ORIGIN, chunkFor(entries, n)));
  } catch (err) {
    console.error("Sitemap chunk error:", err);
    res.status(503).set("Retry-After", "3600").end();
  }
});

app.get("/robots.txt", (req, res) => {
  res
    .type("text/plain")
    .send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /qrcode",
        "Disallow: /status",
        "",
        `Sitemap: ${PERSON_ORIGIN}/sitemap.xml`,
        "",
      ].join("\n"),
    );
});

export { app, APP_URL, PORT };
