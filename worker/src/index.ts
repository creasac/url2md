import { captureUrl } from "./lib/capture";
import { extractDocument } from "./lib/extract";
import { mergeDocuments } from "./lib/merge";
import { makeOutputMarkdown } from "./lib/output";
import type { Env } from "./lib/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}

function isPrivateIpv4(hostname: string): boolean {
  return /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname);
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (["localhost", "0.0.0.0", "127.0.0.1", "::1"].includes(lower)) {
    return true;
  }

  if (lower.endsWith(".local") || lower.endsWith(".internal")) {
    return true;
  }

  if (isPrivateIpv4(lower)) {
    return true;
  }

  if (
    lower.startsWith("fc")
    || lower.startsWith("fd")
    || lower.startsWith("fe80:")
    || lower === "::"
  ) {
    return true;
  }

  return false;
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Enter a valid http/https URL.");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("That hostname is not allowed.");
  }
  return url;
}

async function handleExtract(request: Request, env: Env): Promise<Response> {
  let urlValue = "";

  try {
    const payload = (await request.json()) as { url?: string };
    urlValue = String(payload.url || "").trim();
    const url = validateUrl(urlValue);

    const isLocalDev = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname);
    const captures = await captureUrl(url.toString(), env, !isLocalDev);
    const documents = captures.map((capture) => extractDocument(capture));
    const finalDocument = mergeDocuments(documents);
    const markdown = makeOutputMarkdown(url.toString(), finalDocument);

    return jsonResponse({
      markdown,
      title: finalDocument.title,
      sourceUrl: url.toString(),
      resolvedUrl: finalDocument.finalUrl,
      capture: finalDocument.captureLabel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    return jsonResponse({ error: message, sourceUrl: urlValue }, message.includes("valid http/https") || message.includes("not allowed") ? 400 : 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("url2md-web worker", {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/extract") {
      return handleExtract(request, env);
    }

    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  },
};
