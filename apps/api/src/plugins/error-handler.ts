import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Ошибка валидации запроса",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (
      typeof (error as { statusCode?: unknown }).statusCode === "number" &&
      (error as { statusCode: number }).statusCode >= 400 &&
      (error as { statusCode: number }).statusCode < 500
    ) {
      const appError = error as Error & { statusCode: number };
      const statusCode = appError.statusCode;

      return reply.status(statusCode).send({
        error: getClientErrorLabel(statusCode),
        message: appError.message,
      });
    }

    app.log.error(error);

    return reply.status(500).send({
      error: "Internal Server Error",
      message: "Внутренняя ошибка сервера",
    });
  });
}

function getClientErrorLabel(statusCode: number) {
  switch (statusCode) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 422:
      return "Unprocessable Entity";
    default:
      return "Client Error";
  }
}
