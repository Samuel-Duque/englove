import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesPath = new URL("../src/app/origami.css", import.meta.url);
const styles = (
  existsSync(stylesPath) ? readFileSync(stylesPath, "utf8") : ""
).replace(/(\[data-appearance=)(["'])dark\2\]/g, "$1dark]");
const darkRoot = ":root[data-appearance=dark]";

function declarations(selector: string) {
  const start = styles.indexOf(`${selector} {`);
  if (start < 0) return "";
  return styles.slice(start, styles.indexOf("}", start));
}

function token(block: string, name: string): string {
  return (
    new RegExp(`--origami-${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim() ?? ""
  );
}

function colorFor(block: string, name: string) {
  const root = declarations(":root");
  const value = token(block, name) || token(root, name);
  const alias = /^var\(--origami-(.+)\)$/.exec(value)?.[1];
  return (alias ? token(root, alias) : value).toUpperCase();
}

function luminance(color: string) {
  expect(color).toMatch(/^#[\dA-F]{6}$/);
  const channel = (index: number) => {
    const value = Number.parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(first: string, second: string) {
  const light = luminance(first);
  const dark = luminance(second);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

describe("RF-1: contrato estático de los tokens de Origami", () => {
  it("define una paleta semántica exacta y aplica el oscuro del sistema solo sin elección", () => {
    const light = declarations(":root");
    const dark = declarations(darkRoot);
    const systemDark = declarations(":root:not([data-appearance])");
    const palette = {
      canvas: ["#FFF1D6", "#241B16"],
      surface: ["#FFF8E8", "#35271F"],
      "surface-raised": ["#FFFFFF", "#483326"],
      "surface-soft": ["#FFE6B8", "#443126"],
      "text-primary": ["#48230F", "#FFF4DD"],
      "text-secondary": ["#75513D", "#D8BFA3"],
      "border-subtle": ["#E0B887", "#75563E"],
      "border-control": ["#A97544", "#AF8962"],
      primary: ["#B92C35", "#B92C35"],
      "on-primary": ["#FFF8E8", "#FFF8E8"],
      "primary-hover": ["#AB2931", "#AB2931"],
      "primary-pressed": ["#9B252D", "#9B252D"],
      "primary-outline": ["#B92C35", "#F36B6F"],
      honey: ["#FFD343", "#FFD343"],
      "on-honey": ["#48230F", "#48230F"],
      orange: ["#F88A17", "#F88A17"],
      "on-orange": ["#48230F", "#48230F"],
      "origami-red": ["#E5363C", "#E5363C"],
      "paper-blue": ["#238EA8", "#67C4DB"],
      focus: ["#2563EB", "#87BCFF"],
      "disabled-bg": ["#E8D6BC", "#513F32"],
      "disabled-text": ["#75513D", "#D8BFA3"],
      "success-bg": ["#E6F3DD", "#193629"],
      "success-text": ["#23613E", "#A9D990"],
      "error-bg": ["#FDE7E2", "#482323"],
      "error-text": ["#B92735", "#FFB0A6"],
      "warning-bg": ["#FFF0BC", "#44351A"],
      "warning-text": ["#7A4C00", "#FFD477"],
      "info-bg": ["#E4F4FB", "#203D48"],
      "info-text": ["#245D7A", "#A6DFF3"],
    };

    expect(styles).toMatch(
      /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-appearance\]\)/,
    );
    expect(token(light, "scheme")).toBe("light");
    expect(token(dark, "scheme")).toBe("dark");
    expect(token(systemDark, "scheme")).toBe("dark");

    for (const [name, [expectedLight, expectedDark]] of Object.entries(
      palette,
    )) {
      expect(colorFor(light, name), `claro: ${name}`).toBe(expectedLight);
      expect(colorFor(dark, name), `oscuro elegido: ${name}`).toBe(
        expectedDark,
      );
      expect(colorFor(systemDark, name), `oscuro del sistema: ${name}`).toBe(
        expectedDark,
      );
    }
  });

  it.each([":root", darkRoot])(
    "mantiene contraste en los pares de texto, estado, borde y foco de %s",
    (selector) => {
      const block = declarations(selector);
      const pairs: [string, string][] = [
        ["text-primary", "surface"],
        ["text-secondary", "canvas"],
        ["text-secondary", "surface"],
        ["text-secondary", "surface-raised"],
        ["text-secondary", "surface-soft"],
        ["on-primary", "primary"],
        ["on-primary", "primary-hover"],
        ["on-primary", "primary-pressed"],
        ["on-honey", "honey"],
        ["on-orange", "orange"],
        ["disabled-text", "disabled-bg"],
        ["success-text", "success-bg"],
        ["error-text", "error-bg"],
        ["warning-text", "warning-bg"],
        ["info-text", "info-bg"],
      ];
      for (const [foreground, background] of pairs) {
        expect(
          contrast(colorFor(block, foreground), colorFor(block, background)),
          `${foreground}/${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const background of [
        "canvas",
        "surface",
        "surface-raised",
        "surface-soft",
      ]) {
        for (const foreground of [
          "focus",
          "border-control",
          "primary-outline",
        ]) {
          expect(
            contrast(colorFor(block, foreground), colorFor(block, background)),
            `${foreground}/${background}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );
});
