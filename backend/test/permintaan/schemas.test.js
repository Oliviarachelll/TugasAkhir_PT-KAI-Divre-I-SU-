'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPermintaanSchema,
  tanggapiPermintaanSchema,
  permintaanIdParamsSchema,
  permintaanListQuerySchema,
} = require('../../src/schemas/permintaan.schema');

test('creation schema discriminates report and non-report request types', () => {
  assert.equal(
    createPermintaanSchema.safeParse({
      jenis: 'KLARIFIKASI_DATA',
      deskripsi: 'Mohon klarifikasi data laporan',
      id_laporan: 7,
    }).success,
    true
  );
  assert.equal(
    createPermintaanSchema.safeParse({
      jenis: 'KLARIFIKASI_DATA',
      deskripsi: 'Mohon klarifikasi data laporan',
    }).success,
    false
  );

  for (const jenis of ['BANTUAN_TEKNIS', 'PERMINTAAN_AKSES', 'LAINNYA']) {
    assert.equal(
      createPermintaanSchema.safeParse({
        jenis,
        deskripsi: 'Deskripsi permintaan yang valid',
      }).success,
      true
    );
    assert.equal(
      createPermintaanSchema.safeParse({
        jenis,
        deskripsi: 'Deskripsi permintaan yang valid',
        id_laporan: 7,
      }).success,
      false
    );
  }
});

test('response body rejects all client-provided tokens and unknown fields', () => {
  assert.equal(tanggapiPermintaanSchema.safeParse({ status: 'DIPROSES' }).success, true);
  assert.equal(
    tanggapiPermintaanSchema.safeParse({ status: 'SELESAI', token: 'CLIENT-TOKEN' }).success,
    false
  );
  assert.equal(
    tanggapiPermintaanSchema.safeParse({ status: 'MENUNGGU' }).success,
    false
  );
});

test('params and list query accept only exact bounded values', () => {
  assert.deepEqual(permintaanIdParamsSchema.parse({ id: '17' }), { id: 17 });
  for (const id of ['17x', '017', '+17', '-1', '0']) {
    assert.equal(permintaanIdParamsSchema.safeParse({ id }).success, false);
  }

  assert.deepEqual(
    permintaanListQuerySchema.parse({
      status: 'DIPROSES',
      unitCategory: 'BARANG',
      page: '2',
      limit: '25',
    }),
    { status: 'DIPROSES', unitCategory: 'BARANG', page: 2, limit: 25 }
  );
  assert.equal(permintaanListQuerySchema.safeParse({ unitCategory: 'INVALID' }).success, false);
  assert.equal(permintaanListQuerySchema.safeParse({ limit: '101' }).success, false);
  assert.equal(permintaanListQuerySchema.safeParse({ unknown: 'value' }).success, false);
});
