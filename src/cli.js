#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { analyzeHtml } from "./analyze.js";

function usage() {
  console.log(`
OpenPress SEO Preflight

Usage:
  openpress-seo-preflight --url https://example.com/post --keyword "focus keyword"
  openpress-seo-preflight --file article.html --base-url https://example.com --keyword "focus keyword"
  openpress-seo-preflight --file article.html --json

Options:
  --url <url>          Fetch and audit a public page.
  --file <path>        Audit a local HTML file.
  --base-url <url>     Base URL used to classify internal links.
  --keyword <text>     Optional focus keyword.
  --json               Print the complete report as JSON.
  --help               Show this help.
`);
}

function parseArgs(argv) {
  const result = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") result.json = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--url" || arg === "--file" || arg === "--base-url" || arg === "--keyword") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}.`);
      }
      result[arg.slice(2).replace("-", "_")] = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return result;
}

function icon(status) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

async function loadHtml(args) {
  if (args.url && args.file) throw new Error("Use either --url or --file, not both.");
  if (!args.url && !args.file) throw new Error("Provide --url or --file.");

  if (args.file) {
    return {
      html: await readFile(args.file, "utf8"),
      sourceUrl: args.base_url || ""
    };
  }

  const response = await fetch(args.url, {
    headers: {
      "user-agent": "OpenPress-SEO-Preflight/0.1 (+https://github.com/hmanounreseau6-code/openpress-seo-preflight)"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }

  return {
    html: await response.text(),
    sourceUrl: response.url || args.url
  };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      usage();
      return;
    }

    const { html, sourceUrl } = await loadHtml(args);
    const report = analyzeHtml(html, {
      keyword: args.keyword,
      sourceUrl
    });

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`\nOpenPress SEO Preflight — Score: ${report.score}/100\n`);
    for (const item of report.checks) {
      console.log(`[${icon(item.status)}] ${item.message}`);
    }
    console.log("");
    process.exitCode = report.checks.some((item) => item.status === "fail") ? 1 : 0;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    usage();
    process.exitCode = 2;
  }
}

await main();
