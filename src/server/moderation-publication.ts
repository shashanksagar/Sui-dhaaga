import { contactError } from "../lib/privacy.ts";
import { AppError } from "./errors.ts";

type PublishableKind = "PROFILE" | "ORDER_SPECIFICATION" | "MESSAGE" | "ALTERATION" | "REVIEW" | "IMAGE";

export function assertImageReplacementKind(kind: PublishableKind, replacementUploadId?: string) {
  if (replacementUploadId && kind !== "IMAGE") throw new AppError("Replacement images can only be used for image reviews.", 400);
}

function extractStructuredField(value: string, field: "bio" | "designSpecifications") {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && field in parsed && typeof (parsed as Record<string, unknown>)[field] === "string") {
      return (parsed as Record<string, string>)[field];
    }
  } catch {
    return null;
  }
  return null;
}

export function publishedModerationText(
  kind: PublishableKind,
  originalText: string,
  submittedText: string,
  uploadId: string | null,
) {
  if (kind === "IMAGE") return "";
  const field = kind === "PROFILE" ? "bio" : kind === "ORDER_SPECIFICATION" ? "designSpecifications" : null;
  const structured = field ? extractStructuredField(submittedText, field) : null;
  const content = (structured ?? submittedText).trim();
  if (!content && !(kind === "MESSAGE" && uploadId)) {
    throw new AppError("Published text cannot be empty.");
  }
  if (contactError(content)) throw new AppError("Remove contact details before publishing.");
  return content;
}

export function resolvePortfolioIds(
  sourceIds: string[],
  approvedIds: ReadonlySet<string>,
  replacements: ReadonlyMap<string, string>,
) {
  return sourceIds.flatMap(id => {
    if (approvedIds.has(id)) return [id];
    const replacement = replacements.get(id);
    return replacement && approvedIds.has(replacement) ? [replacement] : [];
  });
}
