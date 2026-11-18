import { ActivityType } from "@upward-english/shared";

export const activityTypeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: "Rellenar huecos",
  [ActivityType.open_question]: "Pregunta abierta",
  [ActivityType.speaking]: "Expresión oral (Speaking)",
  [ActivityType.game]: "Microjuego",
  [ActivityType.exam]: "Examen",
};
