'use client';

import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentProfileView, StudentProfileViewSchema } from '@upward-english/shared';
import type { EmailChangeInput, EmailChangeConfirmInput } from '@upward-english/shared';
import { Check } from 'lucide-react';
import { ErrorState } from '../../../components/error-state';
import { apiFetch, ApiError } from '../../../lib/api';
import { clearSharedProfile, getSharedSession, setSharedSession } from '../../../lib/auth-session';
import { syncUserSegment } from '../../../lib/user-segment';
import { PerfilLoading } from './perfil-loading';
import styles from './perfil-kids.module.css';
import teens from './perfil-teens.module.css';

// La API serializa la fecha civil de PostgreSQL a medianoche UTC.
const birthDateFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC' });

const themeOptions = [
  {
    segment: 'kids',
    icon: '🦊',
    title: 'Kids (Zorro Explorador)',
    summary: 'Colores cálidos, botones grandes y lectura por voz.',
  },
  {
    segment: 'teens',
    icon: '🎧',
    title: 'Teens',
    summary: 'Interfaz limpia y directa para 11 años o más.',
  },
] as const;

export function PerfilClient() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () =>
      apiFetch<StudentProfileView>('/api/v1/me', {
        schema: StudentProfileViewSchema,
      }),
  });

  const error = queryError instanceof ApiError
    ? queryError.message
    : queryError instanceof Error
      ? queryError.message
      : null;

  const [themeSuccess, setThemeSuccess] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  // Email change state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isAwaitingOtp, setIsAwaitingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const restoreEmailFocus = useRef(false);

  const themeMutation = useMutation({
    mutationFn: async (newSegment: 'kids' | 'teens') => {
      await apiFetch<void>('/api/v1/me/interface', {
        method: 'PATCH',
        body: JSON.stringify({ ageSegment: newSegment }),
      });
      return newSegment;
    },
    onSuccess: async (newSegment) => {
      clearSharedProfile();
      const session = getSharedSession();
      if (session?.student) {
        setSharedSession({ ...session, student: { ...session.student, ageSegment: newSegment } });
      } else {
        syncUserSegment(newSegment);
      }
      await queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
      setThemeSuccess(`¡Interfaz actualizada a ${newSegment === 'kids' ? 'Kids' : 'Teens'}!`);
    },
    onError: (err: unknown) => {
      setThemeError(err instanceof ApiError ? err.message : 'No se pudo actualizar la interfaz');
    },
  });

  const handleThemeChange = (newSegment: 'kids' | 'teens') => {
    if (!profile?.student?.canSwitchInterface || themeMutation.isPending) return;
    setThemeSuccess(null);
    setThemeError(null);
    themeMutation.mutate(newSegment);
  };

  const isUpdatingTheme = themeMutation.isPending;

  const requestEmailMutation = useMutation({
    gcTime: 0,
    mutationFn: (input: EmailChangeInput) =>
      apiFetch<void>('/api/v1/me/email-change', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setEmailSuccess('Código OTP enviado a tu nuevo correo. Escríbelo a continuación para confirmar.');
      setIsAwaitingOtp(true);
    },
    onError: (err: unknown) => {
      setEmailError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud');
    },
  });

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    const password = currentPassword;
    setCurrentPassword('');
    try {
      await requestEmailMutation.mutateAsync({ newEmail, password });
    } catch {
      // El mensaje se muestra en onError.
    } finally {
      requestEmailMutation.reset();
    }
  };

  const confirmEmailMutation = useMutation({
    mutationFn: (input: EmailChangeConfirmInput) =>
      apiFetch<void>('/api/v1/me/email-change/confirm', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      clearSharedProfile();
      setEmailSuccess('¡Correo actualizado exitosamente! El cambio ya está activo.');
      setIsAwaitingOtp(false);
      setIsChangingEmail(false);
      setNewEmail('');
      setOtpCode('');
      await queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
    },
    onError: (err: unknown) => {
      setEmailError(err instanceof Error ? err.message : 'No se pudo confirmar el cambio de correo');
    },
  });

  const handleConfirmEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    confirmEmailMutation.mutate({ otp: otpCode.trim() });
  };

  const isSubmittingEmail = requestEmailMutation.isPending || confirmEmailMutation.isPending;

  const cancelEmailChange = () => {
    setIsChangingEmail(false);
    setIsAwaitingOtp(false);
    setNewEmail('');
    setCurrentPassword('');
    setOtpCode('');
    setEmailError(null);
    setEmailSuccess(null);
  };

  if (isLoading) {
    return <PerfilLoading />;
  }

  if (error || !profile) {
    return (
      <>
        <div className={styles.kidsError}>
          {isFetching ? (
            <PerfilLoading />
          ) : (
            <ErrorState
              variant="kids"
              message="No pudimos cargar tu perfil. Intenta otra vez."
              onRetry={() => void refetch()}
            />
          )}
        </div>
        <div className={teens.errorState}>
          {isFetching ? (
            <PerfilLoading />
          ) : (
            <ErrorState
              variant="teens"
              message="No pudimos cargar tu perfil. Intenta otra vez."
              onRetry={() => void refetch()}
            />
          )}
        </div>
      </>
    );
  }

  const { user, student } = profile;
  const currentSegment = student?.ageSegment ?? 'kids';
  const isKids = currentSegment === 'kids';
  const card = isKids ? styles.card : teens.card;
  const description = isKids ? styles.description : teens.description;
  const success = isKids
    ? `${styles.notice} ${styles.success}`
    : `${teens.notice} ${teens.success}`;
  const failure = isKids
    ? `${styles.notice} ${styles.error}`
    : `${teens.notice} ${teens.failure}`;
  const form = isKids ? styles.form : teens.form;
  const input = isKids ? styles.input : teens.input;
  const actions = isKids ? styles.actions : teens.actions;
  const primary = isKids
    ? `${styles.button} ${styles.primary}`
    : `${teens.button} ${teens.primary}`;
  const secondary = isKids ? styles.button : teens.button;
  const birthDate = student?.birthDate ? new Date(student.birthDate) : null;
  const formattedBirthDate = birthDate && !Number.isNaN(birthDate.getTime())
    ? birthDateFormat.format(birthDate)
    : '—';
  const initial = Array.from(user.name.trim())[0]?.toLocaleUpperCase('es-CO') || '?';

  return (
    <div className={isKids ? styles.page : teens.page}>
      {!isKids && <h1>Mi Perfil</h1>}

      <section className={card} aria-labelledby="profile-title">
        {isKids ? (
          <div className={styles.cardHeader}>
            <span className={styles.avatar} aria-hidden="true">
              {initial}
            </span>
            <h1 id="profile-title">Mi perfil: Credencial de Explorador</h1>
          </div>
        ) : (
          <div className={teens.cardHeader}>
            <span className={teens.avatar} aria-hidden="true">{initial}</span>
            <h2 id="profile-title">Credencial de estudiante</h2>
          </div>
        )}

        <dl className={isKids ? styles.fields : teens.columns}>
          {[
            ['Nombre completo', user.name],
            ['Correo electrónico', user.email],
            [isKids ? 'Nivel asignado' : 'Nivel MCER', student?.level ? `Nivel ${student.level}` : 'Sin asignar'],
            ['Fecha de nacimiento', formattedBirthDate],
          ].map(([title, value]) => (
            <div key={title} className="min-w-0">
              <dt>{title}</dt>
              <dd className={isKids && title === 'Nivel asignado' && student?.level ? styles.level : undefined}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className={isKids ? description : teens.readOnly}>
          Solo tu profesora puede actualizar los datos de contacto de tu acudiente.
        </p>
      </section>

      <section className={card} aria-labelledby="profile-appearance">
        <h2 id="profile-appearance">Apariencia del portal</h2>

        {themeError && <p className={failure} role="alert">{themeError}</p>}
        {themeSuccess && <p className={success} role="status">{themeSuccess}</p>}
        {isUpdatingTheme && <p className={description} role="status">Cambiando la apariencia…</p>}

        {student?.canSwitchInterface ? (
          <>
            <div className={isKids ? styles.themeOptions : teens.columns}>
              {themeOptions.map(({ segment, icon, title, summary }) => {
                const isActive = currentSegment === segment;
                return (
                  <button
                    key={segment}
                    type="button"
                    disabled={isUpdatingTheme || isActive}
                    aria-pressed={isActive}
                    onClick={() => handleThemeChange(segment)}
                    className={isKids ? styles.themeOption : teens.themeOption}
                  >
                    <span className={isKids ? styles.themeOptionTitle : teens.themeOptionTitle}>
                      {isKids && <span aria-hidden="true">{icon}</span>}
                      {title}
                      {isActive && <Check size={18} aria-hidden="true" />}
                    </span>
                    <small>
                      {!isKids && segment === 'kids'
                        ? 'Interfaz más ilustrada con botón Escuchar en cada consigna.'
                        : summary}
                    </small>
                  </button>
                );
              })}
            </div>
            <p className={description}>
              Puedes cambiar de apariencia cuando quieras. Cumplir años nunca cambia tu interfaz automáticamente.
            </p>
          </>
        ) : isKids ? (
          <p className={styles.activeTheme}>Tu apariencia actual es <strong>Kids · Zorro Explorador</strong>.</p>
        ) : (
          <p className={teens.readOnly}>Tu apariencia actual es <strong>Teens</strong>.</p>
        )}
      </section>

      <section className={card} aria-labelledby="profile-security">
        <h2 id="profile-security">Seguridad de la cuenta</h2>
        <p className={description}>
          Si necesitas actualizar tu correo electrónico registrado, puedes solicitarlo aquí.
        </p>

        {emailSuccess && <p className={success} role="status">{emailSuccess}</p>}
        {emailError && <p className={failure} role="alert">{emailError}</p>}
        {!isKids && isSubmittingEmail && !emailSuccess && (
          <p role="status" className={description}>
            {isAwaitingOtp ? 'Confirmando el correo…' : 'Enviando el código…'}
          </p>
        )}

        {!isChangingEmail ? (
          <button
            type="button"
            ref={(button) => {
              if (button && restoreEmailFocus.current) {
                button.focus();
                restoreEmailFocus.current = false;
              }
            }}
            onClick={() => {
              restoreEmailFocus.current = true;
              setIsChangingEmail(true);
              setEmailSuccess(null);
              setEmailError(null);
            }}
            className={`${secondary} ${isKids ? styles.openButton : teens.openButton}`}
          >
            Cambiar correo electrónico
          </button>
        ) : (
          <form onSubmit={isAwaitingOtp ? handleConfirmEmailChange : handleRequestEmailChange} className={form}>
            {isAwaitingOtp ? (
              <div key="confirm-email">
                <label htmlFor="otp-code">Código de verificación OTP</label>
                <p className={description} id="otp-destination">Enviado a {newEmail}</p>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  aria-describedby="otp-destination"
                  required
                  readOnly={!isKids && isSubmittingEmail}
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className={isKids ? input : `${input} ${teens.otp}`}
                />
              </div>
            ) : (
              <>
                <div key="new-email">
                  <label htmlFor="new-email">Nuevo correo electrónico</label>
                  <input
                    id="new-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={isSubmittingEmail}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="alumno.nuevo@colegio.edu"
                    className={input}
                  />
                </div>
                <div key="current-password">
                  <label htmlFor="current-password">Contraseña actual para confirmar</label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={isSubmittingEmail}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className={input}
                  />
                </div>
              </>
            )}

            <div className={actions}>
              <button
                type="submit"
                disabled={isSubmittingEmail || (isAwaitingOtp && !/^\d{6}$/.test(otpCode))}
                className={isKids ? `${primary} disabled:opacity-50` : primary}
              >
                {isAwaitingOtp
                  ? (isSubmittingEmail ? 'Confirmando…' : 'Confirmar nuevo correo')
                  : (isSubmittingEmail ? 'Enviando…' : 'Solicitar cambio')}
              </button>
              <button type="button" disabled={isSubmittingEmail} onClick={cancelEmailChange} className={secondary}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
