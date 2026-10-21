import { AgeSegment, Role } from '../enums';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SessionStudent {
  id: string;
  ageSegment: AgeSegment;
  canSwitchInterface: boolean;
}

export interface SessionView {
  user: SessionUser;
  student: SessionStudent | null;
}

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

export interface MessageResponse {
  message: string;
}
