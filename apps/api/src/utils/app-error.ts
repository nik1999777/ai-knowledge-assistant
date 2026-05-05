export type AppError = Error & { statusCode: number };

export function createAppError(statusCode: number, message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  return error;
}
