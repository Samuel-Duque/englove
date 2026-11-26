import React from 'react';

export interface UpwardCompassEmblemProps {
  size?: number;
  standalone?: boolean;
  className?: string;
}

/**
 * Emblema oficial «Brújula Ascendente Upward».
 * Por defecto renderiza el trazo de la brújula para usarse dentro de `.brand-emblem`;
 * con `standalone={true}` incluye el recuadro amarillo campamento redondeado.
 */
export function UpwardCompassEmblem({
  size = 28,
  standalone = false,
  className,
}: UpwardCompassEmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {standalone ? (
        <rect
          x="1.5"
          y="1.5"
          width="33"
          height="33"
          rx="9"
          fill="#FFCA3A"
          stroke="#4A2511"
          strokeWidth="2.5"
        />
      ) : null}
      <path
        d="M8 26L18 17L28 26L24.5 29.5L18 23.6L11.5 29.5Z"
        fill="#C6470B"
        stroke="#2B150A"
        strokeWidth={standalone ? '1.8' : '1.9'}
        strokeLinejoin="round"
      />
      <path
        d="M18 5.5L27.5 17.5H21.5V22.5L18 19.8L14.5 22.5V17.5H8.5Z"
        fill="#B9251D"
        stroke="#2B150A"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d={
          standalone
            ? 'M18 10.6L20.3 13.6L18 16.6L15.7 13.6Z'
            : 'M18 10.4L20.5 13.6L18 16.8L15.5 13.6Z'
        }
        fill="#FFFDF5"
      />
    </svg>
  );
}
