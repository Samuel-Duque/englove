import { getSharedSession } from './auth-session';

export type UserSegment = 'kids' | 'teens' | 'teacher';

export const USER_SEGMENT_KEY = 'englove_segment';
export const USER_SEGMENT_EVENT = 'englove_segment_change';

/**
 * Type guard for UserSegment without blind type assertions.
 */
export function isUserSegment(value: unknown): value is UserSegment {
  return value === 'kids' || value === 'teens' || value === 'teacher';
}

/**
 * Determines whether the user segment corresponds to Teens or Teacher (panel)
 * rather than Kids.
 */
export function isTeensOrTeacherSegment(segment?: string | null): boolean {
  return segment === 'teens' || segment === 'teacher';
}

/**
 * Syncs the user's active segment to localStorage under `englove_segment`
 * and dispatches an in-tab event so offline pages and PWA update banners have
 * immediate, reactive access to the real segment without waiting for cross-tab events.
 */
export function syncUserSegment(segment: UserSegment | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (segment) {
      window.localStorage.setItem(USER_SEGMENT_KEY, segment);
    } else {
      window.localStorage.removeItem(USER_SEGMENT_KEY);
    }
  } catch {
    // Ignore if localStorage is unavailable
  }

  try {
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(USER_SEGMENT_EVENT, { detail: segment }));
    }
  } catch {
    // Ignore event dispatch errors
  }
}

/**
 * Resolves the real segment of the current user (SPEC-09 §7, RF-7, P2-10).
 * Checks in order:
 * 1. Active shared in-memory session (role === 'teacher' | 'admin' -> 'teacher', else student.ageSegment)
 * 2. Current route pathname (panel routes -> 'teacher')
 * 3. `englove_segment` in localStorage
 * 4. `data-theme` attribute on document.documentElement
 * Defaults to 'kids' if unauthenticated or unknown.
 */
export function resolveUserSegment(): UserSegment {
  if (typeof window === 'undefined') return 'kids';

  // 1. In-memory session if available
  const session = getSharedSession();
  const role = session?.user?.role;
  if (role === 'teacher' || role === 'admin') {
    return 'teacher';
  }
  const studentAgeSegment = session?.student?.ageSegment;
  if (isUserSegment(studentAgeSegment)) {
    return studentAgeSegment;
  }

  // 2. Active route pathname for teacher / panel views
  try {
    const pathname = window.location.pathname;
    if (
      pathname.startsWith('/alumnos') ||
      pathname.startsWith('/actividades') ||
      pathname.startsWith('/asignaciones') ||
      pathname.startsWith('/revision') ||
      pathname.startsWith('/estadisticas') ||
      pathname.startsWith('/grupos')
    ) {
      return 'teacher';
    }
  } catch {
    // Ignore pathname errors
  }

  // 3. LocalStorage key written on login / session sync
  try {
    const stored = window.localStorage.getItem(USER_SEGMENT_KEY);
    if (isUserSegment(stored)) {
      return stored;
    }
    const theme = window.localStorage.getItem('theme');
    if (theme === 'teens' || theme === 'kids') {
      return theme;
    }
  } catch {
    // Ignore localStorage errors
  }

  // 4. Document data-theme
  try {
    const docTheme = document.documentElement.getAttribute('data-theme');
    if (docTheme === 'teens') return 'teens';
    if (docTheme === 'teacher') return 'teacher';
  } catch {
    // Ignore DOM errors
  }

  return 'kids';
}
