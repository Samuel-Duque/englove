import { AssignmentAvailability } from "@upward-english/shared";

export const availabilityBadges: Record<
  AssignmentAvailability,
  { label: string; tone: string }
> = {
  [AssignmentAvailability.scheduled]: { label: "Programada", tone: "" },
  [AssignmentAvailability.open]: {
    label: "Abierta",
    tone: "origami-state--success",
  },
  [AssignmentAvailability.closed]: {
    label: "Cerrada",
    tone: "origami-state--warning",
  },
  [AssignmentAvailability.cancelled]: {
    label: "Cancelada",
    tone: "origami-state--error",
  },
};
