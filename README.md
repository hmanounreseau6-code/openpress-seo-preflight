# OpenPress SEO Preflight

A small, dependency-free command-line tool that audits WordPress article HTML before publication.

It helps writers, developers, and automation builders catch common on-page SEO problems before a draft goes live.

## What it checks

- `<title>` and meta-description presence and length
- canonical URL
- accidental `noindex`
- H1 and H2 structure
- focus keyword placement
- image alt text
- internal and external links
- Article, BlogPosting, Recipe, and BreadcrumbList JSON-LD
- approximate word count
- machine-readable JSON output for n8n, Make, CI, or custom scripts

## Requirements

- Node.js 18 or newer
- No npm dependencies

## Quick start

```bash
git clone https://github.com/hmanounreseau6-code/openpress-seo-preflight.git
cd openpress-seo-preflight
npm test
npm run check
```

Audit a public article:

```bash
node src/cli.js \
  --url "https://example.com/peach-cobbler/" \
  --keyword "peach cobbler"
```

Audit a local draft:

```bash
node src/cli.js \
  --file article.html \
  --base-url "https://example.com" \
  --keyword "peach cobbler"
```

Return JSON for an automation workflow:

```bash
node src/cli.js --file article.html --keyword "peach cobbler" --json
```

## Example output

```text
OpenPress SEO Preflight — Score: 88/100

[PASS] Exactly one H1 found.
[WARN] BreadcrumbList schema not detected.
[FAIL] The robots meta tag contains noindex.
```

The CLI exits with:

- `0` when there are no failed checks
- `1` when at least one check fails
- `2` for invalid arguments, network errors, or unreadable files

## Suggested n8n use

1. Obtain the final HTML from your article-generation workflow.
2. Save it to a temporary `.html` file or pass a published preview URL.
3. Run the CLI with the Execute Command node.
4. Add `--json`.
5. Route the workflow according to `score` and failed checks.
6. Keep WordPress publication in draft status until critical failures are resolved.

## Project scope

This tool is a preflight assistant, not a guarantee of search-engine rankings. Its checks are transparent and intentionally conservative. Contributions that improve HTML parsing, WordPress integration, reporting, documentation, and test coverage are welcome.

## Roadmap

- WordPress REST API authentication for private drafts
- Rank Math and Yoast metadata adapters
- direct n8n community-node integration
- Markdown and GitHub Actions reports
- configurable rules
- French and Arabic output
- accessibility checks

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Small, focused pull requests with tests are preferred.

## License

MIT
