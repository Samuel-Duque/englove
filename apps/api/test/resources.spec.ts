import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ResourcesService } from '../src/resources/resources.service';
import { ResourcesController } from '../src/resources/resources.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { Role, Level } from '@englove/shared';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { ExternalResource } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateResourceDto,
  UpdateResourceDto,
  ReorderResourcesDto,
  ResourceQueryDto,
} from '../src/resources/dto/resources.dto';

describe('SPEC-10: ResourcesService and ResourcesController (ENG-120, RF-1 a RF-3, RF-7, RF-8)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const teacherUserId = '22222222-2222-4222-8222-222222222222';
  const studentUserId = '33333333-3333-4333-8333-333333333333';
  const studentId = '44444444-4444-4444-8444-444444444444';

  let mockPrisma: any;
  let mockFeatureFlags: any;
  let service: ResourcesService;
  let controller: ResourcesController;

  const sampleDate = new Date('2026-11-04T12:00:00.000Z');

  const makeResource = (overrides: Partial<ExternalResource> = {}): ExternalResource => ({
    id: '55555555-5555-4555-8555-555555555551',
    organization_id: orgId,
    title: 'Animals Memory - Educaplay',
    url: 'https://es.educaplay.com/recursos/123',
    description: 'Repaso vocabulario',
    level: Level.A1,
    position: 0,
    created_by: teacherUserId,
    created_at: sampleDate,
    updated_at: sampleDate,
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = {
      externalResource: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        aggregate: vi.fn(),
      },
      student: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (arg) => (typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg))),
    };

    mockFeatureFlags = {
      isFeatureEnabled: vi.fn().mockResolvedValue(true),
    };

    service = new ResourcesService(mockPrisma as PrismaService, mockFeatureFlags as FeatureFlagsService);
    controller = new ResourcesController(service);
  });

  describe('RF-1: Creación y edición de recursos externos', () => {
    it('crea un recurso exitosamente asignando la posición al final (max + 1)', async () => {
      mockPrisma.externalResource.count.mockResolvedValue(2);
      mockPrisma.externalResource.aggregate.mockResolvedValue({ _max: { position: 1 } });
      const createdRes = makeResource({ position: 2 });
      mockPrisma.externalResource.create.mockResolvedValue(createdRes);

      const result = await service.create(orgId, teacherUserId, {
        title: 'Animals Memory',
        url: 'https://es.educaplay.com/recursos/123',
        description: 'Repaso',
        level: Level.A1,
      });

      expect(mockPrisma.externalResource.count).toHaveBeenCalledWith({
        where: { organization_id: orgId },
      });
      expect(mockPrisma.externalResource.create).toHaveBeenCalledWith({
        data: {
          organization_id: orgId,
          title: 'Animals Memory',
          url: 'https://es.educaplay.com/recursos/123',
          description: 'Repaso',
          level: Level.A1,
          position: 2,
          created_by: teacherUserId,
        },
      });
      expect(result.position).toBe(2);
      expect(result.id).toBe(createdRes.id);
    });

    it('asigna posición 0 si no existen recursos previos en la organización', async () => {
      mockPrisma.externalResource.count.mockResolvedValue(0);
      mockPrisma.externalResource.aggregate.mockResolvedValue({ _max: { position: null } });
      const createdRes = makeResource({ position: 0 });
      mockPrisma.externalResource.create.mockResolvedValue(createdRes);

      const result = await service.create(orgId, teacherUserId, {
        title: 'Primer Enlace General',
        url: 'https://dictionary.cambridge.org/',
      });

      expect(result.position).toBe(0);
      expect(mockPrisma.externalResource.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 0, level: null, description: null }),
        }),
      );
    });

    it('aplica el tope de 200 recursos por organización con 409 RESOURCE_LIMIT_REACHED', async () => {
      mockPrisma.externalResource.count.mockResolvedValue(200);

      await expect(
        service.create(orgId, teacherUserId, {
          title: 'Recurso 201',
          url: 'https://example.com/201',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.externalResource.create).not.toHaveBeenCalled();
    });

    it('edita un recurso existente validando pertenencia al tenant', async () => {
      const existing = makeResource({ id: 'res-1' });
      mockPrisma.externalResource.findFirst.mockResolvedValue(existing);
      mockPrisma.externalResource.update.mockResolvedValue({
        ...existing,
        title: 'Título Actualizado',
        description: null,
      });

      const result = await service.update(orgId, 'res-1', {
        title: '  Título Actualizado  ',
        description: '   ',
      });

      expect(mockPrisma.externalResource.findFirst).toHaveBeenCalledWith({
        where: { id: 'res-1', organization_id: orgId },
      });
      expect(mockPrisma.externalResource.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: expect.objectContaining({
          title: 'Título Actualizado',
          description: null,
        }),
      });
      expect(result.title).toBe('Título Actualizado');
    });

    it('devuelve 404 RESOURCE_NOT_FOUND al actualizar recurso inexistente o de otro tenant', async () => {
      mockPrisma.externalResource.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'res-ajeno', { title: 'Nuevo Título' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('RF-2: Listado determinista, reordenamiento atómico y eliminación', () => {
    it('lista recursos de la profesora ordenados por position ASC, created_at ASC, id ASC', async () => {
      const resA = makeResource({ id: 'id-a', position: 0 });
      const resB = makeResource({ id: 'id-b', position: 1 });
      mockPrisma.externalResource.count.mockResolvedValue(2);
      mockPrisma.externalResource.findMany.mockResolvedValue([resA, resB]);

      const result = await service.listForTeacher(orgId);

      expect(mockPrisma.externalResource.findMany).toHaveBeenCalledWith({
        where: { organization_id: orgId },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      });
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe('id-a');
    });

    it('filtra por nivel o contenido general en el panel docente', async () => {
      mockPrisma.externalResource.count.mockResolvedValue(1);
      mockPrisma.externalResource.findMany.mockResolvedValue([makeResource({ level: null })]);

      await service.listForTeacher(orgId, { level: 'general' });
      expect(mockPrisma.externalResource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organization_id: orgId, level: null },
        }),
      );

      await service.listForTeacher(orgId, { level: 'A1' });
      expect(mockPrisma.externalResource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organization_id: orgId, level: Level.A1 },
        }),
      );
    });

    it('reordena recursos atómicamente asignando posiciones 0..N-1', async () => {
      const idA = '00000000-0000-4000-8000-00000000000a';
      const idB = '00000000-0000-4000-8000-00000000000b';
      const idC = '00000000-0000-4000-8000-00000000000c';

      mockPrisma.externalResource.findMany
        .mockResolvedValueOnce([{ id: idA }, { id: idB }, { id: idC }]) // tenant verification
        .mockResolvedValueOnce([
          makeResource({ id: idC, position: 0 }),
          makeResource({ id: idA, position: 1 }),
          makeResource({ id: idB, position: 2 }),
        ]); // reordered result

      const result = await service.reorder(orgId, [idC, idA, idB]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.externalResource.updateMany).toHaveBeenCalledWith({
        where: { id: idC, organization_id: orgId },
        data: { position: 0 },
      });
      expect(mockPrisma.externalResource.updateMany).toHaveBeenCalledWith({
        where: { id: idA, organization_id: orgId },
        data: { position: 1 },
      });
      expect(mockPrisma.externalResource.updateMany).toHaveBeenCalledWith({
        where: { id: idB, organization_id: orgId },
        data: { position: 2 },
      });
      expect(result.items[0]?.id).toBe(idC);
      expect(result.items[0]?.position).toBe(0);
      expect(result.items[1]?.id).toBe(idA);
      expect(result.items[2]?.id).toBe(idB);
    });

    it('rechaza reordenamiento con IDs duplicados con 400 VALIDATION_ERROR', async () => {
      const idA = '00000000-0000-4000-8000-00000000000a';
      await expect(service.reorder(orgId, [idA, idA])).rejects.toThrow(BadRequestException);
    });

    it('rechaza reordenamiento si incluye un ID inexistente o de otra organización con 404 RESOURCE_NOT_FOUND', async () => {
      const idA = '00000000-0000-4000-8000-00000000000a';
      const idAjeno = '00000000-0000-4000-8000-00000000000f';

      mockPrisma.externalResource.findMany.mockResolvedValueOnce([{ id: idA }]);

      await expect(service.reorder(orgId, [idA, idAjeno])).rejects.toThrow(NotFoundException);
    });

    it('rechaza reordenamiento incompleto (omite recursos del tenant) con 400 VALIDATION_ERROR', async () => {
      const idA = '00000000-0000-4000-8000-00000000000a';
      const idB = '00000000-0000-4000-8000-00000000000b';

      mockPrisma.externalResource.findMany.mockResolvedValueOnce([{ id: idA }, { id: idB }]);

      // Sends only idA, omitting idB
      await expect(service.reorder(orgId, [idA])).rejects.toThrow(BadRequestException);
    });

    it('elimina un recurso de la organización con 204 y rechaza ajenos con 404', async () => {
      mockPrisma.externalResource.findFirst.mockResolvedValueOnce(makeResource({ id: 'res-del' }));

      await service.delete(orgId, 'res-del');
      expect(mockPrisma.externalResource.deleteMany).toHaveBeenCalledWith({
        where: { id: 'res-del', organization_id: orgId },
      });

      mockPrisma.externalResource.findFirst.mockResolvedValueOnce(null);
      await expect(service.delete(orgId, 'res-otra-org')).rejects.toThrow(NotFoundException);
    });
  });

  describe('RF-3: Bloqueo de estudiante y habilitación por feature flag extra_content', () => {
    it('devuelve 403 EXTRA_CONTENT_DISABLED al estudiante si el flag extra_content está apagado', async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);

      await expect(service.listForStudent(orgId, studentUserId)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.student.findFirst).not.toHaveBeenCalled();
    });

    it('filtra en servidor solo recursos generales (null) y del nivel del estudiante (RF-5)', async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(true);
      mockPrisma.student.findFirst.mockResolvedValue({
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        level: Level.A1,
      });

      const resGeneral = makeResource({ id: 'res-gen', level: null });
      const resA1 = makeResource({ id: 'res-a1', level: Level.A1 });
      mockPrisma.externalResource.count.mockResolvedValue(2);
      mockPrisma.externalResource.findMany.mockResolvedValue([resGeneral, resA1]);

      const result = await service.listForStudent(orgId, studentUserId);

      expect(mockPrisma.externalResource.findMany).toHaveBeenCalledWith({
        where: {
          organization_id: orgId,
          OR: [{ level: null }, { level: Level.A1 }],
        },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe('res-gen');
      expect(result.items[1]?.id).toBe('res-a1');
    });

    it('devuelve 403 FORBIDDEN si el estudiante no existe en la organización', async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(true);
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(service.listForStudent(orgId, studentUserId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ResourcesController dispatching por rol', () => {
    it('despacha a listForTeacher cuando el rol autenticado es teacher', async () => {
      const teacherUser: AuthenticatedUser = {
        id: teacherUserId,
        email: 'profe@englove.org',
        role: Role.teacher,
        organizationId: orgId,
        sessionId: 'sid-1',
      };

      const spy = vi.spyOn(service, 'listForTeacher').mockResolvedValue({ items: [], total: 0 });
      await controller.listResources(teacherUser, { level: 'A1' });
      expect(spy).toHaveBeenCalledWith(orgId, { level: 'A1' });
    });

    it('despacha a listForStudent cuando el rol autenticado es student', async () => {
      const studentUser: AuthenticatedUser = {
        id: studentUserId,
        email: 'alumno@englove.org',
        role: Role.student,
        organizationId: orgId,
        sessionId: 'sid-2',
      };

      const spy = vi.spyOn(service, 'listForStudent').mockResolvedValue({ items: [], total: 0 });
      await controller.listResources(studentUser, {});
      expect(spy).toHaveBeenCalledWith(orgId, studentUserId);
    });

    it('llama a create, reorder, update y delete con los argumentos esperados', async () => {
      const teacherUser: AuthenticatedUser = {
        id: teacherUserId,
        email: 'profe@englove.org',
        role: Role.teacher,
        organizationId: orgId,
        sessionId: 'sid-1',
      };

      const spyCreate = vi.spyOn(service, 'create').mockResolvedValue(makeResource() as any);
      await controller.createResource(teacherUser, {
        title: 'Nuevo Recurso',
        url: 'https://site.org',
      });
      expect(spyCreate).toHaveBeenCalledWith(orgId, teacherUserId, {
        title: 'Nuevo Recurso',
        url: 'https://site.org',
      });

      const spyReorder = vi.spyOn(service, 'reorder').mockResolvedValue({ items: [], total: 0 });
      await controller.reorderResources(teacherUser, { resourceIds: ['id-1'] });
      expect(spyReorder).toHaveBeenCalledWith(orgId, ['id-1']);

      const spyUpdate = vi.spyOn(service, 'update').mockResolvedValue(makeResource() as any);
      await controller.updateResource(teacherUser, 'id-1', { title: 'Modificado' });
      expect(spyUpdate).toHaveBeenCalledWith(orgId, 'id-1', { title: 'Modificado' });

      const spyDelete = vi.spyOn(service, 'delete').mockResolvedValue();
      await controller.deleteResource(teacherUser, 'id-1');
      expect(spyDelete).toHaveBeenCalledWith(orgId, 'id-1');
    });
  });

  describe('Validación estricta de DTOs y casos borde (RF-1, RF-2)', () => {
    it('rechaza CreateResourceDto con título o url vacíos o nulos', async () => {
      const dtoEmpty = plainToInstance(CreateResourceDto, { title: '', url: '' });
      const errorsEmpty = await validate(dtoEmpty);
      expect(errorsEmpty.length).toBeGreaterThan(0);

      const dtoNull = plainToInstance(CreateResourceDto, { title: null, url: null });
      const errorsNull = await validate(dtoNull);
      expect(errorsNull.length).toBeGreaterThan(0);
    });

    it('rechaza CreateResourceDto con URLs inseguras o con credenciales', async () => {
      const dtoHttp = plainToInstance(CreateResourceDto, {
        title: 'Recurso',
        url: 'http://insecure.com',
      });
      const errorsHttp = await validate(dtoHttp);
      expect(errorsHttp.some((e) => e.property === 'url')).toBe(true);

      const dtoCreds = plainToInstance(CreateResourceDto, {
        title: 'Recurso',
        url: 'https://user:pass@example.com',
      });
      const errorsCreds = await validate(dtoCreds);
      expect(errorsCreds.some((e) => e.property === 'url')).toBe(true);
    });

    it('rechaza UpdateResourceDto con title: null o url: null impidiendo bypass de validación', async () => {
      const dtoNullTitle = plainToInstance(UpdateResourceDto, { title: null });
      const errorsTitle = await validate(dtoNullTitle);
      expect(errorsTitle.some((e) => e.property === 'title')).toBe(true);

      const dtoNullUrl = plainToInstance(UpdateResourceDto, { url: null });
      const errorsUrl = await validate(dtoNullUrl);
      expect(errorsUrl.some((e) => e.property === 'url')).toBe(true);

      const dtoEmptyTitle = plainToInstance(UpdateResourceDto, { title: '   ' });
      const errorsEmptyTitle = await validate(dtoEmptyTitle);
      expect(errorsEmptyTitle.some((e) => e.property === 'title')).toBe(true);
    });

    it('permite limpiar description y level en UpdateResourceDto enviando null o vacío', async () => {
      const dtoCleanDesc = plainToInstance(UpdateResourceDto, { description: '   ' });
      const errorsDesc = await validate(dtoCleanDesc);
      expect(errorsDesc).toHaveLength(0);
      expect(dtoCleanDesc.description).toBeNull();

      const dtoCleanLevel = plainToInstance(UpdateResourceDto, { level: null });
      const errorsLevel = await validate(dtoCleanLevel);
      expect(errorsLevel).toHaveLength(0);
    });

    it('normaliza cadena vacía a undefined en ResourceQueryDto', async () => {
      const dtoEmptyQuery = plainToInstance(ResourceQueryDto, { level: '' });
      const errors = await validate(dtoEmptyQuery);
      expect(errors).toHaveLength(0);
      expect(dtoEmptyQuery.level).toBeUndefined();
    });

    it('rechaza ReorderResourcesDto con array vacío o con IDs inválidos', async () => {
      const dtoEmpty = plainToInstance(ReorderResourcesDto, { resourceIds: [] });
      const errorsEmpty = await validate(dtoEmpty);
      expect(errorsEmpty.some((e) => e.property === 'resourceIds')).toBe(true);

      const dtoInvalidUuid = plainToInstance(ReorderResourcesDto, { resourceIds: ['no-es-uuid'] });
      const errorsInvalid = await validate(dtoInvalidUuid);
      expect(errorsInvalid.some((e) => e.property === 'resourceIds')).toBe(true);
    });
  });
});
