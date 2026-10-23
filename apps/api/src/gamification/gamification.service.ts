import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProgressEventType,
  BadgeAwardView,
} from '@englove/shared';

export interface StreakState {
  weeks: number;
  forgivenessAvailable: boolean;
  activeWeeksSinceForgivenessUsed: number;
  periodKey: string | null;
}

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an attempt completion event (Decision 100 / Q-01).
   * For auto-graded: value = score.
   * For open_question: value = null.
   */
  async recordAttemptCompleted(
    organizationId: string,
    studentId: string,
    attemptId: string,
    score: number | null,
  ): Promise<BadgeAwardView[]> {
    await this.prisma.progressEvent.create({
      data: {
        organization_id: organizationId,
        student_id: studentId,
        attempt_id: attemptId,
        type: ProgressEventType.attempt_completed,
        value: score !== null ? new Prisma.Decimal(score) : null,
      },
    });

    return this.evaluateBadges(organizationId, studentId);
  }

  /**
   * Records a speaking submission confirmation (Decision 100 / Q-01).
   * value = 1.
   */
  async recordAudioSubmitted(
    organizationId: string,
    studentId: string,
    attemptId: string,
  ): Promise<BadgeAwardView[]> {
    await this.prisma.progressEvent.create({
      data: {
        organization_id: organizationId,
        student_id: studentId,
        attempt_id: attemptId,
        type: ProgressEventType.audio_submitted,
        value: new Prisma.Decimal(1),
      },
    });

    return this.evaluateBadges(organizationId, studentId);
  }

  /**
   * Calculates streak using the 4-rule algorithm (architecture §9.3, Decision 34 §9, SPEC-05 RF-18 to RF-21).
   * Rule 1: Only active weeks count (weeks with attempt_completed or audio_submitted).
   * Rule 2: Forgiveness only with active streak (streak 0 never consumes forgiveness).
   * Rule 3: Forgiveness recovery requires 2 consecutive active weeks. Inactive week resets counter.
   * Rule 4: Max 1 forgiveness. Two consecutive inactive weeks break the streak.
   */
  async calculateStreak(
    organizationId: string,
    studentId: string,
    asOfDate?: Date,
  ): Promise<StreakState> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organization_id: organizationId },
    });

    if (!student) {
      return {
        weeks: 0,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: null,
      };
    }

    // Load all completed activity events for this student
    const events = await this.prisma.progressEvent.findMany({
      where: {
        student_id: studentId,
        organization_id: organizationId,
        type: {
          in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted],
        },
      },
      orderBy: { occurred_at: 'asc' },
    });

    if (events.length === 0) {
      return {
        weeks: 0,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: null,
      };
    }

    // Group events by ISO week in America/Bogota (e.g. "2026-W42")
    const activeWeeks = new Set<string>();
    for (const ev of events) {
      const weekKey = this.getBogotaIsoWeekKey(ev.occurred_at);
      activeWeeks.add(weekKey);
    }

    // Determine week sequence from student start to current week
    const firstEvent = events[0];
    if (!firstEvent) {
      return {
        weeks: 0,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: null,
      };
    }
    const firstWeekDate = firstEvent.occurred_at;
    const effectiveNow = asOfDate || new Date();
    const currentWeekKey = this.getBogotaIsoWeekKey(effectiveNow);

    const weekSequence = this.generateIsoWeekKeys(firstWeekDate, effectiveNow);

    let weeks = 0;
    let forgivenessAvailable = true;
    let activeWeeksSinceForgivenessUsed = 0;

    for (const wKey of weekSequence) {
      const isActive = activeWeeks.has(wKey);

      if (isActive) {
        weeks += 1;
        if (!forgivenessAvailable) {
          activeWeeksSinceForgivenessUsed += 1;
          if (activeWeeksSinceForgivenessUsed >= 2) {
            forgivenessAvailable = true;
            activeWeeksSinceForgivenessUsed = 0;
          }
        }
      } else {
        // If this week is currently in progress, do not penalize for inactivity until it closes
        if (wKey === currentWeekKey) {
          continue;
        }

        // Inactive closed week
        if (weeks === 0) {
          // Rule 2: racha 0 no consume perdón
          forgivenessAvailable = true;
          activeWeeksSinceForgivenessUsed = 0;
        } else {
          if (forgivenessAvailable) {
            // Rule 2: Consume perdón y conserva la racha; no suma semana
            forgivenessAvailable = false;
            activeWeeksSinceForgivenessUsed = 0;
          } else {
            // Rule 4: Dos semanas inactivas consecutivas rompen la racha
            weeks = 0;
            forgivenessAvailable = true;
            activeWeeksSinceForgivenessUsed = 0;
          }
        }
      }
    }

    return {
      weeks,
      forgivenessAvailable,
      activeWeeksSinceForgivenessUsed,
      periodKey: currentWeekKey,
    };
  }

  /**
   * Evaluates active BadgeRules and awards any earned badges (RF-17).
   */
  async evaluateBadges(
    organizationId: string,
    studentId: string,
  ): Promise<BadgeAwardView[]> {
    const rules = await this.prisma.badgeRule.findMany({
      where: { organization_id: organizationId, active: true },
    });

    const existingAwards = await this.prisma.badgeAward.findMany({
      where: { student_id: studentId, organization_id: organizationId },
    });
    const awardedRuleIds = new Set(existingAwards.map((a) => a.badge_rule_id));

    const student = await this.prisma.student.findFirst({
      where: { organization_id: organizationId, id: studentId },
    });
    if (!student) return [];

    const newAwards: BadgeAwardView[] = [];

    // Lazy load stats only if rules require them
    let attemptCount: number | null = null;
    let audioCount: number | null = null;
    let currentStreakWeeks: number | null = null;

    for (const rule of rules) {
      if (awardedRuleIds.has(rule.id)) continue;

      let isEligible = false;
      const ruleDef = rule.rule as { type?: string; event?: string; threshold?: number } | null;

      if (ruleDef?.type === 'event_count') {
        if (ruleDef.event === 'attempt_completed') {
          if (attemptCount === null) {
            attemptCount = await this.prisma.progressEvent.count({
              where: {
                student_id: studentId,
                organization_id: organizationId,
                type: ProgressEventType.attempt_completed,
              },
            });
          }
          if (attemptCount >= (ruleDef.threshold ?? 1)) {
            isEligible = true;
          }
        } else if (ruleDef.event === 'audio_submitted') {
          if (audioCount === null) {
            audioCount = await this.prisma.progressEvent.count({
              where: {
                student_id: studentId,
                organization_id: organizationId,
                type: ProgressEventType.audio_submitted,
              },
            });
          }
          if (audioCount >= (ruleDef.threshold ?? 1)) {
            isEligible = true;
          }
        }
      } else if (ruleDef?.type === 'streak_weeks') {
        if (currentStreakWeeks === null) {
          const streak = await this.calculateStreak(organizationId, studentId);
          currentStreakWeeks = streak.weeks;
        }
        if (currentStreakWeeks >= (ruleDef.threshold ?? 4)) {
          isEligible = true;
        }
      } else if (ruleDef?.type === 'anniversary_years') {
        const thresholdYears = ruleDef.threshold ?? 5;
        const now = new Date();
        const diffYears =
          (now.getTime() - student.created_at.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (diffYears >= thresholdYears) {
          isEligible = true;
        }
      }

      if (isEligible) {
        try {
          const award = await this.prisma.badgeAward.create({
            data: {
              organization_id: organizationId,
              student_id: studentId,
              badge_rule_id: rule.id,
            },
          });

          await this.prisma.progressEvent.create({
            data: {
              organization_id: organizationId,
              student_id: studentId,
              type: ProgressEventType.badge_awarded,
              payload: { badgeId: award.id, ruleKey: rule.key },
            },
          });

          newAwards.push({
            id: award.id,
            key: rule.key,
            name: rule.name,
            description: rule.description,
            icon: rule.icon,
            awardedAt: award.awarded_at.toISOString(),
          });
        } catch {
          // Handled if concurrent worker already awarded (unique constraint)
        }
      }
    }

    return newAwards;
  }

  getBogotaIsoWeekKey(date: Date): string {
    const bogotaDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    const [yearStr, monthStr, dayStr] = bogotaDateStr.split('-');
    const bogotaDate = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));

    // ISO week algorithm
    const day = bogotaDate.getUTCDay() || 7;
    bogotaDate.setUTCDate(bogotaDate.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(bogotaDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((bogotaDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    return `${bogotaDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  private generateIsoWeekKeys(startDate: Date, endDate: Date): string[] {
    const keys: string[] = [];
    const current = new Date(startDate.getTime());
    const seen = new Set<string>();

    while (current <= endDate) {
      const key = this.getBogotaIsoWeekKey(current);
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
      current.setUTCDate(current.getUTCDate() + 7);
    }

    const endKey = this.getBogotaIsoWeekKey(endDate);
    if (!seen.has(endKey)) {
      keys.push(endKey);
    }

    return keys;
  }
}
