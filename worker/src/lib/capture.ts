import puppeteer from "@cloudflare/puppeteer";

import type { CaptureResult, Env } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/123.0 Safari/537.36";
const STATIC_TIMEOUT_MS = 30_000;
const RENDER_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchStatic(url: string): Promise<CaptureResult> {
  const response = await fetchWithTimeout(url, STATIC_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Static fetch failed with ${response.status}.`);
  }

  return {
    html: await response.text(),
    finalUrl: response.url,
    rendered: false,
  };
}

async function waitForNetwork(page: any): Promise<void> {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 3_000 });
  } catch {
    return;
  }
}

async function prepareRenderedPage(page: any): Promise<void> {
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("details:not([open])")) {
      element.setAttribute("open", "open");
    }
  });

  let lastHeight = 0;
  for (let index = 0; index < 8; index += 1) {
    const currentHeight = await page.evaluate(() => document.body?.scrollHeight ?? 0);
    if (currentHeight <= lastHeight) {
      break;
    }

    await page.evaluate(() => window.scrollTo(0, document.body?.scrollHeight ?? 0));
    await sleep(500);
    lastHeight = currentHeight;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
}

export async function fetchRendered(url: string, env: Env): Promise<CaptureResult> {
  return withTimeout(
    (async () => {
      const browser = await puppeteer.launch(env.BROWSER);

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 2200 });

        if (typeof page.setUserAgent === "function") {
          await page.setUserAgent(USER_AGENT);
        }

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: RENDER_TIMEOUT_MS,
        });
        await waitForNetwork(page);
        await prepareRenderedPage(page);

        return {
          html: await page.content(),
          finalUrl: page.url(),
          rendered: true,
        };
      } finally {
        await browser.close();
      }
    })(),
    10_000,
    "Rendered capture",
  );
}

export async function captureUrl(url: string, env: Env, allowRendered = true): Promise<CaptureResult[]> {
  const captures: CaptureResult[] = [];
  const errors: string[] = [];

  try {
    captures.push(await fetchStatic(url));
  } catch (error) {
    errors.push(`static: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (allowRendered) {
    try {
      captures.push(await fetchRendered(url, env));
    } catch (error) {
      errors.push(`rendered: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!captures.length) {
    throw new Error(`Failed to capture page. ${errors.join("; ")}`);
  }

  return captures;
}
