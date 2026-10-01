'use strict';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest({ body = {}, params = {}, query = {}, pengguna } = {}) {
  return { body, params, query, pengguna };
}

module.exports = { createResponse, createRequest };
