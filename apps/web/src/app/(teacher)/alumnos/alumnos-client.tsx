'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StudentView,
  StudentViewSchema,
  StudentListResponse,
  StudentListResponseSchema,
  GroupListResponse,
  GroupListResponseSchema,
  Level,
  AgeSegment,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ConfirmDialog, AccessibleModal } from '../../../components/ui/modal';

function isLevel(val: string): val is Level {
  return val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2;
}

function isAgeSegment(val: string): val is AgeSegment {
  return val === AgeSegment.kids || val === AgeSegment.teens;
}

function StudentsManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const rawTab = searchParams.get('tab');
  const initialTab: 'students' | 'requests' | 'locked' =
    rawTab === 'requests' || rawTab === 'locked' ? rawTab : 'students';

  const [activeTab, setActiveTab] = useState<'students' | 'requests' | 'locked'>(initialTab);

  // UI state
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Approve Modal state
  const [approvingStudent, setApprovingStudent] = useState<StudentView | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level>(Level.A1);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [ageSegment, setAgeSegment] = useState<AgeSegment>(AgeSegment.kids);
  const [rejectConfirmDialog, setRejectConfirmDialog] = useState<{
    isOpen: boolean;
    student: StudentView | null;
  }>({ isOpen: false, student: null });

  // Sync tab with URL
  const handleTabChange = (tab: 'students' | 'requests' | 'locked') => {
    setActiveTab(tab);
    setActionError(null);
    setSuccess(null);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/alumnos?${params.toString()}`);
  };

  const studentsQuery = useQuery({
    queryKey: ['teacher', 'students', 'all'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'students',
  });

  const requestsQuery = useQuery({
    queryKey: ['teacher', 'students', 'requests'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students/requests?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'requests',
  });

  const lockedQuery = useQuery({
    queryKey: ['teacher', 'students', 'locked'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students/locked?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'locked',
  });

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: () =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
      }),
  });

  const groups = groupsQuery.data?.items || [];
  const students = studentsQuery.data?.items || [];
  const requests = requestsQuery.data?.items || [];
  const locked = lockedQuery.data?.items || [];

  const isLoading =
    (activeTab === 'students' && studentsQuery.isLoading) ||
    (activeTab === 'requests' && requestsQuery.isLoading) ||
    (activeTab === 'locked' && lockedQuery.isLoading);

  const approveMutation = useMutation({
    mutationFn: (body: {
      studentId: string;
      level: Level;
      groupId: string;
      guardianName?: string;
      guardianContact?: string;
      ageSegment: AgeSegment;
    }) =>
      apiFetch<StudentView>(`/api/v1/students/${body.studentId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          level: body.level,
          groupId: body.groupId,
          guardianName: body.guardianName,
          guardianContact: body.guardianContact,
          ageSegment: body.ageSegment,
        }),
        schema: StudentViewSchema,
      }),
    onSuccess: (_, variables) => {
      const studentName = approvingStudent?.name || variables.studentId;
      setSuccess(`Alumno "${studentName}" aprobado exitosamente.`);
      setApprovingStudent(null);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo aprobar al alumno');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/v1/students/${studentId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/v1/students/${studentId}/unlock`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo desbloquear la cuenta');
    },
  });

  // Handle Approve button click
  const openApproveModal = (student: StudentView) => {
    setApprovingStudent(student);
    setSelectedLevel(student.level ?? Level.A1);
    setGuardianName(student.guardianName ?? '');
    setGuardianContact(student.guardianContact ?? '');
    setAgeSegment(student.ageSegment ?? AgeSegment.kids);
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0]?.id ?? '');
    }
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingStudent) return;
    if (!selectedGroupId) {
      setActionError('Debes seleccionar un grupo activo para aprobar al alumno');
      return;
    }

    setActionError(null);
    setSuccess(null);

    approveMutation.mutate({
      studentId: approvingStudent.id,
      level: selectedLevel,
      groupId: selectedGroupId,
      guardianName: guardianName.trim() || undefined,
      guardianContact: guardianContact.trim() || undefined,
      ageSegment,
    });
  };

  const isSubmittingApproval = approveMutation.isPending;

  const handleReject = (student: StudentView) => {
    setRejectConfirmDialog({ isOpen: true, student });
  };

  const handleConfirmReject = () => {
    const student = rejectConfirmDialog.student;
    setRejectConfirmDialog({ isOpen: false, student: null });
    if (!student) return;

    setActionError(null);
    setSuccess(null);
    rejectMutation.mutate(student.id, {
      onSuccess: () => {
        setSuccess(`Solicitud de "${student.name}" rechazada.`);
      },
    });
  };

  const handleUnlock = (student: StudentView) => {
    setActionError(null);
    setSuccess(null);
    unlockMutation.mutate(student.id, {
      onSuccess: () => {
        setSuccess(`Cuenta de "${student.name}" desbloqueada exitosamente.`);
      },
    });
  };

  const error =
    actionError ||
    (studentsQuery.error instanceof ApiError ? studentsQuery.error.message : studentsQuery.error instanceof Error ? studentsQuery.error.message : null) ||
    (requestsQuery.error instanceof ApiError ? requestsQuery.error.message : requestsQuery.error instanceof Error ? requestsQuery.error.message : null) ||
    (lockedQuery.error instanceof ApiError ? lockedQuery.error.message : lockedQuery.error instanceof Error ? lockedQuery.error.message : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Gestión de Alumnos
        </h1>
        <p className="text-sm text-zinc-600">
          Administra estudiantes inscritos, solicitudes de acceso y desbloqueo de cuentas.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex justify-between items-center"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-600 font-bold ml-4">
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

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" aria-label="Pestañas de alumnos">
          <button
            type="button"
            onClick={() => handleTabChange('students')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-semibold text-sm transition-colors ${
              activeTab === 'students'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            Alumnos inscritos
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('requests')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <span>Solicitudes de registro</span>
            {requests.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                {requests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('locked')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-semibold text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'locked'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <span>Bloqueados</span>
            {locked.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                {locked.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab 1: Alumnos inscritos */}
      {activeTab === 'students' && (
        <div>
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Cargando alumnos…</div>
          ) : students.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
              <p className="text-base font-semibold text-zinc-800">No hay alumnos registrados</p>
              <p className="mt-1 text-sm text-zinc-500">
                Los alumnos se registran desde el enlace de registro de tu institución y aparecen en la pestaña de Solicitudes.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Nivel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Segmento
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">
                      Ficha
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {students.map((st) => (
                    <tr key={st.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-zinc-900">
                        <Link href={`/alumnos/${st.id}`} className="hover:text-blue-600">
                          {st.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                        {st.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-zinc-100 text-zinc-800">
                          {st.level ?? 'Sin nivel'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 capitalize">
                        {st.ageSegment}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                        <Link
                          href={`/alumnos/${st.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Ver ficha →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Solicitudes de registro */}
      {activeTab === 'requests' && (
        <div>
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Cargando solicitudes…</div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
              <p className="text-base font-semibold text-zinc-800">
                No tienes solicitudes pendientes
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Aquí aparecerán los nuevos registros de alumnos para que les asignes nivel y grupo.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Alumno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Nacimiento / Segmento
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-zinc-900">
                        {req.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                        {req.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                        {req.birthDate} ({req.ageSegment})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-3">
                        <button
                          type="button"
                          onClick={() => openApproveModal(req)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(req)}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          Rechazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Bloqueados */}
      {activeTab === 'locked' && (
        <div>
          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">Cargando bloqueados…</div>
          ) : locked.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
              <p className="text-base font-semibold text-zinc-800">
                No hay alumnos bloqueados
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Las cuentas temporalmente bloqueadas por intentos fallidos aparecerán aquí para desbloqueo inmediato.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Alumno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Correo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase">
                      Bloqueado hasta
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {locked.map((st) => (
                    <tr key={st.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-zinc-900">
                        {st.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                        {st.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-rose-600 font-medium">
                        {st.lockedUntil ? new Date(st.lockedUntil).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' }) : 'Bloqueado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => handleUnlock(st)}
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800"
                        >
                          Desbloquear en 1 clic
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      <AccessibleModal
        isOpen={Boolean(approvingStudent)}
        onClose={() => setApprovingStudent(null)}
        title={`Aprobar alumno: ${approvingStudent?.name ?? ''}`}
        maxWidthClass="max-w-lg"
      >
        {groups.length === 0 ? (
          <div className="py-4 text-center space-y-3">
            <p className="text-sm text-amber-800 bg-amber-50 p-4 rounded-lg border border-amber-200">
              No tienes ningún grupo activo. Debes crear un grupo antes de poder aprobar alumnos.
            </p>
            <Link
              href="/grupos"
              className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ir a Crear Grupo
            </Link>
          </div>
        ) : (
          <form onSubmit={handleConfirmApproval} className="space-y-4">
            {/* Level */}
            <div>
              <label htmlFor="approve-level" className="block text-xs font-semibold text-zinc-700 mb-1">
                Nivel pedagógico inicial *
              </label>
              <select
                id="approve-level"
                value={selectedLevel}
                onChange={(e) => {
                  if (isLevel(e.target.value)) setSelectedLevel(e.target.value);
                }}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                <option value={Level.A1}>A1</option>
                <option value={Level.A2}>A2</option>
                <option value={Level.B1}>B1</option>
                <option value={Level.B2}>B2</option>
              </select>
            </div>

            {/* Group (Strictly 1 active group per student, Decision 73) */}
            <div>
              <label htmlFor="approve-group" className="block text-xs font-semibold text-zinc-700 mb-1">
                Grupo asignado * (Un solo grupo vigente por alumno)
              </label>
              <select
                id="approve-group"
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.activeStudentCount} miembros)
                  </option>
                ))}
              </select>
            </div>

            {/* Informacion del acudiente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="approve-guardian" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nombre del acudiente (opcional)
                </label>
                <input
                  id="approve-guardian"
                  type="text"
                  maxLength={200}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>

              <div>
                <label htmlFor="approve-contact" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Contacto del acudiente (opcional)
                </label>
                <input
                  id="approve-contact"
                  type="text"
                  maxLength={200}
                  value={guardianContact}
                  onChange={(e) => setGuardianContact(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </div>
            </div>

            {/* Pedagogical Segment correction */}
            <div>
              <label htmlFor="approve-segment" className="block text-xs font-semibold text-zinc-700 mb-1">
                Segmento pedagógico
              </label>
              <select
                id="approve-segment"
                value={ageSegment}
                onChange={(e) => {
                  if (isAgeSegment(e.target.value)) setAgeSegment(e.target.value);
                }}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                <option value={AgeSegment.kids}>Kids (7 a 10 años)</option>
                <option value={AgeSegment.teens}>Teens (11 a 14 años)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setApprovingStudent(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingApproval || !selectedGroupId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingApproval ? 'Aprobando…' : 'Confirmar aprobación'}
              </button>
            </div>
          </form>
        )}
      </AccessibleModal>
      <ConfirmDialog
        isOpen={rejectConfirmDialog.isOpen}
        title="Rechazar solicitud"
        message={`¿Estás segura de rechazar la solicitud de "${rejectConfirmDialog.student?.name ?? ''}"? Esta acción borrará el registro y no se puede deshacer.`}
        isDestructive={true}
        confirmText="Rechazar solicitud"
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectConfirmDialog({ isOpen: false, student: null })}
      />
    </div>
  );
}

export function AlumnosClient() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando gestión de alumnos…</div>}>
      <StudentsManagementContent />
    </Suspense>
  );
}
