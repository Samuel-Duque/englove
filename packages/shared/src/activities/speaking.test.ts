import { describe, expect, it } from "vitest";
import { SpeakingConfigSchema } from "./speaking";

describe("ERR-06: validación de duración de speaking", () => {
  it("explica en español el límite máximo de grabación", () => {
    const result = SpeakingConfigSchema.safeParse({
      prompt: "Hello",
      maxDurationSeconds: 500,
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toBe(
        "La grabación no puede durar más de 300 segundos",
      );
  });
});
