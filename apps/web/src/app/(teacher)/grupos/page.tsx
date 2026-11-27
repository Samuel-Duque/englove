import { Suspense } from "react";
import type { Metadata } from "next";
import { GruposClient, GroupsLoading } from "./grupos-client";

export const metadata: Metadata = {
  title: "Grupos",
  description: "Directorio de grupos y alumnos vigentes.",
};

export default function GroupsPage() {
  return (
    <Suspense fallback={<GroupsLoading />}>
      <GruposClient />
    </Suspense>
  );
}
