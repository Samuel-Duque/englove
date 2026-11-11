'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentProfileView } from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { clearSharedProfile } from '../../../lib/auth-session';
import { syncUserSegment } from '../../../lib/user-segment';

export function PerfilClient() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error: queryError } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => apiFetch<StudentProfileView>('/api/v1/me'),
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

  const themeMutation = useMutation({
    mutationFn: async (newSegment: 'kids' | 'teens') => {
      await apiFetch<void>('/api/v1/me/interface', {
        method: 'PATCH',
        body: JSON.stringify({ ageSegment: newSegment }),
      });
      return newSegment;
    },
    onSuccess: (newSegment) => {
      clearSharedProfile();
      syncUserSegment(newSegment);
      setThemeSuccess(`¡Interfaz actualizada a ${newSegment === 'kids' ? 'Kids' : 'Teens'}!`);
      void queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
      window.location.reload();
    },
    onError: (err: unknown) => {
      setThemeError(err instanceof ApiError ? err.message : 'No se pudo actualizar la interfaz');
    },
  });

  const handleThemeChange = (newSegment: 'kids' | 'teens') => {
    if (!profile?.student?.canSwitchInterface) return;
    setThemeSuccess(null);
    setThemeError(null);
    themeMutation.mutate(newSegment);
  };

  const isUpdatingTheme = themeMutation.isPending;

  const requestEmailMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/v1/me/email-change', {
        method: 'POST',
        body: JSON.stringify({
          newEmail,
          currentPassword,
        }),
      }),
    onSuccess: () => {
      setEmailSuccess('Código OTP enviado a tu nuevo correo. Escríbelo a continuación para confirmar.');
      setIsAwaitingOtp(true);
      setCurrentPassword('');
    },
    onError: (err: unknown) => {
      setEmailError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud');
    },
  });

  const handleRequestEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    requestEmailMutation.mutate();
  };

  const confirmEmailMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>('/api/v1/me/email-change/confirm', {
        method: 'POST',
        body: JSON.stringify({
          newEmail,
          otp: otpCode.trim(),
        }),
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
    confirmEmailMutation.mutate();
  };

  const isSubmittingEmail = requestEmailMutation.isPending || confirmEmailMutation.isPending;

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="mt-3 text-sm font-semibold opacity-70">Cargando tu perfil…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="py-12 text-center bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-lg font-bold text-rose-900 mt-2">Error al cargar perfil</h2>
        <p className="text-sm text-rose-700 mt-1">{error || 'Intenta de nuevo más tarde'}</p>
      </div>
    );
  }

  const { user, student } = profile;
  const currentSegment = student?.ageSegment ?? 'kids';

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-amber-950">Tu Perfil de Alumno 👤</h1>
        <p className="text-sm font-medium opacity-80 mt-1">
          Información personal, configuración de interfaz y seguridad de tu cuenta.
        </p>
      </div>

      {themeSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-emerald-900 text-sm font-bold">
          {themeSuccess}
        </div>
      )}

      {/* Profile Details Card */}
      <div className="rounded-3xl border border-amber-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-lg font-black text-amber-950 border-b border-amber-100 pb-3">
          Datos de la cuenta
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              Nombre completo
            </span>
            <p className="text-base font-extrabold text-amber-950 mt-0.5">{user.name}</p>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              Correo electrónico
            </span>
            <p className="text-base font-extrabold text-amber-950 mt-0.5">{user.email}</p>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              Nivel asignado
            </span>
            <p className="text-base font-extrabold text-amber-950 mt-0.5">
              {student?.level ? `Nivel ${student.level}` : 'Sin asignar'}
            </p>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
              Fecha de nacimiento civil
            </span>
            <p className="text-base font-extrabold text-amber-950 mt-0.5">
              {student?.birthDate ? new Date(student.birthDate).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Interface Preference Card */}
      <div className="rounded-3xl border border-amber-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-amber-100 pb-3">
          <h2 className="text-lg font-black text-amber-950">Tema de Interfaz 🎨</h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
              currentSegment === 'kids'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            Tema actual: {currentSegment}
          </span>
        </div>

        {themeError && (
          <div className="rounded-xl bg-rose-50 border border-rose-300 p-3 text-xs font-bold text-rose-900" role="alert">
            {themeError}
          </div>
        )}

        {student?.canSwitchInterface ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              disabled={isUpdatingTheme || currentSegment === 'kids'}
              onClick={() => handleThemeChange('kids')}
              className={`p-5 rounded-2xl border-2 text-left transition-all ${
                currentSegment === 'kids'
                  ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                  : 'border-zinc-200 hover:border-amber-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🧸</span>
                <h3 className="font-extrabold text-base text-amber-950">Kids (7 a 10 años)</h3>
              </div>
              <p className="text-xs text-zinc-600">
                Colores cálidos, botones grandes, tipografía amigable y lectura por voz integrada.
              </p>
            </button>

            <button
              type="button"
              disabled={isUpdatingTheme || currentSegment === 'teens'}
              onClick={() => handleThemeChange('teens')}
              className={`p-5 rounded-2xl border-2 text-left transition-all ${
                currentSegment === 'teens'
                  ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                  : 'border-zinc-200 hover:border-indigo-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎧</span>
                <h3 className="font-extrabold text-base text-zinc-900">Teens (11 a 14 años)</h3>
              </div>
              <p className="text-xs text-zinc-600">
                Interfaz minimalista, paleta sobria en tonos oscuros y vista de actividades condensada.
              </p>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-4 text-xs text-amber-900 leading-relaxed">
            ℹ️ La alternancia voluntaria de interfaz se habilitará automáticamente al cumplir 11 años de edad (RF-24).
          </div>
        )}
      </div>

      {/* Security and Email Change */}
      <div className="rounded-3xl border border-amber-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-lg font-black text-amber-950">Seguridad de la cuenta 🔒</h2>
        <p className="text-xs text-zinc-600">
          Si necesitas actualizar tu correo electrónico registrado, puedes solicitarlo aquí.
        </p>

        {emailSuccess && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-900">
            {emailSuccess}
          </div>
        )}

        {emailError && (
          <div className="rounded-xl bg-rose-50 border border-rose-300 p-3 text-xs font-bold text-rose-900">
            {emailError}
          </div>
        )}

        {!isChangingEmail ? (
          <button
            type="button"
            onClick={() => {
              setIsChangingEmail(true);
              setIsAwaitingOtp(false);
              setEmailSuccess(null);
              setEmailError(null);
            }}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cambiar correo electrónico
          </button>
        ) : isAwaitingOtp ? (
          <form onSubmit={handleConfirmEmailChange} className="space-y-4 max-w-md pt-2">
            <div>
              <label htmlFor="otp-code" className="text-xs font-bold text-zinc-700 block mb-1">
                Código de verificación OTP (enviado a {newEmail})
              </label>
              <input
                id="otp-code"
                aria-label="Código de verificación OTP"
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base font-mono tracking-widest text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmittingEmail || otpCode.trim().length < 6}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-4 py-2 text-xs shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmittingEmail ? 'Confirmando…' : 'Confirmar nuevo correo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAwaitingOtp(false);
                  setIsChangingEmail(false);
                  setOtpCode('');
                }}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRequestEmailChange} className="space-y-4 max-w-md pt-2">
            <div>
              <label htmlFor="new-email" className="text-xs font-bold text-zinc-700 block mb-1">
                Nuevo correo electrónico
              </label>
              <input
                id="new-email"
                aria-label="Nuevo correo electrónico"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="alumno.nuevo@colegio.edu"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label htmlFor="current-password" className="text-xs font-bold text-zinc-700 block mb-1">
                Contraseña actual para confirmar
              </label>
              <input
                id="current-password"
                aria-label="Contraseña actual para confirmar"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmittingEmail}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-4 py-2 text-xs shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmittingEmail ? 'Enviando…' : 'Solicitar cambio'}
              </button>
              <button
                type="button"
                onClick={() => setIsChangingEmail(false)}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
