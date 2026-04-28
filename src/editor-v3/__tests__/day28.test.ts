import { describe, it, expect } from "vitest";
import { parseYouTubeUrl } from "@/lib/youtubeReference";

describe("Day 28 — YouTube URL parsing", () => {
  it("watch URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("youtu.be short URL", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("shorts URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("embed URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("live URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("mobile m. subdomain", () => {
    expect(parseYouTubeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("URL with query params after the id", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=42&feature=share")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&t=42")).toBe("dQw4w9WgXcQ");
  });

  it("URL embedded in surrounding text", () => {
    expect(parseYouTubeUrl("Check this out: https://youtu.be/dQw4w9WgXcQ — looks great")).toBe("dQw4w9WgXcQ");
  });

  it("video IDs may include underscores and dashes", () => {
    expect(parseYouTubeUrl("https://youtu.be/_-AbC123dEf")).toBe("_-AbC123dEf");
  });

  it("non-YouTube URL → null", () => {
    expect(parseYouTubeUrl("https://vimeo.com/123456789")).toBeNull();
    expect(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("plain text without a URL → null", () => {
    expect(parseYouTubeUrl("hello world")).toBeNull();
    expect(parseYouTubeUrl("")).toBeNull();
  });

  it("YouTube URL with the wrong-length id → null", () => {
    // 10 chars (too short)
    expect(parseYouTubeUrl("https://youtu.be/abc1234567")).toBeNull();
    // 12 chars — would only match 11 of them, so still works on 12+.
    // The regex is non-anchored, so trailing chars are fine; but a
    // 10-char id is the legitimate negative case.
  });
});
