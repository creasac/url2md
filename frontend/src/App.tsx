import { FormEvent, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ExtractResponse = {
  markdown: string;
  title: string;
  sourceUrl: string;
  resolvedUrl: string;
  capture: string;
};

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="9" y="9" width="10" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 4v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m8 10 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m5 12 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function toDownloadFilename(value: string) {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

  return `${sanitized || "extracted"}.md`;
}

function App() {
  const [url, setUrl] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [title, setTitle] = useState("extracted");
  const [status, setStatus] = useState("Paste a URL and extract.");
  const [isExtracting, setIsExtracting] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const previewMarkdown = useMemo(
    () => markdown || "_No content yet._",
    [markdown],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setStatus("Enter a URL.");
      return;
    }

    setIsExtracting(true);
    setStatus("Extracting...");

    try {
      const response = await fetch(`${apiBase}/api/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const payload = (await response.json()) as ExtractResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Extraction failed.");
      }

      setMarkdown(payload.markdown);
      setTitle(payload.title || "extracted");
      setStatus(`${payload.title} | ${payload.capture}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      setStatus(message);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCopy() {
    if (!markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1200);
    } catch {
      setStatus("Copy failed.");
    }
  }

  function handleDownload() {
    if (!markdown) {
      return;
    }

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = toDownloadFilename(title);
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <main className="app-shell">
      <form className="toolbar" onSubmit={handleSubmit}>
        <input
          className="url-input"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button className="extract-button" type="submit" disabled={isExtracting}>
          {isExtracting ? "Extracting" : "Extract"}
        </button>
        <p className="status" role="status">
          {status}
        </p>
      </form>

      <section className="panes">
        <section className="pane">
          <header className="pane-header">
            <span>Raw MD</span>
            <button
              aria-label={copyLabel}
              className={`pane-action icon-button${copyLabel === "Copied" ? " is-success" : ""}`}
              title={copyLabel}
              type="button"
              onClick={handleCopy}
              disabled={!markdown}
            >
              {copyLabel === "Copied" ? <CheckIcon /> : <CopyIcon />}
            </button>
          </header>
          <textarea
            className="editor"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="pane">
          <header className="pane-header">
            <button
              aria-label="Download markdown"
              className="pane-action icon-button"
              title="Download markdown"
              type="button"
              onClick={handleDownload}
              disabled={!markdown}
            >
              <DownloadIcon />
            </button>
            <span>Rendered</span>
          </header>
          <div className="preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMarkdown}</ReactMarkdown>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
