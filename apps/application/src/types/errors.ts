export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, any>;
}

export class PermissionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 403
  ) {
    super(message);
    this.name = 'PermissionError';
  }
} 