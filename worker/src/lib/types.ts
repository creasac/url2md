export interface Env {
  BROWSER: any;
}

export interface CaptureResult {
  html: string;
  finalUrl: string;
  rendered: boolean;
}

export interface ExtractedDocument {
  title: string;
  markdown: string;
  finalUrl: string;
  rendered: boolean;
}

export interface FinalDocument {
  title: string;
  bodyMd: string;
  finalUrl: string;
  captureLabel: string;
}
