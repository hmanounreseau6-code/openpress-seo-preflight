import test from "node:test";
import assert from "node:assert/strict";
import { analyzeHtml } from "../src/analyze.js";

const html = `
<!doctype html>
<html>
<head>
  <title>Easy Peach Cobbler Recipe for Family Dessert</title>
  <meta name="description" content="Make an easy peach cobbler with juicy peaches, a golden topping, and simple pantry ingredients for a comforting family dessert everyone will enjoy.">
  <link rel="canonical" href="https://example.com/peach-cobbler/">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":["Recipe","Article"],"name":"Peach Cobbler"}
  </script>
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}
  </script>
</head>
<body>
  <h1>Easy Peach Cobbler Recipe</h1>
  <p>Peach cobbler is a simple dessert made with ripe fruit and a golden topping.</p>
  <h2>How to Make Peach Cobbler</h2>
  <p>${"Helpful cooking details ".repeat(90)}</p>
  <img src="cobbler.jpg" alt="Fresh peach cobbler">
  <a href="/desserts/">Desserts</a>
  <a href="https://www.usda.gov/">Food safety</a>
</body>
</html>
`;

test("returns a useful audit report", () => {
  const report = analyzeHtml(html, {
    keyword: "peach cobbler",
    sourceUrl: "https://example.com/peach-cobbler/"
  });

  assert.equal(report.summary.h1Count, 1);
  assert.equal(report.summary.internalLinkCount, 1);
  assert.equal(report.summary.externalLinkCount, 1);
  assert.ok(report.summary.schemaTypes.includes("Recipe"));
  assert.ok(report.score >= 80);
});

test("detects noindex", () => {
  const report = analyzeHtml(
    "<html><head><meta name='robots' content='noindex'></head><body><h1>Test</h1></body></html>"
  );
  const item = report.checks.find((entry) => entry.id === "indexability");
  assert.equal(item.status, "fail");
});

test("rejects empty input", () => {
  assert.throws(() => analyzeHtml(""), /non-empty/);
});
