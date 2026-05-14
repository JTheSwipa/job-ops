import { AppError } from "@infra/errors";
import type { DesignResumeJson } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultReactiveResumeDocument } from "../rxresume/document";

const modelSelection = vi.hoisted(() => ({
  resolveLlmRuntimeSettings: vi.fn(),
}));

const designResumeService = vi.hoisted(() => ({
  replaceCurrentDesignResumeDocument: vi.fn(),
}));

const requestContext = vi.hoisted(() => ({
  getRequestContext: vi.fn(() => ({ requestId: "req-ollama" })),
  getRequestId: vi.fn(() => "req-ollama"),
}));

vi.mock("@server/services/modelSelection", () => modelSelection);
vi.mock("./index", () => designResumeService);
vi.mock("@server/infra/request-context", () => requestContext);
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "Jane Doe\nSoftware Engineer" }),
}));

import JSZip from "jszip";
import pdfParse from "pdf-parse";
import { importDesignResumeFromFile } from "./import-file";

function ollamaResponse(json: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function makeDocxBase64(text: string): Promise<string> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</w:t></w:r></w:p></w:body></w:document>`,
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return buffer.toString("base64");
}

describe("importDesignResumeFromFile (ollama)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    modelSelection.resolveLlmRuntimeSettings.mockResolvedValue({
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://localhost:11434",
      apiKey: null,
    });
    designResumeService.replaceCurrentDesignResumeDocument.mockImplementation(
      async ({ resumeJson }: { resumeJson: DesignResumeJson }) => ({
        id: "primary",
        title: "Imported",
        resumeJson,
        revision: 1,
        sourceResumeId: null,
        sourceMode: null,
        importedAt: "2026-05-14T00:00:00.000Z",
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:00:00.000Z",
        assets: [],
      }),
    );
  });

  it("extracts DOCX text locally and sends it to Ollama via chat completions", async () => {
    vi.mocked(fetch).mockResolvedValue(
      ollamaResponse(buildDefaultReactiveResumeDocument()),
    );

    const docxBase64 = await makeDocxBase64("Jane Doe\nSoftware Engineer");
    await importDesignResumeFromFile({
      fileName: "resume.docx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      dataBase64: docxBase64,
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:11434/v1/chat/completions");
    expect(String(init?.body)).toContain('"model":"llama3"');
    expect(String(init?.body)).toContain('"stream":false');
    expect(String(init?.body)).toContain("DOCX");
    expect(
      designResumeService.replaceCurrentDesignResumeDocument,
    ).toHaveBeenCalledOnce();
  });

  it("extracts PDF text locally via pdf-parse and sends it to Ollama", async () => {
    vi.mocked(fetch).mockResolvedValue(
      ollamaResponse(buildDefaultReactiveResumeDocument()),
    );

    await importDesignResumeFromFile({
      fileName: "resume.pdf",
      mediaType: "application/pdf",
      dataBase64: Buffer.from("%PDF-1.4 fake").toString("base64"),
    });

    expect(vi.mocked(pdfParse)).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(init?.body)).toContain("Jane Doe");
    expect(String(init?.body)).toContain("PDF");
  });

  it("uses a custom baseUrl when configured", async () => {
    modelSelection.resolveLlmRuntimeSettings.mockResolvedValue({
      provider: "ollama",
      model: "mistral",
      baseUrl: "http://192.168.1.10:11434",
      apiKey: null,
    });
    vi.mocked(fetch).mockResolvedValue(
      ollamaResponse(buildDefaultReactiveResumeDocument()),
    );

    const docxBase64 = await makeDocxBase64("Some name");
    await importDesignResumeFromFile({
      fileName: "resume.docx",
      dataBase64: docxBase64,
    });

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe("http://192.168.1.10:11434/v1/chat/completions");
  });

  it("surfaces an upstream error when Ollama returns a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "model not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const docxBase64 = await makeDocxBase64("Jane Doe");
    await expect(
      importDesignResumeFromFile({
        fileName: "resume.docx",
        dataBase64: docxBase64,
      }),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("model not found"),
    });

    expect(
      designResumeService.replaceCurrentDesignResumeDocument,
    ).not.toHaveBeenCalled();
  });

  it("throws a 502 when Ollama returns a 5xx error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    const docxBase64 = await makeDocxBase64("Jane Doe");
    await expect(
      importDesignResumeFromFile({
        fileName: "resume.docx",
        dataBase64: docxBase64,
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      importDesignResumeFromFile({
        fileName: "resume.docx",
        dataBase64: docxBase64,
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
