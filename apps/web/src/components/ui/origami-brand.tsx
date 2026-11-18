import { clsx } from "clsx";
import React from "react";

interface OrigamiCraneProps {
  className?: string;
  unfold?: boolean;
}

/** La grulla es ornamental; el texto visible proporciona el nombre de la marca. */
export function OrigamiCrane({ className, unfold }: OrigamiCraneProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 64 64"
      className={clsx(
        "origami-crane",
        unfold && "origami-crane--unfold",
        className,
      )}
      stroke="var(--origami-on-honey)"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path
        className="origami-crane__wing"
        d="M33 38 27 9 43 31 40 45Z"
        fill="var(--origami-honey)"
      />
      <path
        d="M40 45 51 20 56 16 60 25 54 22 47 52Z"
        fill="var(--origami-honey)"
      />
      <path d="M47 52 40 45 54 22Z" fill="var(--origami-orange)" />
      <path d="M13 45 23 54 37 51 28 42Z" fill="var(--origami-orange)" />
      <path d="M4 36 24 37 40 45 47 52 29 49Z" fill="var(--origami-orange)" />
      <path
        className="origami-crane__wing origami-crane__wing--front"
        d="M33 38 9 12 20 40 40 45Z"
        fill="var(--origami-honey)"
      />
      <path d="M4 36 20 40 40 45 29 49Z" fill="var(--origami-honey)" />
    </svg>
  );
}

export function OrigamiBrand({ className }: { className?: string }) {
  return (
    <span className={clsx("origami-brand", className)}>
      <OrigamiCrane />
      <span className="origami-brand__wordmark">Upward English</span>
    </span>
  );
}
