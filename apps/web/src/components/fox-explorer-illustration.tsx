import React from 'react';

export function FoxExplorerIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" width="150" height="150" aria-hidden="true" fill="none">
      <circle cx="80" cy="79" r="67" fill="#FFF9EC" stroke="#C78E54" strokeWidth="2" strokeDasharray="4 6" />
      <path d="M56 133c8-16 16-21 28-21 16 0 25 9 30 24H53" fill="#C6470B" stroke="#4A2511" strokeWidth="3" strokeLinejoin="round" />
      <path d="M49 114c-10-5-20-11-27-16l12-9-4-56c0-4 4-6 7-3l31 25c8-2 16-2 24 0l31-25c3-3 7-1 7 3l-4 56 12 9c-9 8-18 13-28 18-19 9-40 9-61-2Z" fill="#D65413" stroke="#4A2511" strokeWidth="3" strokeLinejoin="round" />
      <path d="m39 43 22 18-19 13-3-31Zm82 0-22 18 19 13 3-31Z" fill="#FFD494" />
      <path d="M28 99c18-12 37-10 52 5 16-15 34-17 52-5-16 11-30 20-52 20S44 110 28 99Z" fill="#FFF2D6" />
      <path d="M53 85c3-4 8-4 11 0m32 0c3-4 8-4 11 0" stroke="#4A2511" strokeWidth="3" strokeLinecap="round" />
      <path d="M74 103c2-3 10-3 12 0 1 3-4 7-6 7s-7-4-6-7Z" fill="#2B150A" />
      <path d="M58 119c16 5 30 5 45 0l-9 12-12 14-12-12-12-14Z" fill="#FFCA3A" stroke="#4A2511" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="83" cy="129" r="4" fill="#B9251D" />
    </svg>
  );
}
