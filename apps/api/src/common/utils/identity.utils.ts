import { BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';

import { Request } from 'express';

export function normalizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  // Trim outer, lowercase, strip any internal whitespace, max 254 chars (SPEC-02 §4)
  const cleaned = email.trim().toLowerCase().replace(/\s+/g, '');
  return cleaned.slice(0, 254);
}

export function validatePasswordPolicy(password: string): void {
  if (typeof password !== 'string') {
    throw new BadRequestException({
      statusCode: 400,
      code: 'PASSWORD_POLICY',
      message: 'Usa entre 8 y 16 caracteres, sin espacios',
    });
  }

  // Unicode code points length (SPEC-02 §4: "longitud Unicode", §9: RF-8)
  const unicodeLength = [...password].length;
  if (unicodeLength < 8 || unicodeLength > 16 || /\s/u.test(password)) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'PASSWORD_POLICY',
      message: 'Usa entre 8 y 16 caracteres, sin espacios',
    });
  }
}

export function extractClientIp(request: Request): string {
  if (request.ip) {
    return request.ip;
  }
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[forwarded.length - 1] : forwarded;
    if (raw) {
      const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) {
        return last;
      }
    }
  }
  return request.socket.remoteAddress || '127.0.0.1';
}

export function validateCivilBirthDate(birthDateStr: string): number {
  if (typeof birthDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD',
    });
  }

  const parts = birthDateStr.split('-').map((p) => parseInt(p, 10));
  const bYear = parts[0];
  const bMonth = parts[1];
  const bDay = parts[2];

  if (
    bYear === undefined ||
    bMonth === undefined ||
    bDay === undefined ||
    isNaN(bYear) ||
    isNaN(bMonth) ||
    isNaN(bDay)
  ) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD',
    });
  }

  // Check valid date
  const checkDate = new Date(Date.UTC(bYear, bMonth - 1, bDay));
  if (
    checkDate.getUTCFullYear() !== bYear ||
    checkDate.getUTCMonth() !== bMonth - 1 ||
    checkDate.getUTCDate() !== bDay
  ) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La fecha de nacimiento no es una fecha civil válida',
    });
  }

  // Check America/Bogota current date
  const bogotaDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const nowParts = bogotaDateStr.split('-').map((p) => parseInt(p, 10));
  const nowYear = nowParts[0] ?? 2026;
  const nowMonth = nowParts[1] ?? 1;
  const nowDay = nowParts[2] ?? 1;

  // Future check
  if (
    bYear > nowYear ||
    (bYear === nowYear && (bMonth > nowMonth || (bMonth === nowMonth && bDay > nowDay)))
  ) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'La fecha de nacimiento no puede ser futura',
    });
  }

  // Calculate age
  let age = nowYear - bYear;
  if (nowMonth < bMonth || (nowMonth === bMonth && nowDay < bDay)) {
    age--;
  }

  return age;
}

export function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateRandomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateSixDigitOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
