/**
 * Middleware: Zod Request Validation
 * Validasi request body / params / query dengan Zod schema
 */
const { sendError } = require('../utils/response');

/**
 * Validasi request body
 * @param {import('zod').ZodSchema} schema - Zod schema
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Validasi gagal', 422, errors);
  }
  req.body = result.data; // data sudah diparse & dibersihkan
  next();
};

/**
 * Validasi query params
 * @param {import('zod').ZodSchema} schema - Zod schema
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Query parameter tidak valid', 422, errors);
  }
  req.query = result.data;
  next();
};

module.exports = { validateBody, validateQuery };
