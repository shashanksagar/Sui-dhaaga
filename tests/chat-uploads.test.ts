import { describe, expect, it } from "vitest";
import { contactError } from "../src/lib/privacy.ts";
import { imageMime } from "../src/server/uploads.ts";
import { png } from "./fixtures.ts";
describe("publication privacy and image verification", () => {
  it("blocks normalized phone, email, and social-handle variants without guessing names", () => {
    expect(contactError("Call +91 98765-43210")).not.toBeNull();
    expect(contactError("mail a@example.com")).not.toBeNull();
    expect(contactError("reach me @atelier_name")).not.toBeNull();
    expect(contactError("contact ＋９１ ９８７６５４３２１０")).not.toBeNull();
    expect(contactError("mail ａ＠ｅｘａｍｐｌｅ．ｃｏｍ")).not.toBeNull();
    expect(contactError("call ٠١٢٣٤٥٦٧٨٩")).not.toBeNull();
    expect(contactError("Amara Atelier in Jaipur")).toBeNull();
  });
  it("identifies image bytes from supported formats rather than trusting filenames", () => {
    expect(imageMime(png)).toBe("image/png");
    expect(() => imageMime(Buffer.from("<svg/>"))).toThrow();
  });
});
