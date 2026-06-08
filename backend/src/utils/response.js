/**
 * Utility: Standard API Response Helper
 * Konsistensi format response ke seluruh endpoint
 */

/**
 * Success response
 * @param {object} res - Express response object
 * @param {*} data - Data yang dikembalikan
 * @param {string} message - Pesan sukses
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = null, message = 'Berhasil', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Created response (201)
 */
const sendCreated = (res, data = null, message = 'Data berhasil dibuat') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Error response
 * @param {object} res - Express response object
 * @param {string} message - Pesan error
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {*} errors - Detail error (opsional)
 */
const sendError = (res, message = 'Terjadi kesalahan', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message,
  };
  if (errors) response.errors = errors;

  return res.status(statusCode).json(response);
};

/**
 * Pagination response
 */
const sendPaginated = (res, data, pagination, message = 'Berhasil') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};

module.exports = { sendSuccess, sendCreated, sendError, sendPaginated };
