'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loginSchema,
  newPasswordSchema,
  resetPasswordSchema,
  unlockRequestSchema,
  updateWhatsappContactSchema,
} = require('../../src/schemas/auth.schema');
const {
  createPenggunaSchema,
  updatePenggunaSchema,
} = require('../../src/schemas/pengguna.schema');

test('new passwords require 10 Unicode characters and at most 72 UTF-8 bytes', () => {
  assert.equal(newPasswordSchema.safeParse('123456789').success, false);
  assert.equal(newPasswordSchema.safeParse('1234567890').success, true);
  assert.equal(newPasswordSchema.safeParse('a'.repeat(72)).success, true);
  assert.equal(newPasswordSchema.safeParse('a'.repeat(73)).success, false);
  assert.equal(newPasswordSchema.safeParse('😀'.repeat(9)).success, false);
  assert.equal(newPasswordSchema.safeParse('😀'.repeat(10)).success, true);
  assert.equal(newPasswordSchema.safeParse('😀'.repeat(19)).success, false);
});

test('login permits legacy passwords but enforces bcrypt byte ceiling', () => {
  assert.equal(
    loginSchema.safeParse({ email: ' User@Example.COM ', kata_sandi: 'legacy' }).success,
    true
  );
  assert.equal(
    loginSchema.safeParse({ email: 'user@example.com', kata_sandi: 'a'.repeat(73) }).success,
    false
  );
});

test('reset redemption accepts only normalized 16-character Crockford tokens', () => {
  const valid = resetPasswordSchema.safeParse({
    token: '0123-4567 89AB-CDEF',
    kata_sandi_baru: 'new-password-123',
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.token, '0123456789ABCDEF');

  for (const token of [
    '0123-4567-89ab-cdef',
    '0123-4567-89AO-CDEF',
    '0123\t4567-89AB-CDEF',
    '0123-4567-89AB-CDE',
  ]) {
    assert.equal(
      resetPasswordSchema.safeParse({ token, kata_sandi_baru: 'new-password-123' }).success,
      false
    );
  }
});

test('WhatsApp contacts are normalized and invalid Indonesian numbers are rejected', () => {
  const contact = updateWhatsappContactSchema.safeParse({
    no_hp: '+62 812-3456-7890',
    kata_sandi: 'current-password',
  });
  assert.equal(contact.success, true);
  assert.equal(contact.data.no_hp, '6281234567890');

  assert.equal(
    updateWhatsappContactSchema.safeParse({
      no_hp: '+1 202 555 0199',
      kata_sandi: 'current-password',
    }).success,
    false
  );

  const adminCreate = createPenggunaSchema.safeParse({
    nama: 'User Test',
    email: 'user@example.com',
    kata_sandi: 'valid-password-123',
    no_hp: '0812 3456 7890',
    id_unit: 1,
  });
  assert.equal(adminCreate.success, true);
  assert.equal(adminCreate.data.no_hp, '6281234567890');
  assert.equal(updatePenggunaSchema.parse({ no_hp: '' }).no_hp, null);
});

test('unlock and account schemas are strict and normalize email', () => {
  const unlock = unlockRequestSchema.safeParse({ email: ' USER@EXAMPLE.COM ' });
  assert.equal(unlock.success, true);
  assert.equal(unlock.data.email, 'user@example.com');
  assert.equal(
    unlockRequestSchema.safeParse({ email: 'user@example.com', extra: true }).success,
    false
  );

  assert.equal(
    createPenggunaSchema.safeParse({
      nama: 'User Test',
      email: 'user@example.com',
      kata_sandi: 'short',
      id_unit: 1,
    }).success,
    false
  );
  assert.equal(updatePenggunaSchema.safeParse({}).success, false);
  assert.equal(
    updatePenggunaSchema.safeParse({ kata_sandi: 'valid-password-123' }).success,
    true
  );
});
