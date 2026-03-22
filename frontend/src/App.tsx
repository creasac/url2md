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

function App() {
  const [url, setUrl] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState("Paste a URL and extract.");
  const [isExtracting, setIsExtracting] = useState(false);

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
      setStatus(`${payload.title} | ${payload.capture}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      setStatus(message);
    } finally {
      setIsExtracting(false);
    }
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
      </form>

      <p className="status">{status}</p>

      <section className="panes">
        <section className="pane">
          <header className="pane-header">Raw MD</header>
          <textarea
            className="editor"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            spellCheck={false}
          />
        </section>

        <section className="pane">
          <header className="pane-header">Rendered</header>
          <div className="preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMarkdown}</ReactMarkdown>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
