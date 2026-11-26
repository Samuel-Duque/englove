'use client';

import React, { useId } from 'react';

export function FoxTeensIllustration({
  className,
  size = 144,
}: {
  className?: string;
  size?: number;
}) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const furId = `teens-fox-fur-${uid}`;
  const medallionBgId = `teens-medallion-bg-${uid}`;
  const clipId = `teens-fox-medallion-${uid}`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 144 144"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={furId} x1="72" y1="38" x2="72" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F2721B" />
          <stop offset="100%" stopColor="#C94B0B" />
        </linearGradient>
        <radialGradient id={medallionBgId} cx="72" cy="64" r="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#522B16" />
          <stop offset="100%" stopColor="#261209" />
        </radialGradient>
        <clipPath id={clipId}>
          <circle cx="72" cy="72" r="59" />
        </clipPath>
      </defs>
      <circle cx="72" cy="72" r="64" fill="#1F0F07" stroke="#FFCA3A" strokeWidth="2.5" />
      <circle cx="72" cy="72" r="59" fill={`url(#${medallionBgId})`} />

      <g clipPath={`url(#${clipId})`}>
        <path
          d="M32 134 C35 111, 50 102, 72 102 C94 102, 109 111, 112 134 Z"
          fill="#C6470B"
          stroke="#2B150A"
          strokeWidth="2.2"
        />
        <path
          d="M47 101 C56 108, 88 108, 97 101 L92 115 C84 121, 78 123, 72 125 C66 123, 60 121, 52 115 Z"
          fill="#FFCA3A"
          stroke="#2B150A"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M56 106 C64 111, 80 111, 88 106" stroke="#D99B08" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="72" cy="115" r="6.2" fill="#FFFDF5" stroke="#2B150A" strokeWidth="1.6" />
        <path d="M72 110.8 L75.4 115.6 H73.2 V118.4 H70.8 V115.6 H68.6 Z" fill="#B9251D" />
      </g>

      <path
        d="M43 63 C37 46, 37 31, 42 23 C49 25, 58 36, 63 48 Z"
        fill="#D4530C"
        stroke="#2B150A"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M101 63 C107 46, 107 31, 102 23 C95 25, 86 36, 81 48 Z"
        fill="#D4530C"
        stroke="#2B150A"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M42 23 C45 24.5, 49 28.5, 52.5 33.5 C47.5 33.5, 43 35.5, 39.8 38.5 C39 31.5, 40 26.2, 42 23 Z"
        fill="#7D2607"
        stroke="#2B150A"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M102 23 C99 24.5, 95 28.5, 91.5 33.5 C96.5 33.5, 101 35.5, 104.2 38.5 C105 31.5, 104 26.2, 102 23 Z"
        fill="#7D2607"
        stroke="#2B150A"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M46 56 C43.5 46, 44 38, 46.8 34.5 C51.5 37.5, 56 44, 58.8 50.5 Z" fill="#FFE2A8" />
      <path d="M98 56 C100.5 46, 100 38, 97.2 34.5 C92.5 37.5, 88 44, 85.2 50.5 Z" fill="#FFE2A8" />

      <path
        d="M72 42 C87 42, 99 49.5, 104 62 C107 69, 108.5 74, 105.5 77.5 C107.5 80.5, 104.5 85, 97.5 90 C89.5 97, 80 102.5, 72 104.5 C64 102.5, 54.5 97, 46.5 90 C39.5 85, 36.5 80.5, 38.5 77.5 C35.5 74, 37 69, 40 62 C45 49.5, 57 42, 72 42 Z"
        fill={`url(#${furId})`}
        stroke="#2B150A"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      <path
        d="M38.5 74 C46.5 72.5, 55.5 76, 61.5 82.2 C64.8 85.8, 68 88, 72 88 C76 88, 79.2 85.8, 82.5 82.2 C88.5 76, 97.5 72.5, 105.5 74 C107 78, 105 84.5, 97.5 90 C89.5 97, 80 102.5, 72 104.5 C64 102.5, 54.5 97, 46.5 90 C39 84.5, 37 78, 38.5 74 Z"
        fill="#FFFDF5"
      />
      <path
        d="M105.5 74 C107 78, 105 84.5, 97.5 90 C89.5 97, 80 102.5, 72 104.5 C64 102.5, 54.5 97, 46.5 90 C39 84.5, 37 78, 38.5 74"
        stroke="#2B150A"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path d="M49.5 59.5 Q56.5 56 62.5 59" stroke="#6E2405" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M94.5 59.5 Q87.5 56 81.5 59" stroke="#6E2405" strokeWidth="2.1" strokeLinecap="round" />

      <ellipse cx="56.5" cy="67.5" rx="5.2" ry="5.5" fill="#2B150A" />
      <ellipse cx="87.5" cy="67.5" rx="5.2" ry="5.5" fill="#2B150A" />
      <path d="M53.2 69.8 Q56.5 72 59.8 69.8" stroke="#E07B18" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M84.2 69.8 Q87.5 72 90.8 69.8" stroke="#E07B18" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="58.4" cy="65.6" r="1.7" fill="#FFFDF5" />
      <circle cx="89.4" cy="65.6" r="1.7" fill="#FFFDF5" />
      <circle cx="54.6" cy="69.1" r="0.8" fill="#FFFDF5" opacity="0.7" />
      <circle cx="85.6" cy="69.1" r="0.8" fill="#FFFDF5" opacity="0.7" />

      <path
        d="M66.8 85 C66.8 83.2, 77.2 83.2, 77.2 85 C77.2 87.6, 74.2 90.2, 72 90.2 C69.8 90.2, 66.8 87.6, 66.8 85 Z"
        fill="#2B150A"
      />
      <ellipse cx="70.8" cy="84.9" rx="1.8" ry="0.8" fill="#6E4432" />
      <path d="M72 90.2 V93.2" stroke="#2B150A" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M65.5 94 Q72 98.2 78.5 94" stroke="#2B150A" strokeWidth="2.1" strokeLinecap="round" />

      <circle cx="72" cy="72" r="59" stroke="rgba(255,202,58,0.28)" strokeWidth="1.2" />
    </svg>
  );
}
