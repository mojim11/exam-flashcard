import { unzipSync } from "fflate";
import { parseCards } from "@/lib/parser";

export type DocumentFileKind = "pdf" | "pptx" | "ppt";

export interface ExtractedDocument {
  kind: "pdf" | "pptx";
  text: string;
  pageCount: number;
  structured: boolean;
  warning?: string;
}

export function getDocumentFileKind(
  fileName: string,
): DocumentFileKind | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "pptx") return "pptx";
  if (extension === "ppt") return "ppt";
  return null;
}

function cleanParagraphs(paragraphs: readonly string[]): string[] {
  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

interface PdfFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function reconstructPdfPage(items: readonly unknown[]): string {
  const fragments: PdfFragment[] = [];

  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as {
      str?: unknown;
      transform?: unknown;
      width?: unknown;
      height?: unknown;
    };

    if (typeof record.str !== "string" || !record.str.trim()) continue;
    if (!Array.isArray(record.transform) || record.transform.length < 6) {
      continue;
    }

    fragments.push({
      text: record.str,
      x: Number(record.transform[4]) || 0,
      y: Number(record.transform[5]) || 0,
      width: Number(record.width) || 0,
      height: Number(record.height) || 10,
    });
  }

  const lines: Array<{ y: number; fragments: PdfFragment[] }> = [];

  for (const fragment of fragments) {
    const tolerance = Math.max(2, fragment.height * 0.35);
    const line = lines.find(
      (candidate) => Math.abs(candidate.y - fragment.y) <= tolerance,
    );

    if (line) {
      line.fragments.push(fragment);
    } else {
      lines.push({ y: fragment.y, fragments: [fragment] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const sorted = [...line.fragments].sort((a, b) => a.x - b.x);
      let text = "";
      let previousEnd: number | null = null;

      for (const fragment of sorted) {
        if (
          previousEnd !== null &&
          fragment.x - previousEnd > 2.5 &&
          !text.endsWith(" ")
        ) {
          text += " ";
        }
        text += fragment.text;
        previousEnd = fragment.x + fragment.width;
      }

      return text.trim();
    })
    .filter(Boolean)
    .join("\n");
}

async function extractPdf(file: File): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
  });

  let document: Awaited<typeof loadingTask.promise> | null = null;

  try {
    document = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        pageTexts.push(reconstructPdfPage(content.items as readonly unknown[]));
      } finally {
        page.cleanup();
      }
    }

    const pagesWithText = pageTexts.filter((text) => text.trim().length > 0);
    if (pagesWithText.length === 0) {
      throw new Error(
        "这个 PDF 没有可提取的文本层，可能是扫描件。请先 OCR，或改用文本/PPTX 导入。",
      );
    }

    const rawText = pageTexts
      .map((text, index) => (text.trim() ? `# 第 ${index + 1} 页\n${text}` : ""))
      .filter(Boolean)
      .join("\n\n");
    const structured = parseCards(rawText).cards.length > 0;

    return {
      kind: "pdf",
      text: rawText,
      pageCount: document.numPages,
      structured,
      warning: structured
        ? undefined
        : "未检测到现成的 Q/A 或列表格式，已保留全文供 AI 分析。请使用“AI 深度出题”，或在左侧手动整理。",
    };
  } catch (error) {
    if (error instanceof Error && /password|encrypted/i.test(error.message)) {
      throw new Error("这个 PDF 受密码保护，暂时无法读取。请先解除密码。");
    }
    throw error;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function slideParagraphs(xml: string): string[] {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");

  if (document.querySelector("parsererror")) {
    throw new Error("这个 PPTX 的幻灯片内容已损坏，无法解析。");
  }

  const paragraphs = [
    ...document.getElementsByTagNameNS("*", "p"),
  ].map((paragraph) =>
    [...paragraph.getElementsByTagNameNS("*", "t")]
      .map((text) => text.textContent ?? "")
      .join("")
      .trim(),
  );

  return cleanParagraphs(paragraphs);
}

async function extractPptx(file: File): Promise<ExtractedDocument> {
  let archive: Record<string, Uint8Array>;

  try {
    archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("无法解压这个 PPTX 文件，请确认文件没有损坏。");
  }

  const slideNames = Object.keys(archive)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const aNumber = Number(a.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
      const bNumber = Number(b.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
      return aNumber - bNumber;
    });

  if (slideNames.length === 0) {
    throw new Error("这个文件里没有找到幻灯片内容，请确认它是有效的 PPTX。");
  }

  const decoder = new TextDecoder("utf-8");
  const slides = slideNames.map((name) =>
    slideParagraphs(decoder.decode(archive[name])),
  );
  const slidesWithText = slides.filter((paragraphs) => paragraphs.length > 0);

  if (slidesWithText.length === 0) {
    throw new Error("这个 PPTX 的幻灯片中没有可提取的文字。");
  }

  const rawText = slides
    .map((paragraphs, index) =>
      paragraphs.length
        ? `# 第 ${index + 1} 页\n${paragraphs.join("\n")}`
        : "",
    )
    .filter(Boolean)
    .join("\n\n");
  const structured = parseCards(rawText).cards.length > 0;

  return {
    kind: "pptx",
    text: rawText,
    pageCount: slideNames.length,
    structured,
    warning: structured
      ? undefined
      : "未检测到现成的 Q/A 或列表格式，已保留全文供 AI 分析。请使用“AI 深度出题”，或在左侧手动整理。",
  };
}

export async function extractDocument(
  file: File,
): Promise<ExtractedDocument> {
  const kind = getDocumentFileKind(file.name);

  if (kind === "pdf") return extractPdf(file);
  if (kind === "pptx") return extractPptx(file);
  if (kind === "ppt") {
    throw new Error(
      "旧版 .ppt 是二进制格式，浏览器端无法可靠解析。请在 PowerPoint 中另存为 .pptx 后再导入。",
    );
  }

  throw new Error("不支持的文档格式。");
}
