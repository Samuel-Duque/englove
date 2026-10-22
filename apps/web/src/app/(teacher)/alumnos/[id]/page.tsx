'use client';

import React, { useState, useEffect, useCallback, use, Suspense } from 'react';
import Link from 'next/link';
import {
  StudentView,
  GroupView,
  GroupListResponse,
  MembershipView,
  MembershipListResponse,
  Level,
  MessageResponse,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../../lib/api';

function StudentDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [student, setStudent] = useState<StudentView | null>(null);
  const [memberships, setMemberships] = useState<MembershipView[]>([]);
  const [activeGroups, setActiveGroups] = useState<GroupView[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Group transfer state
  const [selectedDestinationGroup, setSelectedDestinationGroup] = useState<string>('');
  const [isTransferringGroup, setIsTransferringGroup] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editLevel, setEditLevel] = useState<Level>(Level.A1);
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editGuardianContact, setEditGuardianContact] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Email Modal state (RF-18, RF-19, Decision 63)
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);

  const loadStudentData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [studentData, membershipsData, groupsData] = await Promise.all([
        apiFetch<StudentView>(`/api/v1/students/${id}`),
        apiFetch<MembershipListResponse>(`/api/v1/students/${id}/memberships?limit=100`),
        apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100'),
      ]);

      setStudent(studentData);
      setMemberships(membershipsData.items);
      setActiveGroups(groupsData.items);

      // Pre-populate profile edit state
      setEditName(studentData.name);
      setEditBirthDate(studentData.birthDate);
      setEditLevel(studentData.level ?? Level.A1);
      setEditGuardianName(studentData.guardianName ?? '');
      setEditGuardianContact(studentData.guardianContact ?? '');

      if (groupsData.items.length > 0) {
        setSelectedDestinationGroup(studentData.groupId ?? groupsData.items[0]?.id ?? '');
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Error al cargar la información del alumno');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  // Group transfer handler
  const handleGroupTransfer = async () => {
    if (!selectedDestinationGroup || selectedDestinationGroup === student?.groupId) return;

    setIsTransferringGroup(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await apiFetch<StudentView>(`/api/v1/students/${id}/group`, {
        method: 'PUT',
        body: JSON.stringify({ groupId: selectedDestinationGroup }),
      });
      setStudent(updated);
      setSuccess('Grupo actualizado exitosamente.');
      // Refresh memberships history
      const memData = await apiFetch<MembershipListResponse>(`/api/v1/students/${id}/memberships?limit=100`);
      setMemberships(memData.items);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_ARCHIVED') {
          setError('El grupo de destino está archivado y no acepta alumnos.');
        } else if (err.code === 'STUDENT_NOT_APPROVED') {
          setError('El alumno debe estar aprobado para ser trasladado.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo trasladar de grupo al alumno');
      }
    } finally {
      setIsTransferringGroup(false);
    }
  };

  // Profile update handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        birthDate: editBirthDate || undefined,
        guardianName: editGuardianName.trim() || undefined,
        guardianContact: editGuardianContact.trim() || undefined,
      };
      if (student?.approvalStatus === 'approved') {
        payload.level = editLevel;
      }

      const updated = await apiFetch<StudentView>(`/api/v1/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setStudent(updated);
      setIsEditingProfile(false);
      setSuccess('Ficha del alumno actualizada.');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo guardar la información del alumno');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password reset handler
  const handleSendPasswordReset = async () => {
    if (!window.confirm('¿Deseas enviar un enlace de recuperación de contraseña al correo del alumno?')) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<MessageResponse>(`/api/v1/students/${id}/reset-password`, {
        method: 'POST',
      });
      setSuccess(res.message || 'Enlace de recuperación enviado al correo del alumno.');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo solicitar la recuperación de contraseña');
    }
  };

  // Change Email handler (RF-18, RF-19, Decision 63)
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityConfirmed) {
      setChangeEmailError('Debes confirmar que verificaste la identidad del alumno.');
      return;
    }

    setIsSubmittingEmail(true);
    setChangeEmailError(null);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch<MessageResponse>(`/api/v1/students/${id}/change-email`, {
        method: 'POST',
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });

      setSuccess(res.message);
      setIsChangeEmailOpen(false);
      setNewEmail('');
      setIdentityConfirmed(false);
      // Reload student data to reflect new email
      loadStudentData();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_TAKEN') {
          setChangeEmailError('Ese correo no está disponible');
        } else {
          setChangeEmailError(err.message);
        }
      } else {
        setChangeEmailError('Error al cambiar el correo');
      }
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-center text-zinc-500 text-sm">Cargando ficha del alumno…</div>;
  }

  if (!student) {
    return (
      <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-6 text-center text-rose-800">
        Alumno no encontrado
      </div>
    );
  }

  const activeMembership = memberships.find((m) => m.leftAt === null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/alumnos" className="hover:text-zinc-900">
          Alumnos
        </Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium truncate">{student.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{student.name}</h1>
          <p className="text-sm text-zinc-600">{student.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendPasswordReset}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 min-h-[44px]"
          >
            Enviar enlace de recuperación
          </button>

          <button
            type="button"
            onClick={() => {
              setIsChangeEmailOpen(true);
              setChangeEmailError(null);
              setIdentityConfirmed(false);
              setNewEmail('');
            }}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 min-h-[44px]"
          >
            Cambiar correo de acceso
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex justify-between items-center"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex justify-between items-center"
        >
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Profile Details Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h2 className="text-base font-bold text-zinc-900">Datos personales y pedagógicos</h2>
          {!isEditingProfile && (
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              Editar datos
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-name" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>

              <div>
                <label htmlFor="edit-bdate" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Fecha de nacimiento (YYYY-MM-DD)
                </label>
                <input
                  id="edit-bdate"
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>

              <div>
                <label htmlFor="edit-lvl" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nivel pedagógico {student?.approvalStatus === 'approved' ? '*' : '(no asignado aún)'}
                </label>
                {student?.approvalStatus === 'approved' ? (
                  <select
                    id="edit-lvl"
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value as Level)}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  >
                    <option value={Level.A1}>A1</option>
                    <option value={Level.A2}>A2</option>
                    <option value={Level.B1}>B1</option>
                    <option value={Level.B2}>B2</option>
                  </select>
                ) : (
                  <p className="text-xs text-zinc-500 py-2">
                    El nivel pedagógico se asigna automáticamente al aprobar la solicitud del alumno.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="edit-gname" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nombre del acudiente
                </label>
                <input
                  id="edit-gname"
                  type="text"
                  maxLength={200}
                  value={editGuardianName}
                  onChange={(e) => setEditGuardianName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="edit-gcontact" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Contacto del acudiente (teléfono / correo)
                </label>
                <input
                  id="edit-gcontact"
                  type="text"
                  maxLength={200}
                  value={editGuardianContact}
                  onChange={(e) => setEditGuardianContact(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingProfile ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-zinc-500">Nivel actual</span>
              <span className="font-bold text-zinc-900">{student.level ?? 'Sin nivel'}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-zinc-500">Segmento</span>
              <span className="font-semibold text-zinc-900 capitalize">{student.ageSegment}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-zinc-500">Nacimiento</span>
              <span className="font-medium text-zinc-900">{student.birthDate}</span>
            </div>
            <div>
              <span className="block text-xs font-medium text-zinc-500">Acudiente</span>
              <span className="font-medium text-zinc-900">
                {student.guardianName || 'No registrado'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Group Transfer Card (Atomic, 1 active group per student, Decision 73 & 90) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-2">
          Grupo asignado
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs text-zinc-500">Grupo actual:</span>
            <p className="text-base font-semibold text-zinc-900">
              {activeMembership?.groupName || 'Sin grupo activo'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDestinationGroup}
              onChange={(e) => setSelectedDestinationGroup(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
            >
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleGroupTransfer}
              disabled={isTransferringGroup || selectedDestinationGroup === student.groupId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 min-h-[40px]"
            >
              {isTransferringGroup ? 'Trasladando…' : 'Cambiar de grupo'}
            </button>
          </div>
        </div>
      </div>

      {/* Membership History Table (RF-12) */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-2">
          Historial de membresías
        </h2>

        {memberships.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">
            No registra historial de grupos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Grupo
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Fecha de ingreso
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Fecha de salida
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-600 uppercase">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {memberships.map((m) => {
                  const isCurrent = m.leftAt === null;
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        {m.groupName}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {m.leftAt ? new Date(m.leftAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {isCurrent ? 'Vigente' : 'Finalizada'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change Email Dialog (RF-18, RF-19, Decision 63) */}
      {isChangeEmailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="text-lg font-bold text-zinc-900">
                Cambiar correo de acceso
              </h2>
              <button
                type="button"
                onClick={() => setIsChangeEmailOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {changeEmailError && (
              <div
                role="alert"
                className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800"
              >
                {changeEmailError}
              </div>
            )}

            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-zinc-500 mb-1">Correo actual:</span>
                <p className="text-sm font-semibold text-zinc-900 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                  {student.email}
                </p>
              </div>

              <div>
                <label htmlFor="change-new-email" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nuevo correo electrónico *
                </label>
                <input
                  id="change-new-email"
                  type="email"
                  required
                  maxLength={255}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nuevo.correo@example.com"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Mandatory unchecked verification checkbox (RF-18) */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 text-xs text-zinc-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Confirmo que verifiqué la identidad del alumno.</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsChangeEmailOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEmail || !identityConfirmed || !newEmail.trim()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isSubmittingEmail ? 'Actualizando…' : 'Confirmar cambio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando ficha del alumno…</div>}>
      <StudentDetailContent params={params} />
    </Suspense>
  );
}
