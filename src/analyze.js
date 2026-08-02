function decodeEntities(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value = "") {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? stripTags(match[1] ?? "") : "";
}

function allMatches(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => stripTags(match[1] ?? ""));
}

function attribute(tag, name) {
  const pattern = new RegExp(
    String.raw`\b${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))`,
    "i"
  );
  const match = tag.match(pattern);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function normalize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsKeyword(value, keyword) {
  const haystack = normalize(value);
  const needle = normalize(keyword);
  return Boolean(needle) && haystack.includes(needle);
}

function getMetaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const currentName = attribute(tag, "name").toLowerCase();
    const property = attribute(tag, "property").toLowerCase();
    if (currentName === name.toLowerCase() || property === name.toLowerCase()) {
      return attribute(tag, "content");
    }
  }
  return "";
}

function getCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = attribute(tag, "rel")
      .toLowerCase()
      .split(/\s+/);
    if (rel.includes("canonical")) return attribute(tag, "href");
  }
  return "";
}

function getJsonLdTypes(html) {
  const types = new Set();
  const pattern =
    /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    try {
      const data = JSON.parse(match[1].trim());
      const visit = (node) => {
        if (!node || typeof node !== "object") return;
        const rawType = node["@type"];
        if (Array.isArray(rawType)) rawType.forEach((type) => types.add(String(type)));
        else if (rawType) types.add(String(rawType));
        Object.values(node).forEach(visit);
      };
      visit(data);
    } catch {
      // Invalid JSON-LD is reported as an absent schema rather than crashing.
    }
  }
  return [...types];
}

function check(id, status, message, weight = 1) {
  return { id, status, message, weight };
}

function scoreChecks(checks) {
  const possible = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.reduce((sum, item) => {
    if (item.status === "pass") return sum + item.weight;
    if (item.status === "warn") return sum + item.weight * 0.5;
    return sum;
  }, 0);
  return Math.round((earned / possible) * 100);
}

