import { z } from 'zod';
import { AgeSegment, Role } from '../enums';

export const SessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.nativeEnum(Role),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export const SessionStudentSchema = z.object({
  id: z.string(),
  ageSegment: z.nativeEnum(AgeSegment),
  canSwitchInterface: z.boolean(),
});

export type SessionStudent = z.infer<typeof SessionStudentSchema>;

export const SessionViewSchema = z.object({
  user: SessionUserSchema,
  student: SessionStudentSchema.nullable(),
});

export type SessionView = z.infer<typeof SessionViewSchema>;

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  birthDate: string;
  guardianName?: string | null;
  guardianContact?: string | null;
  acceptTerms: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface EmailChangeInput {
  newEmail: string;
  password: string;
}

export interface EmailChangeConfirmInput {
  otp: string;
}

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;
