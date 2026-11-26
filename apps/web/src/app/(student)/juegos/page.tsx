import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { JuegosClient } from './juegos-client';
import { GamesCampLoading } from './games-camp-loading';
import { TeensGamesLoading } from './teens-games-loading';
import styles from './games-camp.module.css';

export const metadata: Metadata = {
  title: 'Zona de Juegos',
};

export default function JuegosPage() {
  return (
    <Suspense
      fallback={
        <>
          <GamesCampLoading />
          <div className={styles.teensLoading}>
            <TeensGamesLoading />
          </div>
        </>
      }
    >
      <JuegosClient />
    </Suspense>
  );
}
