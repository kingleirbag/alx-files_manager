/* eslint-disable no-unused-vars */
import { Request, Response, NextFunction } from 'express';

/**
 * Class that represents an error in this API.
 */
export class APIError extends Error {
  constructor(code, message) {
    super();
    this.code = code || 500;
    this.message = message;
  }
}

/**
 * Basic authentication to a route.
 * @param {Error} err error object.
 * @param {Request} req express request object.
 * @param {Response} res express response object.
 * @param {NextFunction} next express next function.
 */
export const errorResponse = (err, req, res, next) => {
  const defaultMsg = `Failed to process ${req.url}`;

  if (err instanceof APIError) {
    res.status(err.code).json({ error: err.message || defaultMsg });
    return;
  }
  res.status(500).json({
    error: err ? err.message || err.toString() : defaultMsg,
  });
};
