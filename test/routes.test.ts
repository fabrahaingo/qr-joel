import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.NODE_ENV = "development";
process.env.TELEGRAM_BOT_NAME ??= "joel_test_bot";
process.env.WHATSAPP_BOT_PHONE_NUMBER ??= "33000000000";

const { app } = await import("../app.ts");
const { isValidWikidataId } = await import("../validate.ts");

let server: Server;
let base: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});

describe("input validation", () => {
  const rejected: [string, string][] = [
    ["markup in a name", "/qrcode?name=%3Cimg%20src%3Dx%3E%20Dupont"],
    ["a name of one word", "/qrcode?name=Dupont"],
    ["an over-long name", `/qrcode?name=Jean%20${"a".repeat(300)}`],
    ["a malformed wikidata id", "/?organisation_id=Q1%3B%20DROP"],
    ["path traversal in a tag", "/?function_tag=..%2F..%2Fetc%2Fpasswd"],
    ["a tag with a query separator", "/?function_tag=ministre%3Fx%3D1"],
  ];

  for (const [label, path] of rejected) {
    test(`rejects ${label}`, async () => {
      const res = await fetch(base + path);
      assert.equal(res.status, 400);
    });
  }

  test("rejects combining several follow types", async () => {
    const res = await fetch(
      base + "/?name=Jean%20Dupont&function_tag=ministre",
    );
    assert.equal(res.status, 400);
  });

  test("does not echo the submitted value back", async () => {
    // A reflected value invites the response itself to be used as a delivery
    // vehicle for whatever was submitted.
    const marker = "ZZmarkerZZ";
    const res = await fetch(base + `/qrcode?name=%3C${marker}%3E%20Dupont`);
    const body = await res.text();
    assert.equal(res.status, 400);
    assert.ok(!body.includes(marker), `response echoed the input: ${body}`);
  });
});

describe("wikidata id normalisation", () => {
  test("accepts a lowercase id, which the route upper-cases", () => {
    // Asserted here rather than over HTTP so the suite makes no network call.
    assert.equal(isValidWikidataId("q643290".toUpperCase()), true);
    assert.equal(isValidWikidataId("q643290"), false);
  });
});

describe("security headers", () => {
  test("are set on every response", async () => {
    const res = await fetch(base + "/status");
    assert.match(
      res.headers.get("content-security-policy") ?? "",
      /frame-ancestors 'none'/,
    );
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

describe("function tag labels", () => {
  test("renders the French label rather than the raw tag", async () => {
    // The page previously had no label at all here and always returned 400.
    const res = await fetch(base + "/?function_tag=sous-prefet&verify=false");
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes("Sous-préfet"), "expected the French label");
  });
});

describe("status", () => {
  test("reports upstream counters", async () => {
    const res = await fetch(base + "/status/jorf");
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      client: { budgetRemaining: number };
      caches: Record<string, unknown>;
    };
    assert.ok(body.client.budgetRemaining > 0);
    assert.ok("people" in body.caches);
  });
});

describe("person pages", () => {
  test("an implausible slug is a real 404, not a redirect home", async () => {
    // A 200 on a URL with no content is a soft 404 and search engines record
    // it against the whole site.
    const res = await fetch(base + "/personne/x", { redirect: "manual" });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("x-robots-tag"), "noindex");
  });

  test("a non-canonical slug redirects permanently", async () => {
    const res = await fetch(base + "/personne/Jean-DUPONT", {
      redirect: "manual",
    });
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "/personne/jean-dupont");
  });

  test("robots.txt allows crawling and declares the sitemap", async () => {
    const body = await (await fetch(base + "/robots.txt")).text();
    assert.match(body, /^User-agent: \*/m);
    assert.match(body, /^Allow: \//m);
    assert.match(body, /^Sitemap: https?:\/\/.+\/sitemap\.xml$/m);
    // A blanket disallow would stop search engines ever seeing the redirects.
    assert.doesNotMatch(body, /^Disallow: \/$/m);
  });

  test("an unknown letter page is a 404", async () => {
    const res = await fetch(base + "/personnes/42");
    assert.equal(res.status, 404);
  });
});
