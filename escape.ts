/**
 * Context-specific output encoders.
 *
 * Each function targets exactly one output context. Using one where another is
 * required leaves an injection open: HTML attribute encoding does not make a
 * value safe inside an SVG `<text>` node, and neither makes it safe inside a
 * JSON-LD script block.
 */

const HTML_TEXT_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const HTML_ATTR_ENTITIES: Record<string, string> = {
  ...HTML_TEXT_ENTITIES,
  '"': "&quot;",
  "'": "&#39;",
};

const XML_ENTITIES: Record<string, string> = {
  ...HTML_ATTR_ENTITIES,
  "'": "&apos;",
};

/** Encode a value interpolated into HTML character data. */
export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>]/g, (c) => HTML_TEXT_ENTITIES[c] ?? c);
}

/** Encode a value interpolated into a quoted HTML attribute. */
export function escapeHtmlAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ATTR_ENTITIES[c] ?? c);
}

/**
 * Encode a value interpolated into XML character data, such as the `<text>`
 * node of the SVG overlay rendered by sharp.
 *
 * An unencoded `&` is enough to make the document not well-formed, so names
 * containing one fail to render without this.
 */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ENTITIES[c] ?? c);
}

/**
 * Serialise a value for embedding in a `<script type="application/ld+json">`
 * block.
 *
 * `<`, `>` and `&` become unicode escapes so a value containing `</script>`
 * cannot terminate the element. U+2028 and U+2029 are escaped because they are
 * literal line terminators in JavaScript but legal unescaped inside a JSON
 * string.
 */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
