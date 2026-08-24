import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  escapeHtmlAttr,
  escapeHtmlText,
  escapeJsonLd,
  escapeXml,
} from "../escape.ts";

describe("escapeXml", () => {
  test("encodes a bare ampersand", () => {
    // A name containing "&" made the SVG overlay malformed and the request
    // failed with a 500.
    assert.equal(escapeXml("Jean & Dupont"), "Jean &amp; Dupont");
  });

  test("prevents closing the text element", () => {
    assert.equal(escapeXml("a</text><b"), "a&lt;/text&gt;&lt;b");
  });

  test("encodes both quote characters", () => {
    assert.equal(escapeXml(`d"Arc d'Arc`), "d&quot;Arc d&apos;Arc");
  });

  test("leaves accented characters untouched", () => {
    assert.equal(escapeXml("Élisabeth Borne"), "Élisabeth Borne");
  });
});

describe("escapeHtmlText", () => {
  test("encodes markup delimiters", () => {
    assert.equal(escapeHtmlText("<img src=x>"), "&lt;img src=x&gt;");
  });

  test("encodes the ampersand first so entities are not doubled", () => {
    assert.equal(escapeHtmlText("&lt;"), "&amp;lt;");
  });
});

describe("escapeHtmlAttr", () => {
  test("encodes quotes so a value cannot escape its attribute", () => {
    assert.equal(
      escapeHtmlAttr(`" onerror="alert(1)`),
      "&quot; onerror=&quot;alert(1)",
    );
  });
});

describe("escapeJsonLd", () => {
  test("prevents closing the script element", () => {
    assert.equal(escapeJsonLd("x</script>y"), '"x\\u003c/script\\u003ey"');
  });

  test("encodes the ampersand", () => {
    assert.equal(escapeJsonLd("a&b"), '"a\\u0026b"');
  });

  test("encodes the unicode line terminators", () => {
    // Legal unescaped inside a JSON string, but a line break in JavaScript
    // source, so they would break the surrounding script element.
    assert.equal(escapeJsonLd("a\u2028b\u2029c"), '"a\\u2028b\\u2029c"');
  });

  test("output parses back to the original value", () => {
    const value = "Jean </script> & <Dupont>";
    assert.equal(JSON.parse(escapeJsonLd(value)), value);
  });
});
