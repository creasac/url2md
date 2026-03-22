import { parseHTML } from "linkedom";
import TurndownService from "../vendor/turndown.es.js";

import type { CaptureResult, ExtractedDocument } from "./types";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hasMeaningfulText(text: string): boolean {
  return /[A-Za-z0-9]/.test(text);
}

function normalizeMarkdown(markdown: string): string {
  return `${markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function absolutizeUrl(value: string, baseUrl: string): string {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function absolutizeSrcset(srcset: string, baseUrl: string): string {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const tokens = candidate.split(/\s+/);
      tokens[0] = absolutizeUrl(tokens[0], baseUrl);
      return tokens.join(" ");
    })
    .join(", ");
}

function absolutizeDocumentUrls(document: Document, baseUrl: string): void {
  for (const element of document.querySelectorAll("[href]")) {
    const href = element.getAttribute("href");
    if (href) {
      element.setAttribute("href", absolutizeUrl(href, baseUrl));
    }
  }

  for (const element of document.querySelectorAll("[src]")) {
    const src = element.getAttribute("src");
    if (src) {
      element.setAttribute("src", absolutizeUrl(src, baseUrl));
    }
  }

  for (const element of document.querySelectorAll("[srcset]")) {
    const srcset = element.getAttribute("srcset");
    if (srcset) {
      element.setAttribute("srcset", absolutizeSrcset(srcset, baseUrl));
    }
  }
}

function replaceWithNote(document: Document, element: Element, label: string, parts: string[]): void {
  const cleanedParts = Array.from(
    new Set(parts.map((part) => normalizeWhitespace(part)).filter(Boolean)),
  );

  if (!cleanedParts.length) {
    element.remove();
    return;
  }

  const note = document.createElement("p");
  note.textContent = `${label}: ${cleanedParts.join(" | ")}`;
  element.replaceWith(note);
}

function preserveSpecialContent(document: Document, baseUrl: string): void {
  for (const details of document.querySelectorAll("details")) {
    details.setAttribute("open", "open");
  }

  for (const noscript of document.querySelectorAll("noscript")) {
    const replacement = Array.from(noscript.childNodes);
    if (replacement.length) {
      noscript.replaceWith(...replacement);
      continue;
    }

    const text = normalizeWhitespace(noscript.textContent || "");
    if (text) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      noscript.replaceWith(paragraph);
      continue;
    }

    noscript.remove();
  }

  for (const element of document.querySelectorAll("svg")) {
    replaceWithNote(document, element, "Diagram text", [element.textContent || ""]);
  }

  for (const element of document.querySelectorAll("canvas")) {
    replaceWithNote(document, element, "Canvas content", [
      element.getAttribute("aria-label") || "",
      element.getAttribute("title") || "",
      element.textContent || "",
    ]);
  }

  for (const element of document.querySelectorAll("iframe")) {
    replaceWithNote(document, element, "Embedded content", [
      element.getAttribute("title") || "",
      element.getAttribute("src") ? absolutizeUrl(element.getAttribute("src") || "", baseUrl) : "",
      element.textContent || "",
    ]);
  }

  for (const element of document.querySelectorAll("video, audio")) {
    replaceWithNote(document, element, "Media", [
      element.getAttribute("title") || "",
      element.getAttribute("aria-label") || "",
      element.getAttribute("src") ? absolutizeUrl(element.getAttribute("src") || "", baseUrl) : "",
      element.getAttribute("poster") ? absolutizeUrl(element.getAttribute("poster") || "", baseUrl) : "",
    ]);
  }
}

function cleanHtml(inputHtml: string, baseUrl: string): string {
  const { document } = parseHTML(inputHtml);

  for (const element of document.querySelectorAll("script, style, template")) {
    element.remove();
  }

  absolutizeDocumentUrls(document, baseUrl);
  preserveSpecialContent(document, baseUrl);
  return document.documentElement?.outerHTML || inputHtml;
}

function extractTitle(inputHtml: string): string {
  const { document } = parseHTML(inputHtml);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogContent = ogTitle?.getAttribute("content");
  if (ogContent) {
    return normalizeWhitespace(ogContent);
  }

  const title = document.querySelector("title")?.textContent;
  if (title) {
    return normalizeWhitespace(title);
  }

  const h1 = document.querySelector("h1")?.textContent;
  if (h1) {
    return normalizeWhitespace(h1);
  }

  return "Untitled Page";
}

function createTurndownService(): TurndownService {
  return new TurndownService({
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    headingStyle: "atx",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
}

function htmlToMarkdown(inputHtml: string): string {
  const previousWindow = (globalThis as Record<string, unknown>).window;
  const previousDocument = (globalThis as Record<string, unknown>).document;
  const previousDOMParser = (globalThis as Record<string, unknown>).DOMParser;
  const { window, document } = parseHTML("<html><body></body></html>");

  (globalThis as Record<string, unknown>).window = window;
  (globalThis as Record<string, unknown>).document = document;
  (globalThis as Record<string, unknown>).DOMParser = window.DOMParser;

  try {
    const turndown = createTurndownService() as any;
    return `${turndown.turndown(inputHtml)}`.trim();
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = previousWindow;
    }

    if (previousDocument === undefined) {
      delete (globalThis as Record<string, unknown>).document;
    } else {
      (globalThis as Record<string, unknown>).document = previousDocument;
    }

    if (previousDOMParser === undefined) {
      delete (globalThis as Record<string, unknown>).DOMParser;
    } else {
      (globalThis as Record<string, unknown>).DOMParser = previousDOMParser;
    }
  }
}

export function extractDocument(capture: CaptureResult): ExtractedDocument {
  const cleanedHtml = cleanHtml(capture.html, capture.finalUrl);
  const title = extractTitle(cleanedHtml);
  const { document } = parseHTML(cleanedHtml);
  const root = document.body ?? document.documentElement;
  const markdown = normalizeMarkdown(htmlToMarkdown(root?.innerHTML || cleanedHtml));

  if (!hasMeaningfulText(markdown)) {
    throw new Error("Failed to extract any meaningful content from the page.");
  }

  return {
    title,
    markdown,
    finalUrl: capture.finalUrl,
    rendered: capture.rendered,
  };
}
