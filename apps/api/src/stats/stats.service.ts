import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService, type StreakState } from '../gamification/gamification.service';
import {
  ActivityType,
  ApprovalStatus,
  AttemptStatus,
  GameMechanic,
  Level,
  ProgressEventType,
  ScoreTrendComparison,
  ScoreTrendDirection,
  WeekCalendarStatus,
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
  StudentOfflineUndeliveredAttempt,
  GamesPracticeSummary,
  GamePracticeSessionItem,
  GamesLeaderboardItem,
  GamesLeaderboardResponse,
  scoreToGameStars,
  formatBogotaDateTime,
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

  private async computeStreak(
    organizationId: string,
    studentId: string,
    events: Array<{ occurred_at: Date }>,
    asOfDate?: Date,
  ): Promise<StreakState> {
    if (this.gamificationService && typeof this.gamificationService.calculateStreakFromEvents === 'function') {
      return this.gamificationService.calculateStreakFromEvents(events, asOfDate);
    }
    if (this.gamificationService && typeof this.gamificationService.calculateStreak === 'function') {
      return await this.gamificationService.calculateStreak(organizationId, studentId, asOfDate);
    }
    return {
      weeks: 0,
      forgivenessAvailable: true,
      activeWeeksSinceForgivenessUsed: 0,
      periodKey: null,
      forgivenWeekKeys: [],
    };
  }

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
        assignment_id: { not: null },
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
      if (!att.assignment_id) continue;
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
        activity: true,
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
      const expected = att.activity?.expected_duration_seconds ?? att.assignment?.activity?.expected_duration_seconds ?? 300;
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

    // For inactive alerts, find the last activity event ever for each student via batch groupBy (RF-11)
    const lastActivityByStudent =
      typeof this.prisma.progressEvent.groupBy === 'function'
        ? await this.prisma.progressEvent.groupBy({
            by: ['student_id'],
            where: {
              organization_id: organizationId,
              type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
            },
            _max: {
              occurred_at: true,
            },
          })
        : [];

    const lastActivityMap = new Map<string, Date>();
    for (const item of lastActivityByStudent) {
      if (item._max.occurred_at) {
        lastActivityMap.set(item.student_id, item._max.occurred_at);
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
          const expected = att.activity?.expected_duration_seconds ?? att.assignment?.activity?.expected_duration_seconds ?? 300;
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
        assignment_id: { not: null },
        assignment: { activity: { type: { not: ActivityType.game } } },
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
        if (a.assignment_id && !latestMap.has(a.assignment_id) && a.score !== null) {
          latestMap.set(a.assignment_id, Number(a.score));
        }
      }
      const vals = Array.from(latestMap.values());
      return vals.length > 0 ? this.round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
    };

    // Load progress events in period for active weeks
    const progressEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: memberStudentIds },
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
        occurred_at: { gte: from, lte: to },
      },
    });

    // Load last activity for members via batch groupBy (RF-11)
    const lastActivityByStudent =
      typeof this.prisma.progressEvent.groupBy === 'function'
        ? await this.prisma.progressEvent.groupBy({
            by: ['student_id'],
            where: {
              organization_id: organizationId,
              student_id: { in: memberStudentIds },
              type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
            },
            _max: { occurred_at: true },
          })
        : [];
    const lastActivityMap = new Map<string, Date>();
    for (const item of lastActivityByStudent) {
      if (item._max.occurred_at) {
        lastActivityMap.set(item.student_id, item._max.occurred_at);
      }
    }

    // Load all historical events for member streaks in a single batch query (RF-11)
    const allMemberEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: memberStudentIds },
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
      },
      orderBy: { occurred_at: 'asc' },
    });
    const eventsByStudent = new Map<string, Array<{ occurred_at: Date }>>();
    for (const ev of allMemberEvents) {
      let list = eventsByStudent.get(ev.student_id);
      if (!list) {
        list = [];
        eventsByStudent.set(ev.student_id, list);
      }
      list.push(ev);
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
        activity: true,
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

      // Streak calculated in-memory (RF-11)
      const stHistEvents = eventsByStudent.get(studentId) ?? [];
      const streak = await this.computeStreak(organizationId, studentId, stHistEvents, to);

      // Time spent
      let timeSpentSeconds = 0;
      for (const att of finishedAttempts) {
        if (att.student_id === studentId) {
          const exp = att.activity?.expected_duration_seconds ?? att.assignment?.activity?.expected_duration_seconds ?? 300;
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

    const gamesPractice = await this.computeGamesPractice(
      organizationId,
      memberStudentIds,
      from,
      to,
      false,
    );

    const previousFrom =
      trendMode === '7d' ? t7PrevFrom.toISOString() : t30PrevFrom.toISOString();
    const previousTo =
      trendMode === '7d' ? t7PrevTo.toISOString() : t30PrevTo.toISOString();

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
      gamesPractice,
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
    // Exclude games per RF-12 / Decision 137
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: studentIds },
        status: AttemptStatus.graded,
        assignment_id: { not: null },
        assignment: { activity: { type: { not: ActivityType.game } } },
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
      if (att.assignment_id && !m.has(att.assignment_id) && att.score !== null) {
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

    // Batch load all historical events for streaks in a single query (RF-11)
    const allLeaderboardEvents = await this.prisma.progressEvent.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: studentIds },
        type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
      },
      orderBy: { occurred_at: 'asc' },
    });
    const eventsByStudent = new Map<string, Array<{ occurred_at: Date }>>();
    for (const ev of allLeaderboardEvents) {
      let list = eventsByStudent.get(ev.student_id);
      if (!list) {
        list = [];
        eventsByStudent.set(ev.student_id, list);
      }
      list.push(ev);
    }

    // 4. Build leaderboard entries
    const entries: LeaderboardEntry[] = [];

    for (const student of students) {
      const sMap = studentScoresMap.get(student.id);
      const scores = sMap ? Array.from(sMap.values()) : [];
      const avgScore =
        scores.length > 0 ? this.round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

      const completedCount = completedCountMap.get(student.id) ?? 0;
      const stHistEvents = eventsByStudent.get(student.id) ?? [];
      const streak = await this.computeStreak(organizationId, student.id, stHistEvents, to);
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

    // 1. Performance - load graded attempts in period (excluding games per SPEC-11 RF-12 / Decision 137)
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        status: AttemptStatus.graded,
        graded_at: { gte: from, lte: to },
        score: { not: null },
        assignment_id: { not: null },
        assignment: {
          activity: {
            type: typeFilter ? typeFilter : { not: ActivityType.game },
            ...(levelFilter ? { level: levelFilter } : {}),
          },
        },
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
    // Assigned activities (fill_blank, open_question, speaking, exam): latest graded attempt per assignment
    // Microgames (game) are excluded from scoreSeries per RF-12 / Decision 137 (they live in gamesPractice)
    const scoreSeries: StudentScorePoint[] = [];
    const nonGameLatestMap = new Map<string, (typeof gradedAttempts)[0]>();

    for (const att of gradedAttempts) {
      const act = att.assignment?.activity;
      if (!act || act.type === ActivityType.game) continue;

      if (att.assignment_id) {
        const existing = nonGameLatestMap.get(att.assignment_id);
        if (!existing || existing.attempt_number < att.attempt_number) {
          nonGameLatestMap.set(att.assignment_id, att);
        }
      }
    }

    for (const att of nonGameLatestMap.values()) {
      const act = att.assignment?.activity;
      if (!act) continue;
      scoreSeries.push({
        attemptId: att.id,
        assignmentId: att.assignment_id ?? '',
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
          assignment_id: { not: null },
          assignment: { activity: { type: { not: ActivityType.game } } },
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
        if (a.assignment_id && !gMap.has(a.assignment_id) && a.score !== null) {
          gMap.set(a.assignment_id, Number(a.score));
        }
      }
      const gVals = Array.from(gMap.values());
      groupAverageScore = gVals.length > 0 ? this.round1(gVals.reduce((sum, s) => sum + s, 0) / gVals.length) : null;
    }

    // Breakdown by ActivityType (excluding game per RF-12 / Decision 137)
    const activityTypes = [
      ActivityType.fill_blank,
      ActivityType.open_question,
      ActivityType.speaking,
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

    // Breakdown by GameMechanic (empty for academic performance; game mechanics live in gamesPractice)
    const byGameMechanic: StudentGameMechanicBreakdown[] = [];

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

    // Current Streak & Best Streak (calculated in-memory without N+1 queries, RF-11)
    const currentStreakState = await this.computeStreak(
      organizationId,
      studentId,
      allStudentEvents,
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

        const histStreak = await this.computeStreak(
          organizationId,
          studentId,
          allStudentEvents,
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
        activity: true,
      },
    });

    let totalTimeSpentSeconds = 0;
    const dailyMap = new Map<string, { seconds: number; count: number }>();
    const weeklyMap = new Map<string, { seconds: number; count: number }>();
    const monthlyMap = new Map<string, { seconds: number; count: number }>();

    for (const att of finishedAttempts) {
      if (!att.finished_at) continue;
      const exp = att.activity?.expected_duration_seconds ?? att.assignment?.activity?.expected_duration_seconds ?? 300;
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
    // Marks 'forgiven' on the exact week that consumed forgiveness (RF-8 / ISSUE-03)
    const weeklyCalendar: StudentWeekCalendarItem[] = [];
    const eventCountsByWeek = new Map<string, number>();
    for (const ev of allStudentEvents) {
      const wk = this.gamificationService.getBogotaIsoWeekKey(ev.occurred_at);
      eventCountsByWeek.set(wk, (eventCountsByWeek.get(wk) ?? 0) + 1);
    }

    const currentWeekKey = this.gamificationService.getBogotaIsoWeekKey(to);
    const forgivenWeekKeys = new Set(currentStreakState.forgivenWeekKeys);

    // Generate last 12 ISO weeks backwards from `to`
    for (let i = 11; i >= 0; i--) {
      const weekDate = new Date(to.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const wKey = this.gamificationService.getBogotaIsoWeekKey(weekDate);

      // Avoid duplicates if same week key was already pushed
      if (weeklyCalendar.some((item) => item.weekKey === wKey)) continue;

      const completedCount = eventCountsByWeek.get(wKey) ?? 0;
      let status: WeekCalendarStatus;

      if (completedCount > 0) {
        status = 'active';
      } else if (wKey === currentWeekKey) {
        status = 'current_pending';
      } else if (forgivenWeekKeys.has(wKey)) {
        status = 'forgiven';
      } else {
        status = 'inactive';
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

    // Offline undelivered attempts (SPEC-09 RF-17)
    const offlineSyncAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        status: AttemptStatus.abandoned,
        flags: { has: 'offline_sync' },
        started_at: { gte: from, lte: to },
      },
      include: {
        assignment: {
          include: { activity: true },
        },
        previous_attempt: true,
      },
      orderBy: { started_at: 'desc' },
    });

    const offlineUndeliveredAttempts: StudentOfflineUndeliveredAttempt[] = offlineSyncAttempts.map((att) => {
      const effectiveDueAt =
        att.previous_attempt?.retry_extend_until ?? att.assignment?.due_at ?? att.started_at;
      const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);
      return {
        attemptId: att.id,
        assignmentId: att.assignment_id,
        activityTitle: att.assignment?.activity?.title ?? 'Actividad',
        activityType: att.assignment?.activity?.type ?? ActivityType.fill_blank,
        // guardrails-ignore G-C03: timestamp de solo lectura asignado por el servidor
        startedAt: att.started_at.toISOString(),
        // guardrails-ignore G-C03: timestamp de solo lectura calculado por el servidor
        completeUntil: completeUntil.toISOString(),
      };
    });

    const gamesPractice = await this.computeGamesPractice(
      organizationId,
      [studentId],
      from,
      to,
      true, // includeSessions = true for student view
    );

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
        offlineUndeliveredAttempts,
      },
      gamesPractice,
    };
  }

  /**
   * Computes games practice summary and session history for students.
   * RF-12 / Decision 137.
   */
  async computeGamesPractice(
    organizationId: string,
    studentIds: string[],
    from: Date,
    to: Date,
    includeSessions = false,
  ): Promise<GamesPracticeSummary> {
    if (studentIds.length === 0) {
      return {
        totalSessions: 0,
        uniqueGamesPlayed: 0,
        totalPracticeTimeSeconds: 0,
        byMechanic: [
          { mechanic: GameMechanic.match, sessionsCount: 0, uniqueGamesCount: 0, practiceTimeSeconds: 0 },
          { mechanic: GameMechanic.drag_drop, sessionsCount: 0, uniqueGamesCount: 0, practiceTimeSeconds: 0 },
          { mechanic: GameMechanic.memory, sessionsCount: 0, uniqueGamesCount: 0, practiceTimeSeconds: 0 },
          { mechanic: GameMechanic.timed_choice, sessionsCount: 0, uniqueGamesCount: 0, practiceTimeSeconds: 0 },
        ],
        dailySummary: [],
        weeklySummary: [],
        ...(includeSessions ? { sessions: [] } : {}),
      };
    }

    // Load graded attempts of type 'game' in period
    const attempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: studentIds },
        status: AttemptStatus.graded,
        graded_at: { gte: from, lte: to },
        OR: [
          { activity_id: { not: null } },
          { assignment: { activity: { type: ActivityType.game } } },
        ],
      },
      include: {
        activity: {
          include: { game_detail: true },
        },
        assignment: {
          include: {
            activity: {
              include: { game_detail: true },
            },
          },
        },
      },
      orderBy: { started_at: 'desc' },
    });

    const uniqueGameIds = new Set<string>();
    let totalPracticeTimeSeconds = 0;
    let totalSessions = 0;

    const mechanicMap = new Map<
      GameMechanic,
      { sessionsCount: number; uniqueGames: Set<string>; practiceTimeSeconds: number }
    >();
    for (const m of [GameMechanic.match, GameMechanic.drag_drop, GameMechanic.memory, GameMechanic.timed_choice]) {
      mechanicMap.set(m, { sessionsCount: 0, uniqueGames: new Set(), practiceTimeSeconds: 0 });
    }

    const dailyMap = new Map<string, { seconds: number; count: number }>();
    const weeklyMap = new Map<string, { seconds: number; count: number }>();
    const sessions: GamePracticeSessionItem[] = [];

    for (const att of attempts) {
      const act = att.activity ?? att.assignment?.activity;
      if (!act) continue;
      if (act.type && act.type !== ActivityType.game) continue;

      totalSessions += 1;
      const actId = act.id;
      uniqueGameIds.add(actId);

      const exp = act.expected_duration_seconds ?? 60;
      const dur = this.calculateEffectiveDuration(att.started_at, att.finished_at, exp);
      totalPracticeTimeSeconds += dur;

      const mechanic = act.game_detail?.mechanic ?? GameMechanic.match;
      const mData = mechanicMap.get(mechanic) ?? {
        sessionsCount: 0,
        uniqueGames: new Set(),
        practiceTimeSeconds: 0,
      };
      mData.sessionsCount += 1;
      mData.uniqueGames.add(actId);
      mData.practiceTimeSeconds += dur;
      mechanicMap.set(mechanic, mData);

      const refDate = att.finished_at ?? att.started_at;
      const dayKey = this.formatBogotaDay(refDate);
      const weekKey = this.gamificationService.getBogotaIsoWeekKey(refDate);

      const d = dailyMap.get(dayKey) ?? { seconds: 0, count: 0 };
      d.seconds += dur;
      d.count += 1;
      dailyMap.set(dayKey, d);

      const w = weeklyMap.get(weekKey) ?? { seconds: 0, count: 0 };
      w.seconds += dur;
      w.count += 1;
      weeklyMap.set(weekKey, w);

      if (includeSessions) {
        sessions.push({
          attemptId: att.id,
          activityId: actId,
          activityTitle: act.title,
          mechanic,
          level: act.level,
          stars: scoreToGameStars(att.score !== null ? Number(att.score) : 0),
          durationSeconds: dur,
          playedAtBogota: formatBogotaDateTime(att.started_at),
          implausibleDuration: att.flags?.includes('implausible_duration') ?? false,
        });
      }
    }

    const byMechanic = Array.from(mechanicMap.entries()).map(([mechanic, data]) => ({
      mechanic,
      sessionsCount: data.sessionsCount,
      uniqueGamesCount: data.uniqueGames.size,
      practiceTimeSeconds: data.practiceTimeSeconds,
    }));

    const dailySummary: TimeBucketItem[] = Array.from(dailyMap.entries())
      .map(([bucketKey, val]) => ({
        bucketKey,
        timeSpentSeconds: val.seconds,
        completedCount: val.count,
      }))
      .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));

    const weeklySummary: TimeBucketItem[] = Array.from(weeklyMap.entries())
      .map(([bucketKey, val]) => ({
        bucketKey,
        timeSpentSeconds: val.seconds,
        completedCount: val.count,
      }))
      .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));

    return {
      totalSessions,
      uniqueGamesPlayed: uniqueGameIds.size,
      totalPracticeTimeSeconds,
      byMechanic,
      dailySummary,
      weeklySummary,
      ...(includeSessions ? { sessions } : {}),
    };
  }

  /**
   * ENG-162 / RF-12: GET /api/v1/stats/games-leaderboard (Decision 137)
   * Private game ranking for teachers.
   * Capped to top 5 attempts per game in period; 6 deterministic tie-breakers.
   */
  async getGamesLeaderboard(
    organizationId: string,
    query: StatsLeaderboardQueryDto,
  ): Promise<GamesLeaderboardResponse> {
    const { from, to } = this.parseDateRange(query.from, query.to);

    // 1. Approved students matching filters
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
      },
    });

    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) {
      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        filters: { groupId: query.groupId ?? null, level: query.level ?? null },
        items: [],
      };
    }

    // 2. Graded game attempts in period without 'implausible_duration'
    const gameAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: { in: studentIds },
        status: AttemptStatus.graded,
        graded_at: { gte: from, lte: to },
        NOT: {
          flags: { has: 'implausible_duration' },
        },
        OR: [
          { activity_id: { not: null } },
          { assignment: { activity: { type: ActivityType.game } } },
        ],
      },
      include: {
        activity: true,
        assignment: { include: { activity: true } },
      },
      orderBy: { graded_at: 'desc' },
    });

    // Star to points mapping: 0 -> 0, 1 -> 10, 2 -> 25, 3 -> 50
    const starPoints = (stars: number): number => {
      switch (stars) {
        case 3: return 50;
        case 2: return 25;
        case 1: return 10;
        default: return 0;
      }
    };

    // Group attempts by student, then by activity
    const studentAttemptsMap = new Map<
      string,
      Map<string, Array<{ stars: number; points: number; duration: number; gradedAt: Date }>>
    >();

    for (const att of gameAttempts) {
      const act = att.activity ?? att.assignment?.activity;
      if (!act) continue;

      let actMap = studentAttemptsMap.get(att.student_id);
      if (!actMap) {
        actMap = new Map();
        studentAttemptsMap.set(att.student_id, actMap);
      }

      let list = actMap.get(act.id);
      if (!list) {
        list = [];
        actMap.set(act.id, list);
      }

      const stars = scoreToGameStars(att.score !== null ? Number(att.score) : 0);
      const points = starPoints(stars);
      const exp = act.expected_duration_seconds ?? 60;
      const duration = this.calculateEffectiveDuration(att.started_at, att.finished_at, exp);

      list.push({
        stars,
        points,
        duration,
        gradedAt: att.graded_at ?? att.started_at,
      });
    }

    // Build raw leaderboard items
    const rawItems: Array<{
      studentId: string;
      studentName: string;
      groupId: string | null;
      groupName: string | null;
      level: Level;
      gamePoints: number;
      totalStars: number;
      gamesPlayedCount: number;
      uniqueGamesPlayed: number;
      practiceTimeSeconds: number;
      lastPlayedAt: string | null;
    }> = [];

    for (const student of students) {
      const actMap = studentAttemptsMap.get(student.id);
      let gamePoints = 0;
      let totalStars = 0;
      let gamesPlayedCount = 0;
      let practiceTimeSeconds = 0;
      let lastPlayedDate: Date | null = null;

      if (actMap) {
        for (const [_, list] of actMap.entries()) {
          // Sort descending by points (highest first)
          list.sort((a, b) => b.points - a.points);

          // Cap of top 5 attempts per activity for gamePoints and totalStars
          const top5 = list.slice(0, 5);
          for (const item of top5) {
            gamePoints += item.points;
            totalStars += item.stars;
          }

          // All attempts count for practice time and gamesPlayedCount
          for (const item of list) {
            gamesPlayedCount += 1;
            practiceTimeSeconds += item.duration;
            if (!lastPlayedDate || item.gradedAt > lastPlayedDate) {
              lastPlayedDate = item.gradedAt;
            }
          }
        }
      }

      const activeGroup = query.groupId
        ? (student.memberships ?? []).find((m) => m.group_id === query.groupId)?.group ??
          (student.memberships ?? [])[0]?.group ??
          null
        : (student.memberships ?? [])[0]?.group ?? null;

      rawItems.push({
        studentId: student.id,
        studentName: student.user.name,
        groupId: activeGroup?.id ?? null,
        groupName: activeGroup?.name ?? null,
        level: student.level ?? Level.A1,
        gamePoints,
        totalStars,
        gamesPlayedCount,
        uniqueGamesPlayed: actMap ? actMap.size : 0,
        practiceTimeSeconds,
        lastPlayedAt: lastPlayedDate ? lastPlayedDate.toISOString() : null,
      });
    }

    // 6 deterministic tie-breakers (Decision 137):
    // 1) gamePoints DESC
    // 2) totalStars DESC
    // 3) uniqueGamesPlayed DESC
    // 4) practiceTimeSeconds DESC
    // 5) studentName ASC (es-CO)
    // 6) studentId ASC
    rawItems.sort((a, b) => {
      if (b.gamePoints !== a.gamePoints) return b.gamePoints - a.gamePoints;
      if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
      if (b.uniqueGamesPlayed !== a.uniqueGamesPlayed) return b.uniqueGamesPlayed - a.uniqueGamesPlayed;
      if (b.practiceTimeSeconds !== a.practiceTimeSeconds) return b.practiceTimeSeconds - a.practiceTimeSeconds;
      const nameComp = a.studentName.localeCompare(b.studentName, 'es-CO');
      if (nameComp !== 0) return nameComp;
      return a.studentId.localeCompare(b.studentId);
    });

    const items: GamesLeaderboardItem[] = rawItems.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      filters: { groupId: query.groupId ?? null, level: query.level ?? null },
      items,
    };
  }
}
