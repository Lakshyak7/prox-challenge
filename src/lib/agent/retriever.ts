import { getFileIds } from "@/lib/cache/manual-index";
import { buildContextSnippet } from "@/lib/cache/knowledge-cache";
import { fileDocumentBlock } from "@/lib/anthropic";
import type { Classification } from "@/lib/types";

// Returns the document blocks and context snippets to inject for a given classification
export function retrieveContext(classification: Classification): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documentBlocks: any[];
  contextText: string;
} {
  const fileIds = getFileIds();
  const documentBlocks = [];

  // Always include owner manual for manual-routed questions
  if (classification.source === "manual" && fileIds.ownerManual) {
    documentBlocks.push(fileDocumentBlock(fileIds.ownerManual, "Vulcan OmniPro 220 Owner Manual"));
  }

  // Add selection chart for settings and duty-cycle questions
  if ((classification.intent === "settings" || classification.intent === "duty-cycle") && fileIds.selectionChart) {
    documentBlocks.push(fileDocumentBlock(fileIds.selectionChart, "Welding Selection Chart"));
  }

  // Add quick-start guide for setup questions
  if (classification.intent === "setup" && fileIds.quickStartGuide) {
    documentBlocks.push(fileDocumentBlock(fileIds.quickStartGuide, "Quick Start Guide"));
  }

  // Cache the last document block to enable prompt caching
  if (documentBlocks.length > 0) {
    documentBlocks[documentBlocks.length - 1] = {
      ...documentBlocks[documentBlocks.length - 1],
      cache_control: { type: "ephemeral" },
    };
  }

  const contextText = buildContextSnippet(classification.intent, classification.process);

  return { documentBlocks, contextText };
}
