import React, { Suspense } from "react";
import type { Metadata } from "next";
import { ExtraClient } from "./extra-client";
import { KidsExtraLoading } from "./kids-extra";
import { TeensExtraLoading } from "./teens-extra";
import styles from "./kids-extra.module.css";

export const metadata: Metadata = {
  title: "Contenido extra",
};

export default function ExtraPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className={styles.kidsFallback}>
            <KidsExtraLoading />
          </div>
          <div className={styles.teensFallback}>
            <TeensExtraLoading />
          </div>
        </>
      }
    >
      <ExtraClient />
    </Suspense>
  );
}
