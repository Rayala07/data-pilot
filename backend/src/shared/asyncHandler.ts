// Express 4 does not observe the promise an async handler returns. A rejection
// therefore escapes the request entirely and becomes an unhandled rejection,
// which under Node's default policy kills the process - one bad DB call takes
// the whole server down, and every in-flight request with it.
//
// Wrapping routes a `.catch(next)` onto the promise, so a rejection travels to
// the error-handling middleware and comes back as a normal 500 response.
//
// Every async handler and async middleware in this app is registered through
// here. Express 5 does this natively; drop this helper if the app ever upgrades.

import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
