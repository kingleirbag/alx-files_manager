import express from 'express';

/**
 * Injects middlewares to the given express application.
 * @param {express.Express} api express application.
 */
const injectMiddlewares = (api) => {
  api.use(express.json({ limit: '200mb' }));
};

export default injectMiddlewares;