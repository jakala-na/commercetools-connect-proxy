import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import CustomError from '../errors/custom.error';

export const errorMiddleware: ErrorRequestHandler = (
  error: Error,
  _: Request,
  res: Response,
  _next: NextFunction
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (error instanceof CustomError) {
    res.status(error.statusCode as number).json({
      message: error.message,
      errors: error.errors,
      stack: isDevelopment ? error.stack : undefined,
    });

    return;
  }

  const httpStatus = (error as { status?: unknown }).status;
  const statusCode = typeof httpStatus === 'number' ? httpStatus : 500;

  res
    .status(statusCode)
    .send(
      isDevelopment || statusCode < 500
        ? { message: error.message }
        : { message: 'Internal server error' }
    );
};
