import type { BrowserContext } from "@playwright/test";

export type OrigamiAudience = "public" | "kids" | "teens" | "teacher";

const period = {
  from: "2026-11-01T00:00:00.000Z",
  to: "2026-12-01T00:00:00.000Z",
};
const group = {
  id: "origami-group",
  name: "Grupo de prueba",
  activeStudentCount: 1,
};
const student = {
  id: "origami-student",
  name: "Estudiante de prueba",
  level: "A1",
  ageSegment: "kids",
  canSwitchInterface: true,
  approvalStatus: "approved",
  groupId: group.id,
};
const activity = {
  id: "origami-activity",
  title: "Birds in the garden",
  type: "fill_blank",
  level: "A1",
  status: "published",
};
const config = {
  type: "fill_blank",
  items: [
    {
      id: "origami-item",
      prompt: "The {{word}} is in the garden.",
      blanks: [{ id: "word" }],
    },
  ],
};
const assignment = {
  id: "origami-assignment",
  activity,
  group,
  opensAt: period.from,
  dueAt: period.to,
  availability: "open",
};
const runtime = {
  attempt: {
    id: "origami-attempt",
    assignmentId: assignment.id,
    attemptNumber: 1,
    previousAttemptId: null,
    status: "in_progress",
    startedAt: period.from,
    finishedAt: null,
    gradedAt: null,
    score: null,
    flags: [],
    effectiveDueAt: period.to,
    completeUntil: period.to,
  },
  activity: { ...activity, config },
  answers: {},
  mediaId: null,
  correction: null,
  attemptToken: "synthetic-attempt",
};
const empty = { items: [], total: 0 };

export async function mockOrigamiRoutes(
  context: BrowserContext,
  audience: OrigamiAudience,
) {
  const role = audience === "teacher" ? "teacher" : "student";
  const user = {
    role,
    id: role === "teacher" ? "origami-teacher" : student.id,
    name: role === "teacher" ? "Profesora de prueba" : student.name,
    email: "muestra@example.invalid",
  };
  const session = {
    user,
    student:
      role === "teacher" ? null : { ...student, ageSegment: audience, group },
    organizationId: "origami-organization",
  };

  if (audience !== "public") {
    const token = `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.synthetic`;
    await context.addCookies(
      ["upward_english_access_token", "upward_english_local_access_token"].map(
        (name) => ({ name, value: token, domain: "localhost", path: "/" }),
      ),
    );
  }

  const fixtures = new Map<string, unknown>([
    ["/auth/session", session],
    ["/auth/refresh", session],
    ["/me", session],
    ["/me/assignments", empty],
    ["/me/games", empty],
    ["/me/progress", {}],
    ["/feature-flags", { flags: { games: true, extra_content: true } }],
    ["/student/feedback", empty],
    ["/attempts/origami-attempt", runtime],
    ["/activities", { items: [activity], total: 1 }],
    ["/activities/origami-activity", { ...activity, config }],
    ["/assignments", { items: [assignment], total: 1 }],
    ["/assignments/origami-assignment", assignment],
    ["/groups", { items: [group], total: 1 }],
    ["/groups/origami-group", group],
    ["/groups/origami-group/members", empty],
    ["/students", { items: [student], total: 1 }],
    ["/students/origami-student", student],
    ["/students/origami-student/memberships", empty],
    ["/students/requests", empty],
    ["/students/locked", empty],
    ["/dashboard/reminders", {}],
    ["/reviews/queue", empty],
    ["/reviews/graded", empty],
    ["/resources", empty],
    ["/stats/leaderboard", {}],
    ["/stats/games/leaderboard", {}],
    [
      "/stats/overview",
      {
        period,
        organizationSummary: {
          totalApprovedStudents: 1,
          activeStudentsInPeriod: 0,
          averageScore: null,
          completionRatePercent: null,
          totalTimeSpentSeconds: 0,
          inactiveAlertsCount: 0,
        },
        byLevel: [],
        byGroup: [],
        inactiveAlerts: [],
      },
    ],
    [
      "/stats/students/origami-student",
      {
        student: { ...student, groupName: group.name },
        period,
        filters: { type: null, level: null },
        performance: {},
        consistency: {},
      },
    ],
  ]);

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.slice("/api/v1".length);
    if (audience === "public" || !["GET", "POST"].includes(request.method())) {
      await route.fulfill({ status: 401, json: { code: "AUTH_UNAUTHORIZED" } });
      return;
    }
    if (request.method() === "POST" && pathname !== "/auth/refresh") {
      throw new Error(
        `La matriz de lectura no esperaba una mutación: ${pathname}`,
      );
    }
    if (!fixtures.has(pathname)) {
      await route.fulfill({
        status: 404,
        json: { code: "NOT_FOUND", message: "No se encontró el recurso." },
      });
      return;
    }
    await route.fulfill({ json: fixtures.get(pathname) });
  });
}
