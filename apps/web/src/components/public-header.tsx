import Link from "next/link";
import React from "react";
import { AppearanceSelector } from "./appearance-selector";
import { OrigamiBrand } from "./ui/origami-brand";

export function PublicHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="origami-role-header origami-shell">
      <div className="origami-container origami-role-header__inner">
        <Link className="origami-brand-link" href="/">
          <OrigamiBrand />
        </Link>
        <div className="origami-header-actions">
          {children}
          <AppearanceSelector />
        </div>
      </div>
    </header>
  );
}
