'use strict';

const crypto = require('crypto');

const HUMAN_TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const HUMAN_TOKEN_LENGTH = 16;
const HUMAN_TOKEN_GROUP_SIZE = 4;

class HumanTokenValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'HumanTokenValidationError';
    this.code = 'INVALID_HUMAN_TOKEN';
  }
}

function normalizeHumanToken(token) {
  if (typeof token !== 'string') {
    throw new HumanTokenValidationError('Token must be a string');
  }

  // Deliberately do not uppercase or strip arbitrary punctuation. Accepting only
  // the two documented separators prevents visually similar input mutations.
  const normalizedToken = token.replace(/[ -]/g, '');

  if (normalizedToken.length !== HUMAN_TOKEN_LENGTH) {
    throw new HumanTokenValidationError(
      `Token must contain exactly ${HUMAN_TOKEN_LENGTH} characters`
    );
  }

  for (const character of normalizedToken) {
    if (!HUMAN_TOKEN_ALPHABET.includes(character)) {
      throw new HumanTokenValidationError('Token contains an invalid character');
    }
  }

  return normalizedToken;
}

function getTokenPepper() {
  const pepper = process.env.TOKEN_PEPPER || process.env.JWT_SECRET;
  if (typeof pepper !== 'string' || pepper.length === 0) {
    const error = new Error('TOKEN_PEPPER or JWT_SECRET must be configured');
    error.code = 'TOKEN_PEPPER_NOT_CONFIGURED';
    throw error;
  }
  return pepper;
}

function hashHumanToken(token) {
  const normalizedToken = normalizeHumanToken(token);
  return crypto
    .createHmac('sha256', getTokenPepper())
    .update(normalizedToken, 'ascii')
    .digest('hex');
}

function generateHumanToken() {
  // Crockford Base32 carries exactly five random bits per character. Because
  // the alphabet has 32 entries, masking is unbiased and yields 80 bits total.
  const randomBytes = crypto.randomBytes(HUMAN_TOKEN_LENGTH);
  let normalizedToken = '';

  for (const byte of randomBytes) {
    normalizedToken += HUMAN_TOKEN_ALPHABET[byte & 31];
  }

  const groups = [];
  for (let offset = 0; offset < normalizedToken.length; offset += HUMAN_TOKEN_GROUP_SIZE) {
    groups.push(normalizedToken.slice(offset, offset + HUMAN_TOKEN_GROUP_SIZE));
  }

  return {
    plainToken: groups.join('-'),
    normalizedToken,
    tokenDigest: hashHumanToken(normalizedToken),
  };
}

module.exports = {
  HUMAN_TOKEN_ALPHABET,
  HUMAN_TOKEN_LENGTH,
  HumanTokenValidationError,
  generateHumanToken,
  normalizeHumanToken,
  hashHumanToken,
};