export function analyzeHtml(html, options = {}) {
  if (typeof html !== "string" || !html.trim()) {
    throw new TypeError("HTML input must be a non-empty string.");
  }

  const keyword = String(options.keyword ?? "").trim();
  const sourceUrl = String(options.sourceUrl ?? options.baseUrl ?? "").trim();

  const title = firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = getMetaContent(html, "description");
  const robots = getMetaContent(html, "robots");
  const canonical = getCanonical(html);
  const h1s = allMatches(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi);
  const h2s = allMatches(html, /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi);
  const body = firstMatch(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i) || stripTags(html);
  const words = body.split(/\s+/).filter(Boolean);
  const intro = words.slice(0, 120).join(" ");

  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithoutAlt = imageTags.filter((tag) => !attribute(tag, "alt").trim());

  const anchorTags = html.match(/<a\b[^>]*>/gi) ?? [];
  const hrefs = anchorTags
    .map((tag) => attribute(tag, "href"))
    .filter((href) => href && !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"));

  let sourceHost = "";
  try {
    sourceHost = new URL(sourceUrl).host;
  } catch {
    sourceHost = "";
  }

  const internalLinks = [];
  const externalLinks = [];
  for (const href of hrefs) {
    if (href.startsWith("/")) {
      internalLinks.push(href);
      continue;
    }
    try {
      const host = new URL(href, sourceUrl || "https://example.invalid").host;
      if (sourceHost && host === sourceHost) internalLinks.push(href);
      else if (host !== "example.invalid") externalLinks.push(href);
    } catch {
      // Ignore malformed links.
    }
  }

  const schemaTypes = getJsonLdTypes(html);
  const schemaSet = new Set(schemaTypes.map((type) => type.toLowerCase()));
  const hasArticleSchema =
    schemaSet.has("article") ||
    schemaSet.has("blogposting") ||
    schemaSet.has("newsarticle");
  const hasRecipeSchema = schemaSet.has("recipe");
  const hasBreadcrumbSchema = schemaSet.has("breadcrumblist");

  const checks = [];

  checks.push(
    title
      ? check(
          "title-length",
          title.length >= 30 && title.length <= 60 ? "pass" : "warn",
          `Title length: ${title.length} characters (recommended: 30–60).`,
          2
        )
      : check("title-length", "fail", "Missing <title> tag.", 2)
  );

  checks.push(
    metaDescription
      ? check(
          "meta-description",
          metaDescription.length >= 120 && metaDescription.length <= 160 ? "pass" : "warn",
          `Meta description length: ${metaDescription.length} characters (recommended: 120–160).`,
          2
        )
      : check("meta-description", "fail", "Missing meta description.", 2)
  );

  checks.push(
    canonical
      ? check("canonical", "pass", `Canonical URL found: ${canonical}`, 1)
      : check("canonical", "warn", "No canonical URL found.", 1)
  );

  checks.push(
    /noindex/i.test(robots)
      ? check("indexability", "fail", "The robots meta tag contains noindex.", 3)
      : check("indexability", "pass", "No noindex directive detected.", 3)
  );

  checks.push(
    h1s.length === 1
      ? check("h1-count", "pass", "Exactly one H1 found.", 2)
      : check("h1-count", h1s.length === 0 ? "fail" : "warn", `H1 count: ${h1s.length}.`, 2)
  );

  checks.push(
    h2s.length > 0
      ? check("h2-presence", "pass", `${h2s.length} H2 heading(s) found.`, 1)
      : check("h2-presence", "warn", "No H2 headings found.", 1)
  );

  checks.push(
    imageTags.length === 0
      ? check("image-alt", "warn", "No images found.", 1)
      : imagesWithoutAlt.length === 0
        ? check("image-alt", "pass", `All ${imageTags.length} image(s) have alt text.`, 1)
        : check(
            "image-alt",
            "warn",
            `${imagesWithoutAlt.length} of ${imageTags.length} image(s) are missing alt text.`,
            1
          )
  );

  checks.push(
    internalLinks.length > 0
      ? check("internal-links", "pass", `${internalLinks.length} internal link(s) found.`, 1)
      : check("internal-links", "warn", "No internal links detected. Supply --url or --base-url for accurate classification.", 1)
  );

  checks.push(
    externalLinks.length > 0
      ? check("external-links", "pass", `${externalLinks.length} external link(s) found.`, 1)
      : check("external-links", "warn", "No external links detected.", 1)
  );

  checks.push(
    hasArticleSchema || hasRecipeSchema
      ? check("primary-schema", "pass", `Primary schema detected: ${schemaTypes.join(", ")}.`, 2)
      : check("primary-schema", "warn", "No Article, BlogPosting, or Recipe JSON-LD schema detected.", 2)
  );

  checks.push(
    hasBreadcrumbSchema
      ? check("breadcrumb-schema", "pass", "BreadcrumbList schema detected.", 1)
      : check("breadcrumb-schema", "warn", "BreadcrumbList schema not detected.", 1)
  );

  checks.push(
    words.length >= 600
      ? check("word-count", "pass", `Word count: ${words.length}.`, 1)
      : check("word-count", "warn", `Word count: ${words.length}; review whether the page is sufficiently complete.`, 1)
  );

  if (keyword) {
    checks.push(
      containsKeyword(title, keyword)
        ? check("keyword-title", "pass", "Focus keyword appears in the title.", 2)
        : check("keyword-title", "warn", "Focus keyword does not appear exactly in the title.", 2)
    );
    checks.push(
      h1s.some((heading) => containsKeyword(heading, keyword))
        ? check("keyword-h1", "pass", "Focus keyword appears in an H1.", 2)
        : check("keyword-h1", "warn", "Focus keyword does not appear exactly in an H1.", 2)
    );
    checks.push(
      h2s.some((heading) => containsKeyword(heading, keyword))
        ? check("keyword-h2", "pass", "Focus keyword appears in an H2.", 1)
        : check("keyword-h2", "warn", "Focus keyword does not appear exactly in an H2.", 1)
    );
    checks.push(
      containsKeyword(intro, keyword)
        ? check("keyword-intro", "pass", "Focus keyword appears within the first 120 words.", 2)
        : check("keyword-intro", "warn", "Focus keyword does not appear within the first 120 words.", 2)
    );
  }

  return {
    project: "OpenPress SEO Preflight",
    generatedAt: new Date().toISOString(),
    sourceUrl: sourceUrl || null,
    keyword: keyword || null,
    score: scoreChecks(checks),
    summary: {
      title,
      metaDescription,
      canonical,
      h1Count: h1s.length,
      h2Count: h2s.length,
      wordCount: words.length,
      imageCount: imageTags.length,
      imagesWithoutAlt: imagesWithoutAlt.length,
      internalLinkCount: internalLinks.length,
      externalLinkCount: externalLinks.length,
      schemaTypes
    },
    checks
  };
}
