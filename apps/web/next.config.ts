import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/recuperar',
        destination: '/recuperar-contrasena',
        permanent: false,
      },
      {
        source: '/contenidos',
        destination: '/actividades',
        permanent: false,
      },
      {
        source: '/contenidos/onboarding',
        destination: '/actividades/nueva',
        permanent: false,
      },
      {
        source: '/juegos/:activityId',
        destination: '/juegos',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
