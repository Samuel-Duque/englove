import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import {
  ActivityType,
  ApprovalStatus,
  AttemptStatus,
  GameMechanic,
  Level,
  ProgressEventType,
  ScoreTrendComparison,
  ScoreTrendDirection,
  LevelStatsSummary,
  GroupStatsSummary,
  InactiveStudentAlert,
  StatsOverviewResponse,
  GroupStudentStatsRow,
  GroupStatsResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  StudentScorePoint,
  StudentTypeBreakdown,
  StudentGameMechanicBreakdown,
  StudentLevelBreakdown,
  StudentWeekCalendarItem,
  TimeBucketItem,
  StudentStatsResponse,
} from '@englove/shared';
import {
  StatsOverviewQueryDto,
  StatsGroupQueryDto,
  StatsLeaderboardQueryDto,
  StatsStudentQueryDto,
} from './dto/stats-query.dto';

@Injectable()
export class StatsService {
  private readonly defaultPassingScore = 3.0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
  ) {}

  /**
   * Parses and validates the date range. If from > to, throws 400 VALIDATION_ERROR.
   * Default window: last 30 days.
   */
  private parseDateRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Formato de fecha inválido',
      });
    }

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La fecha inicial (from) no puede ser posterior a la fecha final (to)',
      });
    }

    return { from, to };
  }

  /**
   * Helper to round to 1 decimal place.
   */
  private round1(val: number | null): number | null {
    if (val === null || isNaN(val)) return null;
    return Math.round(val * 10) / 10;
  }

  /**
   * Calculates trend comparison (current vs previous) with delta and direction.
   */
  private computeTrendComparison(
    currentAvg: number | null,
    previousAvg: number | null,
  ): ScoreTrendComparison {
    if (currentAvg === null || previousAvg === null) {
      return {
        currentAverageScore: currentAvg,
        previousAverageScore: previousAvg,
        delta: null,
        direction: 'none',
      };
    }

    const delta = this.round1(currentAvg - previousAvg);
    let direction: ScoreTrendDirection = 'stable';
    if (delta !== null) {
      if (delta >= 0.2) direction = 'up';
      else if (delta <= -0.2) direction = 'down';
      else direction = 'stable';
    }

    return {
      currentAverageScore: currentAvg,
      previousAverageScore: previousAvg,
      delta,
      direction,
    };
  }

  /**
   * Calculates effective attempt duration in seconds clipped to activity.expected_duration_seconds * 3 (RF-3).
   */
  private calculateEffectiveDuration(
    startedAt: Date,
    finishedAt: Date | null,
    expectedDurationSeconds: number,
  ): number {
    if (!finishedAt) return 0;
    const rawSeconds = Math.max(0, Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000));
    const maxAllowed = Math.max(60, expectedDurationSeconds) * 3;
    return Math.min(rawSeconds, maxAllowed);
  }

  /**
   * Formats a date into YYYY-MM-DD in America/Bogota timezone.
   */
  private formatBogotaDay(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  /**
   * Formats a date into YYYY-MM in America/Bogota timezone.
   */
  private formatBogotaMonth(date: Date): string {
    const str = this.formatBogotaDay(date);
    return str.substring(0, 7);
  }

  /**
   * Returns the Monday (start date, YYYY-MM-DD) of the ISO week containing the given date in America/Bogota timezone.
   */
  private getBogotaIsoWeekMonday(date: Date): string {
    const bogotaDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    const [yearStr, monthStr, dayStr] = bogotaDateStr.split('-');
    const bogotaDate = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));

    const day = bogotaDate.getUTCDay() || 7;
    bogotaDate.setUTCDate(bogotaDate.getUTCDate() - (day - 1));

    return bogotaDate.toISOString().substring(0, 10);
  }

  /**
   * ENG-101: GET /api/v1/stats/overview (RF-5)
   */
  async getOverview(
    organizationId: string,
    query: StatsOverviewQueryDto,
  ): Promise<StatsOverviewResponse> {
    const { from, to } = this.parseDateRange(query.from, query.to);

    // 1. Load organization's approved students
    const students = await this.prisma.student.findMany({
      where: {
        organization_id: organizationId,
        approval_status: ApprovalStatus.approved,
      },
      include: {
        user: true,
        memberships: {
          include: { group: true },
        },
      },
    });

    const totalApprovedStudents = students.length;

    // 2. Load graded attempts in period (Rendimiento)
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        status: AttemptStatus.graded,
        graded_at: { gte: from, lte: to },
        score: { not: null },
      },
      include: {
        assignment: {
          include: { activity: true },
        },
      },
      orderBy: { attempt_number: 'desc' },
    });

    // Rule of last graded attempt per (student, assignment)
    const latestGradedAttemptsMap = new Map<string, (typeof gradedAttempts)[0]>();
    for (const att of gradedAttempts) {
      const key = `${att.student_id}:${att.assignment_id}`;
      if (!latestGradedAttemptsMap.has(key)) {
        latestGradedAttemptsMap.set(key, att);
      }
    }
    const latestGradedAttempts = Array.from(latestGradedAttemptsMap.values());

    // 3. Load completed attempts and duration in period (Constancia)
    const finishedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        status: { in: [AttemptStatus.pending_review, AttemptStatus.graded] },
        finished_at: { gte: from, lte: to },
      },
      include: {
        assignment: {
          include: { activity: true },
        },
      },
    });

    // 4. Load progress events in period
    const progressEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
        occurred_at: { gte: from, lte: to },
      },
    });

    // Active students in period: had at least one progressEvent or finished attempt
    const activeStudentIds = new Set<string>();
    for (const ev of progressEvents) activeStudentIds.add(ev.student_id);
    for (const att of finishedAttempts) activeStudentIds.add(att.student_id);

    // 5. Total time spent
    let totalTimeSpentSeconds = 0;
    for (const att of finishedAttempts) {
      const expected = att.assignment?.activity?.expected_duration_seconds ?? 300;
      totalTimeSpentSeconds += this.calculateEffectiveDuration(att.started_at, att.finished_at, expected);
    }

    // 6. Overall average score
    const scores = latestGradedAttempts
      .map((a) => (a.score !== null ? Number(a.score) : null))
      .filter((s): s is number => s !== null);
    const averageScore =
      scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

    // 7. Universe of compliance (RF-2)
    // Non-cancelled assignments excluding games
    const assignments = await this.prisma.assignment.findMany({
      where: {
        organization_id: organizationId,
        cancelled_at: null,
        activity: { type: { not: ActivityType.game } },
        opens_at: { lte: to },
        due_at: { gte: from },
      },
      include: {
        group: {
          include: {
            memberships: {
              where: {
                student: { approval_status: ApprovalStatus.approved },
              },
            },
          },
        },
        attempts: {
          where: {
            status: { in: [AttemptStatus.pending_review, AttemptStatus.graded] },
          },
          select: { student_id: true },
        },
      },
    });

    const now = new Date();
    let totalAssignedObligations = 0;
    let totalCompletedObligations = 0;

    for (const asg of assignments) {
      // Obligated students: membership overlapped [opens_at, due_at]
      const obligatedMembers = asg.group.memberships.filter((m) => {
        const joinedOk = m.joined_at <= asg.due_at;
        const leftOk = m.left_at === null || m.left_at >= asg.opens_at;
        return joinedOk && leftOk;
      });

      const obligatedStudentIds = new Set(obligatedMembers.map((m) => m.student_id));

      // Frozen denominator if closed and historical_student_count is recorded
      const isClosed = asg.due_at < now;
      const denominator =
        isClosed && asg.historical_student_count !== null
          ? asg.historical_student_count
          : obligatedStudentIds.size;

      const submitters = new Set(
        asg.attempts.filter((att) => obligatedStudentIds.has(att.student_id)).map((att) => att.student_id),
      );

      totalAssignedObligations += denominator;
      totalCompletedObligations += submitters.size;
    }

    const completionRatePercent =
      totalAssignedObligations > 0
        ? this.round1((totalCompletedObligations / totalAssignedObligations) * 100)
        : null;

    // 8. Inactive Student Alerts (last 14 days, RF-5)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentActivityEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
        occurred_at: { gte: fourteenDaysAgo },
      },
      select: { student_id: true },
    });
    const studentsWithRecentActivity = new Set(recentActivityEvents.map((e) => e.student_id));

    // For inactive alerts, find the last activity event ever for each student
    const allStudentActivityEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
      },
      select: { student_id: true, occurred_at: true },
      orderBy: { occurred_at: 'desc' },
    });

    const lastActivityMap = new Map<string, Date>();
    for (const ev of allStudentActivityEvents) {
      if (!lastActivityMap.has(ev.student_id)) {
        lastActivityMap.set(ev.student_id, ev.occurred_at);
      }
    }

    const inactiveAlerts: InactiveStudentAlert[] = [];
    for (const student of students) {
      if (!studentsWithRecentActivity.has(student.id)) {
        const lastAt = lastActivityMap.get(student.id) ?? null;
        const daysSince = lastAt
          ? Math.floor((now.getTime() - lastAt.getTime()) / (24 * 60 * 60 * 1000))
          : null;
        const activeMembership = (student.memberships ?? []).find((m) => m.left_at === null);

        inactiveAlerts.push({
          studentId: student.id,
          studentName: student.user.name,
          level: student.level ?? Level.A1,
          ageSegment: student.age_segment,
          groupId: activeMembership?.group_id ?? null,
          groupName: activeMembership?.group?.name ?? null,
          lastActivityAt: lastAt ? lastAt.toISOString() : null,
          daysSinceLastActivity: daysSince,
        });
      }
    }
    inactiveAlerts.sort((a, b) => (b.daysSinceLastActivity ?? 999) - (a.daysSinceLastActivity ?? 999));

    // 9. Aggregates by Level (A1, A2, B1, B2)
    const levels = [Level.A1, Level.A2, Level.B1, Level.B2];
    const byLevel: LevelStatsSummary[] = levels.map((lvl) => {
      const levelStudents = students.filter((s) => s.level === lvl);
      const levelStudentIds = new Set(levelStudents.map((s) => s.id));
      const levelActiveCount = levelStudents.filter((s) => activeStudentIds.has(s.id)).length;

      const levelScores = latestGradedAttempts
        .filter((a) => levelStudentIds.has(a.student_id))
        .map((a) => (a.score !== null ? Number(a.score) : null))
        .filter((s): s is number => s !== null);
      const levelAvg =
        levelScores.length > 0 ? this.round1(levelScores.reduce((sum, s) => sum + s, 0) / levelScores.length) : null;

      let levelTime = 0;
      for (const att of finishedAttempts) {
        if (levelStudentIds.has(att.student_id)) {
          const expected = att.assignment?.activity?.expected_duration_seconds ?? 300;
          levelTime += this.calculateEffectiveDuration(att.started_at, att.finished_at, expected);
        }
      }

      // Level compliance
      let levelAssigned = 0;
      let levelCompleted = 0;
      for (const asg of assignments) {
        const obligatedMembers = asg.group.memberships.filter((m) => {
          if (!levelStudentIds.has(m.student_id)) return false;
          return m.joined_at <= asg.due_at && (m.left_at === null || m.left_at >= asg.opens_at);
        });
        const obligatedIds = new Set(obligatedMembers.map((m) => m.student_id));
        const isClosed = asg.due_at < now;
        const denominator =
          isClosed && asg.historical_student_count !== null
            ? Math.min(asg.historical_student_count, obligatedIds.size)
            : obligatedIds.size;

        const submitters = new Set(
          asg.attempts.filter((att) => obligatedIds.has(att.student_id)).map((att) => att.student_id),
        );
        levelAssigned += denominator;
        levelCompleted += submitters.size;
      }

      return {
        level: lvl,
        studentCount: levelStudents.length,
        activeStudentCount: levelActiveCount,
        averageScore: levelAvg,
        assignedCount: levelAssigned,
        completedAssignedCount: levelCompleted,
        completionRatePercent:
          levelAssigned > 0 ? this.round1((levelCompleted / levelAssigned) * 100) : null,
        timeSpentSeconds: levelTime,
      };
    });

    // 10. Aggregates by Group
    const groups = await this.prisma.group.findMany({
      where: { organization_id: organizationId, archived_at: null },
      include: {
        memberships: {
          where: { student: { approval_status: ApprovalStatus.approved } },
        },
      },
    });

    const byGroup: GroupStatsSummary[] = groups.map((grp) => {
      const groupStudentIds = new Set(grp.memberships.map((m) => m.student_id));
      const groupActiveCount = Array.from(groupStudentIds).filter((id: string) => activeStudentIds.has(id)).length;

      const groupScores = latestGradedAttempts
        .filter((a) => groupStudentIds.has(a.student_id))
        .map((a) => (a.score !== null ? Number(a.score) : null))
        .filter((s): s is number => s !== null);
      const groupAvg =
        groupScores.length > 0 ? this.round1(groupScores.reduce((sum, s) => sum + s, 0) / groupScores.length) : null;

      let groupTime = 0;
      for (const att of finishedAttempts) {
        if (groupStudentIds.has(att.student_id)) {
          const expected = att.assignment?.activity?.expected_duration_seconds ?? 300;
          groupTime += this.calculateEffectiveDuration(att.started_at, att.finished_at, expected);
        }
      }

      let groupAssigned = 0;
      let groupCompleted = 0;
      for (const asg of assignments) {
        if (asg.group_id !== grp.id) continue;
        const obligatedMembers = asg.group.memberships.filter(
          (m) => m.joined_at <= asg.due_at && (m.left_at === null || m.left_at >= asg.opens_at),
        );
        const obligatedIds = new Set(obligatedMembers.map((m) => m.student_id));
        const isClosed = asg.due_at < now;
        const denominator =
          isClosed && asg.historical_student_count !== null
            ? asg.historical_student_count
            : obligatedIds.size;

        const submitters = new Set(
          asg.attempts.filter((att) => obligatedIds.has(att.student_id)).map((att) => att.student_id),
        );
        groupAssigned += denominator;
        groupCompleted += submitters.size;
      }

      return {
        groupId: grp.id,
        groupName: grp.name,
        studentCount: groupStudentIds.size,
        activeStudentCount: groupActiveCount,
        averageScore: groupAvg,
        assignedCount: groupAssigned,
        completedAssignedCount: groupCompleted,
        completionRatePercent:
          groupAssigned > 0 ? this.round1((groupCompleted / groupAssigned) * 100) : null,
        timeSpentSeconds: groupTime,
      };
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      organizationSummary: {
        totalApprovedStudents,
        activeStudentsInPeriod: activeStudentIds.size,
        averageScore,
        completionRatePercent,
        totalTimeSpentSeconds,
        inactiveAlertsCount: inactiveAlerts.length,
      },
      byLevel,
      byGroup,
      inactiveAlerts,
    };
  }

  /**
   * ENG-101: GET /api/v1/stats/groups/:id (RF-6)
   * With 30d and 7d trend comparison (Decisión 112)
   */
  async getGroupStats(
    organizationId: string,
    groupId: string,
    query: StatsGroupQueryDto,
  ): Promise<GroupStatsResponse> {
    const { from, to } = this.parseDateRange(query.from, query.to);
    const trendMode = query.trendMode ?? '30d';

    // Anti-IDOR validation
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, organization_id: organizationId },
      include: {
        memberships: {
          include: {
            student: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'GROUP_NOT_FOUND',
        message: 'Grupo no encontrado',
      });
    }

    const members = group.memberships.filter((m) => m.student.approval_status === ApprovalStatus.approved);

    // Group memberships by student_id to prevent duplicate rows for re-enrolled students
    const studentMembershipsMap = new Map<string, typeof members>();
    for (const m of members) {
      const list = studentMembershipsMap.get(m.student_id) ?? [];
      list.push(m);
      studentMembershipsMap.set(m.student_id, list);
    }
    const memberStudentIds = Array.from(studentMembershipsMap.keys());

    // Trend Windows based on `to`:
    // trend30d: [to - 30d, to] vs [to - 60d, to - 30d)
    const t30CurrentFrom = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const t30PrevFrom = new Date(to.getTime() - 60 * 24 * 60 * 60 * 1000);
    const t30PrevTo = t30CurrentFrom;

    // trend7d: [to - 7d, to] vs [to - 14d, to - 7d)
    const t7CurrentFrom = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const t7PrevFrom = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
    const t7PrevTo = t7CurrentFrom;

    // Load all graded attempts for members spanning max window (last 60 days)
    const earliestTrendDate = t30PrevFrom < from ? t30PrevFrom : from;
    const allGradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: memberStudentIds },
        status: AttemptStatus.graded,
        graded_at: { gte: earliestTrendDate, lte: to },
        score: { not: null },
      },
      orderBy: { attempt_number: 'desc' },
    });

    // Helper to get latest graded score per (student, assignment) in a window
    const getStudentAvgInWindow = (
      studentId: string,
      wFrom: Date,
      wTo: Date,
      exclusiveTo = false,
    ): number | null => {
      const windowAttempts = allGradedAttempts.filter((a) => {
        if (a.student_id !== studentId || !a.graded_at) return false;
        const gTime = a.graded_at.getTime();
        const fromOk = gTime >= wFrom.getTime();
        const toOk = exclusiveTo ? gTime < wTo.getTime() : gTime <= wTo.getTime();
        return fromOk && toOk;
      });
      const latestMap = new Map<string, number>();
      for (const a of windowAttempts) {
        if (!latestMap.has(a.assignment_id) && a.score !== null) {
          latestMap.set(a.assignment_id, Number(a.score));
        }
      }
      const vals = Array.from(latestMap.values());
      return vals.length > 0 ? this.round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    };

    // Load progress events in period for active weeks & streaks
    const progressEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: memberStudentIds },
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
        occurred_at: { gte: from, lte: to },
      },
    });

    // Load all progress events ever to get lastActivityAt
    const allEventsEver = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: memberStudentIds },
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
      },
      select: { student_id: true, occurred_at: true },
      orderBy: { occurred_at: 'desc' },
    });
    const lastActivityMap = new Map<string, Date>();
    for (const ev of allEventsEver) {
      if (!lastActivityMap.has(ev.student_id)) lastActivityMap.set(ev.student_id, ev.occurred_at);
    }

    // Finished attempts in period for time spent
    const finishedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: memberStudentIds },
        status: { in: [AttemptStatus.pending_review, AttemptStatus.graded] },
        finished_at: { gte: from, lte: to },
      },
      include: {
        assignment: { include: { activity: true } },
      },
    });

    // Group assignments for compliance
    const groupAssignments = await this.prisma.assignment.findMany({
      where: {
        group_id: groupId,
        organization_id: organizationId,
        cancelled_at: null,
        activity: { type: { not: ActivityType.game } },
        opens_at: { lte: to },
        due_at: { gte: from },
      },
      include: {
        attempts: {
          where: { status: { in: [AttemptStatus.pending_review, AttemptStatus.graded] } },
          select: { student_id: true },
        },
      },
    });

    const now = new Date();
    const studentRows: GroupStudentStatsRow[] = [];

    for (const [studentId, mList] of studentMembershipsMap.entries()) {
      const student = mList[0]!.student;
      const isCurrentMember = mList.some((m) => m.left_at === null);

      // Period average score
      const avgPeriod = getStudentAvgInWindow(studentId, from, to);

      // Trends
      const t30Curr = getStudentAvgInWindow(studentId, t30CurrentFrom, to, false);
      const t30Prev = getStudentAvgInWindow(studentId, t30PrevFrom, t30PrevTo, true);
      const trend30d = this.computeTrendComparison(t30Curr, t30Prev);

      const t7Curr = getStudentAvgInWindow(studentId, t7CurrentFrom, to, false);
      const t7Prev = getStudentAvgInWindow(studentId, t7PrevFrom, t7PrevTo, true);
      const trend7d = this.computeTrendComparison(t7Curr, t7Prev);

      const activeTrend = trendMode === '7d' ? trend7d : trend30d;

      // Active weeks in period
      const stEvents = progressEvents.filter((e) => e.student_id === studentId);
      const activeWeeks = new Set(
        stEvents.map((e) => this.gamificationService.getBogotaIsoWeekKey(e.occurred_at)),
      );

      // Streak
      const streak = await this.gamificationService.calculateStreak(organizationId, studentId, to);

      // Time spent
      let timeSpentSeconds = 0;
      for (const att of finishedAttempts) {
        if (att.student_id === studentId) {
          const exp = att.assignment?.activity?.expected_duration_seconds ?? 300;
          timeSpentSeconds += this.calculateEffectiveDuration(att.started_at, att.finished_at, exp);
        }
      }

      // Compliance across all memberships in this group
      let assignedCount = 0;
      let completedAssignedCount = 0;
      for (const asg of groupAssignments) {
        const isObligated = mList.some(
          (m) => m.joined_at <= asg.due_at && (m.left_at === null || m.left_at >= asg.opens_at),
        );
        if (isObligated) {
          assignedCount += 1;
          const completed = asg.attempts.some((a) => a.student_id === studentId);
          if (completed) completedAssignedCount += 1;
        }
      }

      const completionRatePercent =
        assignedCount > 0 ? this.round1((completedAssignedCount / assignedCount) * 100) : null;

      const lastAct = lastActivityMap.get(studentId) ?? null;

      studentRows.push({
        studentId: student.id,
        studentName: student.user.name,
        level: student.level ?? Level.A1,
        ageSegment: student.age_segment,
        isCurrentMember,
        averageScore: avgPeriod,
        previousAverageScore: activeTrend.previousAverageScore,
        scoreTrendDelta: activeTrend.delta,
        scoreTrend: activeTrend.direction,
        trend30d,
        trend7d,
        activeWeeksInPeriod: activeWeeks.size,
        currentStreakWeeks: streak.weeks,
        forgivenessAvailable: streak.forgivenessAvailable,
        assignedCount,
        completedAssignedCount,
        completionRatePercent,
        timeSpentSeconds,
        lastActivityAt: lastAct ? lastAct.toISOString() : null,
      });
    }

    // Sorting
    const sortBy = query.sortBy ?? 'studentName';
    const sortOrder = query.sortOrder ?? 'asc';
    studentRows.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'studentName') {
        comparison = a.studentName.localeCompare(b.studentName);
      } else if (sortBy === 'averageScore') {
        const valA = a.averageScore ?? -1;
        const valB = b.averageScore ?? -1;
        comparison = valA - valB;
      } else if (sortBy === 'activeWeeksInPeriod') {
        comparison = a.activeWeeksInPeriod - b.activeWeeksInPeriod;
      } else if (sortBy === 'currentStreakWeeks') {
        comparison = a.currentStreakWeeks - b.currentStreakWeeks;
      } else if (sortBy === 'completionRatePercent') {
        const valA = a.completionRatePercent ?? -1;
        const valB = b.completionRatePercent ?? -1;
        comparison = valA - valB;
      } else if (sortBy === 'timeSpentSeconds') {
        comparison = a.timeSpentSeconds - b.timeSpentSeconds;
      } else if (sortBy === 'lastActivityAt') {
        const valA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const valB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        comparison = valA - valB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Summary calculation
    const scores = studentRows.map((r) => r.averageScore).filter((s): s is number => s !== null);
    const avgScore =
      scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
    const activeCount = studentRows.filter((r) => r.activeWeeksInPeriod > 0 || r.timeSpentSeconds > 0).length;
    const totalTime = studentRows.reduce((sum, r) => sum + r.timeSpentSeconds, 0);

    let groupTotalAssigned = 0;
    let groupTotalCompleted = 0;
    for (const asg of groupAssignments) {
      const obligatedIds = new Set<string>();
      for (const [studentId, mList] of studentMembershipsMap.entries()) {
        const isObligated = mList.some(
          (m) => m.joined_at <= asg.due_at && (m.left_at === null || m.left_at >= asg.opens_at),
        );
        if (isObligated) obligatedIds.add(studentId);
      }
      const isClosed = asg.due_at < now;
      const den =
        isClosed && asg.historical_student_count !== null
          ? asg.historical_student_count
          : obligatedIds.size;
      const submitters = new Set(
        asg.attempts.filter((a) => obligatedIds.has(a.student_id)).map((a) => a.student_id),
      );
      groupTotalAssigned += den;
      groupTotalCompleted += submitters.size;
    }

    const summary: GroupStatsSummary = {
      groupId: group.id,
      groupName: group.name,
      studentCount: studentMembershipsMap.size,
      activeStudentCount: activeCount,
      averageScore: avgScore,
      assignedCount: groupTotalAssigned,
      completedAssignedCount: groupTotalCompleted,
      completionRatePercent:
        groupTotalAssigned > 0 ? this.round1((groupTotalCompleted / groupTotalAssigned) * 100) : null,
      timeSpentSeconds: totalTime,
    };

    const previousFrom = trendMode === '7d' ? t7PrevFrom.toISOString() : t30PrevFrom.toISOString();
    const previousTo = trendMode === '7d' ? t7PrevTo.toISOString() : t30PrevTo.toISOString();

    return {
      group: { id: group.id, name: group.name },
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        previousFrom,
        previousTo,
      },
      trendMode,
      summary,
      students: studentRows,
    };
  }

  /**
   * ENG-102: GET /api/v1/stats/leaderboard (RF-8)
   * Deterministic sorting and filtering by group and level (Decisión 115)
   */
  async getLeaderboard(
    organizationId: string,
    query: StatsLeaderboardQueryDto,
  ): Promise<LeaderboardResponse> {
    const { from, to } = this.parseDateRange(query.from, query.to);

    const students = await this.prisma.student.findMany({
      where: {
        organization_id: organizationId,
        approval_status: ApprovalStatus.approved,
        ...(query.level ? { level: query.level } : {}),
        ...(query.groupId
          ? {
              memberships: {
                some: {
                  group_id: query.groupId,
                  left_at: null,
                },
              },
            }
          : {}),
      },
      include: {
        user: true,
        memberships: {
          where: { left_at: null },
          include: { group: true },
        },
        badge_awards: true,
      },
    });

    const studentIds = students.map((s) => s.id);

    // 2. Graded attempts in period for average score (rule of last graded attempt)
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: studentIds },
        status: AttemptStatus.graded,
        graded_at: { gte: from, lte: to },
        score: { not: null },
      },
      orderBy: { attempt_number: 'desc' },
    });

    const studentScoresMap = new Map<string, Map<string, number>>();
    for (const att of gradedAttempts) {
      if (!studentScoresMap.has(att.student_id)) {
        studentScoresMap.set(att.student_id, new Map());
      }
      const m = studentScoresMap.get(att.student_id)!;
      if (!m.has(att.assignment_id) && att.score !== null) {
        m.set(att.assignment_id, Number(att.score));
      }
    }

    // 3. Completed activities count in period
    const completedEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: studentIds },
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
        occurred_at: { gte: from, lte: to },
      },
      select: { student_id: true },
    });

    const completedCountMap = new Map<string, number>();
    for (const ev of completedEvents) {
      completedCountMap.set(ev.student_id, (completedCountMap.get(ev.student_id) ?? 0) + 1);
    }

    // 4. Build leaderboard entries
    const entries: LeaderboardEntry[] = [];

    for (const student of students) {
      const sMap = studentScoresMap.get(student.id);
      const scores = sMap ? Array.from(sMap.values()) : [];
      const avgScore =
        scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

      const completedCount = completedCountMap.get(student.id) ?? 0;
      const streak = await this.gamificationService.calculateStreak(organizationId, student.id, to);
      const badgesCount = student.badge_awards?.length ?? 0;
      const activeGroup = query.groupId
        ? (student.memberships ?? []).find((m) => m.group_id === query.groupId)?.group ??
          (student.memberships ?? [])[0]?.group ??
          null
        : (student.memberships ?? [])[0]?.group ?? null;

      entries.push({
        rank: 0, // Will be set after sorting
        studentId: student.id,
        studentName: student.user.name,
        level: student.level ?? Level.A1,
        ageSegment: student.age_segment,
        groupId: activeGroup?.id ?? null,
        groupName: activeGroup?.name ?? null,
        averageScore: avgScore,
        completedActivitiesCount: completedCount,
        currentStreakWeeks: streak.weeks,
        badgesCount,
      });
    }

    // 5. Deterministic sorting:
    // 1. averageScore DESC NULLS LAST
    // 2. completedActivitiesCount DESC
    // 3. currentStreakWeeks DESC
    // 4. badgesCount DESC
    // 5. studentName ASC
    entries.sort((a, b) => {
      if (a.averageScore === null && b.averageScore !== null) return 1;
      if (a.averageScore !== null && b.averageScore === null) return -1;
      if (a.averageScore !== null && b.averageScore !== null && a.averageScore !== b.averageScore) {
        return b.averageScore - a.averageScore;
      }

      if (a.completedActivitiesCount !== b.completedActivitiesCount) {
        return b.completedActivitiesCount - a.completedActivitiesCount;
      }

      if (a.currentStreakWeeks !== b.currentStreakWeeks) {
        return b.currentStreakWeeks - a.currentStreakWeeks;
      }

      if (a.badgesCount !== b.badgesCount) {
        return b.badgesCount - a.badgesCount;
      }

      return a.studentName.localeCompare(b.studentName);
    });

    // 6. Assign sequential ranks
    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      filters: {
        groupId: query.groupId ?? null,
        level: query.level ?? null,
      },
      entries,
    };
  }

  /**
   * ENG-103: GET /api/v1/stats/students/:id (RF-9, RF-10)
   * Individual detail of performance and consistency
   */
  async getStudentStats(
    organizationId: string,
    studentId: string,
    query: StatsStudentQueryDto,
  ): Promise<StudentStatsResponse> {
    const { from, to } = this.parseDateRange(query.from, query.to);

    // Anti-IDOR validation
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organization_id: organizationId },
      include: {
        user: true,
        memberships: {
          include: { group: true },
          orderBy: { joined_at: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'STUDENT_NOT_FOUND',
        message: 'Estudiante no encontrado',
      });
    }

    const activeMembership = (student.memberships ?? []).find((m) => m.left_at === null);
    const activeGroup = activeMembership?.group ?? (student.memberships ?? [])[0]?.group ?? null;

    // Optional query filters
    const typeFilter = query.type;
    const levelFilter = query.level;

    // 1. Performance - load graded attempts in period
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        status: AttemptStatus.graded,
        graded_at: { gte: from, lte: to },
        score: { not: null },
        ...(typeFilter || levelFilter
          ? {
              assignment: {
                activity: {
                  ...(typeFilter ? { type: typeFilter } : {}),
                  ...(levelFilter ? { level: levelFilter } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        assignment: {
          include: {
            activity: {
              include: { game_detail: true },
            },
          },
        },
        previous_attempt: true,
      },
      orderBy: { graded_at: 'asc' },
    });

    // Score series:
    // Autonomous games (ActivityType.game): include ALL attempts 1..N
    // Assigned activities (fill_blank, open_question, speaking, exam): latest graded attempt per assignment
    const scoreSeries: StudentScorePoint[] = [];
    const nonGameLatestMap = new Map<string, (typeof gradedAttempts)[0]>();

    for (const att of gradedAttempts) {
      const act = att.assignment.activity;
      if (act.type === ActivityType.game) {
        scoreSeries.push({
          attemptId: att.id,
          assignmentId: att.assignment_id,
          activityId: act.id,
          activityTitle: act.title,
          activityType: act.type,
          gameMechanic: act.game_detail?.mechanic ?? null,
          level: act.level,
          attemptNumber: att.attempt_number,
          score: Number(att.score),
          passed: Number(att.score) >= this.defaultPassingScore,
          gradedAt: att.graded_at!.toISOString(),
          usedExtendedDeadline: Boolean(att.previous_attempt?.retry_extend_until),
          // guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros
          implausibleDuration: att.flags.includes('implausible_duration'),
        });
      } else {
        const existing = nonGameLatestMap.get(att.assignment_id);
        if (!existing || existing.attempt_number < att.attempt_number) {
          nonGameLatestMap.set(att.assignment_id, att);
        }
      }
    }

    for (const att of nonGameLatestMap.values()) {
      const act = att.assignment.activity;
      scoreSeries.push({
        attemptId: att.id,
        assignmentId: att.assignment_id,
        activityId: act.id,
        activityTitle: act.title,
        activityType: act.type,
        gameMechanic: act.game_detail?.mechanic ?? null,
        level: act.level,
        attemptNumber: att.attempt_number,
        score: Number(att.score),
        passed: Number(att.score) >= this.defaultPassingScore,
        gradedAt: att.graded_at!.toISOString(),
        usedExtendedDeadline: Boolean(att.previous_attempt?.retry_extend_until),
        // guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros
        implausibleDuration: att.flags.includes('implausible_duration'),
      });
    }

    // Sort chronologically
    scoreSeries.sort((a, b) => new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime());

    // Compute student's average score across scoreSeries
    const studentScores = scoreSeries.map((p) => p.score);
    const studentAverageScore =
      studentScores.length > 0
        ? this.round1(studentScores.reduce((sum, s) => sum + s, 0) / studentScores.length)
        : null;

    const passedCount = scoreSeries.filter((p) => p.passed).length;
    const needsImprovementCount = scoreSeries.filter((p) => !p.passed).length;
    const totalGradedActivities = scoreSeries.length;
    const passRatePercent =
      totalGradedActivities > 0 ? this.round1((passedCount / totalGradedActivities) * 100) : null;

    // Group average score in period
    let groupAverageScore: number | null = null;
    if (activeGroup) {
      const groupGradedAttempts = await this.prisma.attempt.findMany({
        where: {
          organization_id: organizationId,
          status: AttemptStatus.graded,
          graded_at: { gte: from, lte: to },
          score: { not: null },
          student: {
            memberships: {
              some: { group_id: activeGroup.id, left_at: null },
            },
          },
        },
        orderBy: { attempt_number: 'desc' },
      });
      const gMap = new Map<string, number>();
      for (const a of groupGradedAttempts) {
        const key = `${a.student_id}:${a.assignment_id}`;
        if (!gMap.has(key) && a.score !== null) gMap.set(key, Number(a.score));
      }
      const gVals = Array.from(gMap.values());
      groupAverageScore = gVals.length > 0 ? this.round1(gVals.reduce((sum, s) => sum + s, 0) / gVals.length) : null;
    }

    // Breakdown by ActivityType
    const activityTypes = [
      ActivityType.fill_blank,
      ActivityType.open_question,
      ActivityType.speaking,
      ActivityType.game,
      ActivityType.exam,
    ];
    const byActivityType: StudentTypeBreakdown[] = activityTypes.map((t) => {
      const items = scoreSeries.filter((p) => p.activityType === t);
      const scores = items.map((p) => p.score);
      const avg = scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
      const passed = items.filter((p) => p.passed).length;
      return {
        type: t,
        gradedCount: items.length,
        averageScore: avg,
        passedCount: passed,
        needsImprovementCount: items.length - passed,
      };
    });

    // Breakdown by GameMechanic
    const mechanics = [
      GameMechanic.match,
      GameMechanic.order_words,
      GameMechanic.drag_drop,
      GameMechanic.memory,
      GameMechanic.timed_choice,
    ];
    const byGameMechanic: StudentGameMechanicBreakdown[] = mechanics.map((m) => {
      const items = scoreSeries.filter((p) => p.gameMechanic === m);
      const scores = items.map((p) => p.score);
      const avg = scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
      const uniqueGames = new Set(items.map((p) => p.activityId)).size;
      return {
        mechanic: m,
        attemptsCount: items.length,
        uniqueGamesCount: uniqueGames,
        averageScore: avg,
      };
    });

    // Breakdown by Level
    const levels = [Level.A1, Level.A2, Level.B1, Level.B2];
    const byLevel: StudentLevelBreakdown[] = levels.map((lvl) => {
      const items = scoreSeries.filter((p) => p.level === lvl);
      const scores = items.map((p) => p.score);
      const avg = scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;
      return {
        level: lvl,
        gradedCount: items.length,
        averageScore: avg,
      };
    });

    // 2. Consistency - load progress events
    const allStudentEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
      },
      orderBy: { occurred_at: 'asc' },
    });

    const periodEvents = allStudentEvents.filter(
      (e) => e.occurred_at >= from && e.occurred_at <= to,
    );

    // Current Streak & Best Streak
    const currentStreakState = await this.gamificationService.calculateStreak(
      organizationId,
      studentId,
      to,
    );

    // Compute historical best streak by evaluating streak progression through unique active ISO weeks
    let bestStreakWeeks = currentStreakState.weeks;
    if (allStudentEvents.length > 0) {
      const evaluatedWeeks = new Set<string>();
      for (const ev of allStudentEvents) {
        const wk = this.gamificationService.getBogotaIsoWeekKey(ev.occurred_at);
        if (evaluatedWeeks.has(wk)) continue;
        evaluatedWeeks.add(wk);

        const histStreak = await this.gamificationService.calculateStreak(
          organizationId,
          studentId,
          ev.occurred_at,
        );
        if (histStreak.weeks > bestStreakWeeks) {
          bestStreakWeeks = histStreak.weeks;
        }
      }
    }

    // Active weeks in period
    const activePeriodWeeks = new Set(
      periodEvents.map((e) => this.gamificationService.getBogotaIsoWeekKey(e.occurred_at)),
    );

    // Time spent in period
    const finishedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        status: { in: [AttemptStatus.pending_review, AttemptStatus.graded] },
        finished_at: { gte: from, lte: to },
      },
      include: {
        assignment: { include: { activity: true } },
      },
    });

    let totalTimeSpentSeconds = 0;
    const dailyMap = new Map<string, { seconds: number; count: number }>();
    const weeklyMap = new Map<string, { seconds: number; count: number }>();
    const monthlyMap = new Map<string, { seconds: number; count: number }>();

    for (const att of finishedAttempts) {
      if (!att.finished_at) continue;
      const exp = att.assignment?.activity?.expected_duration_seconds ?? 300;
      const dur = this.calculateEffectiveDuration(att.started_at, att.finished_at, exp);
      totalTimeSpentSeconds += dur;

      const dayKey = this.formatBogotaDay(att.finished_at);
      const weekKey = this.gamificationService.getBogotaIsoWeekKey(att.finished_at);
      const monthKey = this.formatBogotaMonth(att.finished_at);

      const d = dailyMap.get(dayKey) ?? { seconds: 0, count: 0 };
      d.seconds += dur;
      d.count += 1;
      dailyMap.set(dayKey, d);

      const w = weeklyMap.get(weekKey) ?? { seconds: 0, count: 0 };
      w.seconds += dur;
      w.count += 1;
      weeklyMap.set(weekKey, w);

      const m = monthlyMap.get(monthKey) ?? { seconds: 0, count: 0 };
      m.seconds += dur;
      m.count += 1;
      monthlyMap.set(monthKey, m);
    }

    const dailyTime: TimeBucketItem[] = Array.from(dailyMap.entries())
      .map(([bucketKey, val]) => ({
        bucketKey,
        timeSpentSeconds: val.seconds,
        completedCount: val.count,
      }))
      .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));

    const weeklyTime: TimeBucketItem[] = Array.from(weeklyMap.entries())
      .map(([bucketKey, val]) => ({
        bucketKey,
        timeSpentSeconds: val.seconds,
        completedCount: val.count,
      }))
      .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));

    const monthlyTime: TimeBucketItem[] = Array.from(monthlyMap.entries())
      .map(([bucketKey, val]) => ({
        bucketKey,
        timeSpentSeconds: val.seconds,
        completedCount: val.count,
      }))
      .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));

    // 12-week ISO calendar (last 12 weeks ending at `to`)
    const weeklyCalendar: StudentWeekCalendarItem[] = [];
    const eventCountsByWeek = new Map<string, number>();
    for (const ev of allStudentEvents) {
      const wk = this.gamificationService.getBogotaIsoWeekKey(ev.occurred_at);
      eventCountsByWeek.set(wk, (eventCountsByWeek.get(wk) ?? 0) + 1);
    }

    const currentWeekKey = this.gamificationService.getBogotaIsoWeekKey(to);

    // Generate last 12 ISO weeks backwards from `to`
    for (let i = 11; i >= 0; i--) {
      const weekDate = new Date(to.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const wKey = this.gamificationService.getBogotaIsoWeekKey(weekDate);

      // Avoid duplicates if same week key was already pushed
      if (weeklyCalendar.some((item) => item.weekKey === wKey)) continue;

      const completedCount = eventCountsByWeek.get(wKey) ?? 0;
      let status: 'active' | 'forgiven' | 'inactive' | 'current_pending';

      if (completedCount > 0) {
        status = 'active';
      } else if (wKey === currentWeekKey) {
        status = 'current_pending';
      } else {
        // If inactive, did it consume forgiveness?
        const st = await this.gamificationService.calculateStreak(organizationId, studentId, weekDate);
        if (!st.forgivenessAvailable && st.weeks > 0) {
          status = 'forgiven';
        } else {
          status = 'inactive';
        }
      }

      weeklyCalendar.push({
        weekKey: wKey,
        weekStart: this.getBogotaIsoWeekMonday(weekDate),
        status,
        completedCount,
      });
    }

    // Student assignment compliance across all groups student was enrolled in
    let assignedCount = 0;
    let completedAssignedCount = 0;

    const studentGroupIds = Array.from(new Set((student.memberships ?? []).map((m) => m.group_id)));

    if (studentGroupIds.length > 0) {
      const relevantAssignments = await this.prisma.assignment.findMany({
        where: {
          group_id: { in: studentGroupIds },
          organization_id: organizationId,
          cancelled_at: null,
          activity: { type: { not: ActivityType.game } },
          opens_at: { lte: to },
          due_at: { gte: from },
        },
        include: {
          attempts: {
            where: {
              student_id: studentId,
              status: { in: [AttemptStatus.pending_review, AttemptStatus.graded] },
            },
          },
        },
      });

      for (const asg of relevantAssignments) {
        // Is the student obligated for this assignment in its group?
        const isObligated = (student.memberships ?? []).some(
          (m) =>
            m.group_id === asg.group_id &&
            m.joined_at <= asg.due_at &&
            (m.left_at === null || m.left_at >= asg.opens_at),
        );
        if (isObligated) {
          assignedCount += 1;
          if (asg.attempts.length > 0) {
            completedAssignedCount += 1;
          }
        }
      }
    }

    const completionRatePercent =
      assignedCount > 0 ? this.round1((completedAssignedCount / assignedCount) * 100) : null;

    return {
      student: {
        id: student.id,
        name: student.user.name,
        level: student.level ?? Level.A1,
        ageSegment: student.age_segment,
        groupId: activeGroup?.id ?? null,
        groupName: activeGroup?.name ?? null,
        joinedAt: student.created_at.toISOString(),
      },
      period: { from: from.toISOString(), to: to.toISOString() },
      filters: {
        type: typeFilter ?? null,
        level: levelFilter ?? null,
      },
      performance: {
        passingScore: this.defaultPassingScore,
        studentAverageScore,
        groupAverageScore,
        totalGradedActivities,
        passedCount,
        needsImprovementCount,
        passRatePercent,
        scoreSeries,
        byActivityType,
        byGameMechanic,
        byLevel,
      },
      consistency: {
        currentStreakWeeks: currentStreakState.weeks,
        bestStreakWeeks,
        forgivenessAvailable: currentStreakState.forgivenessAvailable,
        activeWeeksInPeriod: activePeriodWeeks.size,
        completedActivitiesInPeriod: periodEvents.length,
        assignedCount,
        completedAssignedCount,
        completionRatePercent,
        totalTimeSpentSeconds,
        weeklyCalendar,
        dailyTime,
        weeklyTime,
        monthlyTime,
      },
    };
  }
}
