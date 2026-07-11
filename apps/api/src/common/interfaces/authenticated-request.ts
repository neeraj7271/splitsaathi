export interface AuthenticatedUser {
  userId: string;
  phoneE164: string;
  sessionId?: string;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: AuthenticatedUser;
}
