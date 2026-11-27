import React, { Suspense } from "react";
import type { Metadata } from "next";
import {
  AlumnoDetailClient,
  StudentDetailSkeleton,
} from "./alumno-detail-client";

export const metadata: Metadata = {
  title: "Ficha del Alumno",
  description: "Detalle, historial académico y gestión del estudiante.",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;

  return (
    <Suspense fallback={<StudentDetailSkeleton />}>
      <AlumnoDetailClient id={unwrappedParams.id} />
    </Suspense>
  );
}
