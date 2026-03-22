import type { FinalDocument } from "./types";

function normalizeMarkdown(markdown: string): string {
  return `${markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function urlsEquivalent(left: string, right: string): boolean {
  return left.replace(/\/+$/, "") === right.replace(/\/+$/, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimDuplicateTitleHeading(bodyMd: string, title: string): string {
  const lines = bodyMd.replace(/^\s+/, "").split("\n");
  if (!lines.length) {
    return bodyMd;
  }

  const headingPattern = new RegExp(`^#+\\s+${escapeRegex(title)}\\s*$`);
  if (headingPattern.test(lines[0].trim())) {
    const remainder = lines.slice(1).join("\n").replace(/^\s+/, "");
    return remainder || bodyMd;
  }

  return bodyMd;
}

export function makeOutputMarkdown(sourceUrl: string, document: FinalDocument): string {
  const bodyMd = trimDuplicateTitleHeading(document.bodyMd, document.title);
  const metadata = [`Source: ${sourceUrl}`];
  if (!urlsEquivalent(document.finalUrl, sourceUrl)) {
    metadata.push(`Resolved URL: ${document.finalUrl}`);
  }
  metadata.push(`Capture: ${document.captureLabel}`);

  return normalizeMarkdown(
    `# ${document.title}\n\n${metadata.join("\n")}\n\n---\n\n${bodyMd}`,
  );
}
