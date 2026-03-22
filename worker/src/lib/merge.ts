import type { ExtractedDocument, FinalDocument } from "./types";

class MarkdownBlock {
  markdown: string;
  key: string;

  constructor(markdown: string, key: string) {
    this.markdown = markdown;
    this.key = key;
  }
}

export function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;

  for (const rawLine of markdown.trim().split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.startsWith("```")) {
      inFence = !inFence;
      current.push(line);
      continue;
    }

    if (!inFence && !line.trim()) {
      if (current.length) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      continue;
    }

    current.push(line);
  }

  if (current.length) {
    blocks.push(current.join("\n").trim());
  }

  return blocks.filter((block) => block.trim());
}

function normalizeBlockKey(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/`{1,3}/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_~|-]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toBlock(markdown: string): MarkdownBlock {
  return new MarkdownBlock(markdown.trim(), normalizeBlockKey(markdown));
}

function buildBlocks(markdown: string): MarkdownBlock[] {
  return collapseConsecutiveDuplicates(splitMarkdownBlocks(markdown).map(toBlock));
}

function sequenceSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  const leftLength = left.length;
  const rightLength = right.length;
  if (!leftLength || !rightLength) {
    return 0;
  }

  const matrix: number[][] = Array.from({ length: leftLength + 1 }, () =>
    Array.from({ length: rightLength + 1 }, () => 0),
  );

  let longest = 0;
  for (let i = 1; i <= leftLength; i += 1) {
    for (let j = 1; j <= rightLength; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        longest = Math.max(longest, matrix[i][j]);
      }
    }
  }

  return (2 * longest) / (leftLength + rightLength);
}

function blockSimilarity(left: MarkdownBlock, right: MarkdownBlock): number {
  if (!left.key || !right.key) {
    return left.markdown.trim() === right.markdown.trim() ? 1 : 0;
  }

  if (left.key === right.key) {
    return 1;
  }

  const [shorter, longer] = [left.key, right.key].sort((a, b) => a.length - b.length);
  if (shorter.length >= 60 && longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  if (Math.min(left.key.length, right.key.length) >= 80) {
    return sequenceSimilarity(left.key, right.key);
  }

  return 0;
}

function blocksMatch(left: MarkdownBlock, right: MarkdownBlock): boolean {
  const score = blockSimilarity(left, right);
  if (score === 1) {
    return true;
  }

  const minLength = Math.min(left.key.length, right.key.length);
  if (minLength >= 60 && score >= 0.75) {
    return true;
  }
  if (minLength >= 80 && score >= 0.94) {
    return true;
  }

  return false;
}

function richnessScore(block: MarkdownBlock): [number, number, number, number] {
  return [
    block.key.length,
    block.markdown.length,
    (block.markdown.match(/http/g) || []).length,
    (block.markdown.match(/!\[/g) || []).length,
  ];
}

function chooseRicherBlock(left: MarkdownBlock, right: MarkdownBlock): MarkdownBlock {
  return richnessScore(left) >= richnessScore(right) ? left : right;
}

function findBestMatch(
  block: MarkdownBlock,
  candidates: MarkdownBlock[],
  usedCandidates?: Set<MarkdownBlock>,
): MarkdownBlock | null {
  let bestMatch: MarkdownBlock | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (usedCandidates?.has(candidate)) {
      continue;
    }

    const score = blockSimilarity(block, candidate);
    if (score > bestScore) {
      bestMatch = candidate;
      bestScore = score;
    }
  }

  if (bestMatch && blocksMatch(block, bestMatch)) {
    return bestMatch;
  }

  return null;
}

function shouldGloballyDedupe(block: MarkdownBlock): boolean {
  return block.key.length >= 40 || block.markdown.includes("http") || block.markdown.includes("![");
}

function collapseConsecutiveDuplicates(blocks: MarkdownBlock[]): MarkdownBlock[] {
  const collapsed: MarkdownBlock[] = [];

  for (const block of blocks) {
    if (collapsed.length && blocksMatch(block, collapsed[collapsed.length - 1])) {
      collapsed[collapsed.length - 1] = chooseRicherBlock(collapsed[collapsed.length - 1], block);
      continue;
    }

    collapsed.push(block);
  }

  return collapsed;
}

function dedupeMergedBlocks(blocks: MarkdownBlock[]): MarkdownBlock[] {
  const deduped: MarkdownBlock[] = [];

  for (const block of blocks) {
    if (!shouldGloballyDedupe(block)) {
      deduped.push(block);
      continue;
    }

    const match = findBestMatch(block, deduped);
    if (match && shouldGloballyDedupe(match)) {
      deduped[deduped.indexOf(match)] = chooseRicherBlock(match, block);
      continue;
    }

    deduped.push(block);
  }

  return deduped;
}

function mergeBlockLists(primaryBlocks: MarkdownBlock[], secondaryBlocks: MarkdownBlock[]): MarkdownBlock[] {
  const merged = [...primaryBlocks];
  const usedPrimaryBlocks = new Set<MarkdownBlock>();
  const matches = secondaryBlocks.map((block) => {
    const match = findBestMatch(block, primaryBlocks, usedPrimaryBlocks);
    if (match) {
      usedPrimaryBlocks.add(match);
    }
    return match;
  });

  const prefix: MarkdownBlock[] = [];
  let lastAnchorIndex: number | null = null;

  for (let index = 0; index < secondaryBlocks.length; index += 1) {
    const block = secondaryBlocks[index];
    const match = matches[index];

    if (match) {
      const currentIndex = merged.indexOf(match);
      merged[currentIndex] = chooseRicherBlock(merged[currentIndex], block);
      lastAnchorIndex = currentIndex;
      continue;
    }

    if (findBestMatch(block, merged)) {
      continue;
    }

    if (lastAnchorIndex === null) {
      prefix.push(block);
      continue;
    }

    const insertAt: number = lastAnchorIndex + 1;
    merged.splice(insertAt, 0, block);
    lastAnchorIndex = insertAt;
  }

  return dedupeMergedBlocks([...prefix, ...merged]);
}

function choosePrimaryDocument(documents: ExtractedDocument[]): ExtractedDocument {
  const renderedDocuments = documents.filter((document) => document.rendered);
  if (renderedDocuments.length) {
    return renderedDocuments.reduce((best, current) =>
      current.markdown.length > best.markdown.length ? current : best,
    );
  }

  return documents.reduce((best, current) =>
    current.markdown.length > best.markdown.length ? current : best,
  );
}

function chooseTitle(documents: ExtractedDocument[]): string {
  const titledDocuments = documents.filter((document) => document.title !== "Untitled Page");
  if (!titledDocuments.length) {
    return "Untitled Page";
  }

  return titledDocuments.reduce((best, current) =>
    current.title.length > best.title.length ? current : best,
  ).title;
}

function chooseFinalUrl(documents: ExtractedDocument[]): string {
  const renderedDocument = documents.find((document) => document.rendered);
  return renderedDocument?.finalUrl || documents[0].finalUrl;
}

function chooseCaptureLabel(documents: ExtractedDocument[]): string {
  const hasStatic = documents.some((document) => !document.rendered);
  const hasRendered = documents.some((document) => document.rendered);
  if (hasStatic && hasRendered) {
    return "static + rendered";
  }
  return hasRendered ? "rendered" : "static";
}

export function mergeDocuments(documents: ExtractedDocument[]): FinalDocument {
  const primary = choosePrimaryDocument(documents);
  let mergedBlocks = buildBlocks(primary.markdown);

  for (const document of documents) {
    if (document === primary) {
      continue;
    }

    mergedBlocks = mergeBlockLists(mergedBlocks, buildBlocks(document.markdown));
  }

  return {
    title: chooseTitle(documents),
    bodyMd: `${mergedBlocks.map((block) => block.markdown).join("\n\n").trim()}\n`,
    finalUrl: chooseFinalUrl(documents),
    captureLabel: chooseCaptureLabel(documents),
  };
}
