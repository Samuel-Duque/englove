import React from "react";
import { PublicHeader } from "../../components/public-header";
import { PublicFooter } from "../../components/origami-footer";
import styles from "./public-origami.module.css";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`origami-shell ${styles.layout}`}>
      <PublicHeader />
      <div className={styles.content}>{children}</div>
      <PublicFooter />
    </div>
  );
}
