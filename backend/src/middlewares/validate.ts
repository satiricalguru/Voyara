import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../utils/AppError.js';

type Source = 'body' | 'query' | 'params';

/** Validates and replaces req[source] with the parsed (coerced) value. Parsed query lives on req.validatedQuery. */
export const validate =
  (schema: ZodType, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw badRequest(details[0]?.message ?? 'Invalid request', details);
    }
    if (source === 'query') (req as Request & { validatedQuery: unknown }).validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };
