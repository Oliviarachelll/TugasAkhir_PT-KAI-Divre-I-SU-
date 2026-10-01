'use strict';

const { sendError } = require('../utils/response');

function formatValidationErrors(zodError) {
  return zodError.errors.map((error) => ({
    field: error.path.join('.'),
    message: error.message,
  }));
}

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, 'Validasi gagal', 422, formatValidationErrors(result.error));
  }
  req.body = result.data;
  return next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return sendError(
      res,
      'Query parameter tidak valid',
      422,
      formatValidationErrors(result.error)
    );
  }
  req.query = result.data;
  return next();
};

module.exports = { formatValidationErrors, validateBody, validateQuery };
