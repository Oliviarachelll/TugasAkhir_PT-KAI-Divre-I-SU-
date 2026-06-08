/**
 * Utility: Pagination Helper
 * Membantu query dengan pagination
 */

/**
 * Parse query params pagination dari request
 * @param {object} query - req.query
 * @returns {{ skip, take, page, limit }}
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  return { skip, take: limit, page, limit };
};

/**
 * Build pagination metadata
 * @param {number} total - Total records
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 */
const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = { parsePagination, buildPaginationMeta };
