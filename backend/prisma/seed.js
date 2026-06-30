/**
 * Prisma Seed Script
 * Data awal: 4 unit (modular/scalable), pengguna per peran, komoditi, target
 *
 * Jalankan: npm run prisma:seed
 *
 * ========================================
 * HIERARKI PERAN:
 * IT           → Super admin teknis (hanya 1, kelola sistem & audit)
 * ADMIN_GLOBAL → Admin semua unit (kelola laporan & pengguna semua unit)
 * USER_UNIT    → Pengguna per unit (hanya akses unit sendiri)
 * ========================================
 *
 * UNIT (modular — tambah unit baru cukup INSERT baris baru):
 * Unit 1: Unit Pusat (Menampung IT & Admin Global)
 * Unit 2: Unit KNA
 * Unit 3: Unit Angkutan Barang
 * Unit 4: Unit Angkutan Penumpang
 * Unit 5: Unit Keuangan
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ================================================================
// KONFIGURASI UNIT AWAL (tambah unit baru di sini)
// Sistem bersifat data-driven: akses kontrol berdasarkan id_unit di DB
// ================================================================
const UNITS = [
  { nama_unit: 'Unit Pusat',              jenis_unit: 'PUSAT'  },
  { nama_unit: 'Unit KNA',                jenis_unit: 'CABANG' },
  { nama_unit: 'Unit Angkutan Barang',    jenis_unit: 'CABANG' },
  { nama_unit: 'Unit Angkutan Penumpang', jenis_unit: 'CABANG' },
  { nama_unit: 'Unit Keuangan',           jenis_unit: 'CABANG' },
];

async function main() {
  console.log('🌱 Memulai seeding database...\n');

  // ============================================================
  // 1. Seed Unit (modular — scalable)
  // ============================================================
  console.log('📦 Seeding unit...');
  const createdUnits = [];

  for (const unitData of UNITS) {
    const unit = await prisma.unit.upsert({
      where: { id_unit: UNITS.indexOf(unitData) + 1 },
      update: { nama_unit: unitData.nama_unit, jenis_unit: unitData.jenis_unit },
      create: unitData,
    });
    createdUnits.push(unit);
    console.log(`  ✅ ${unit.nama_unit} (ID: ${unit.id_unit})`);
  }

  const [unitPusat, unitKNA, unitBarang, unitPenumpang, unitKeuangan] = createdUnits;

  // ============================================================
  // 2. Seed Pengguna per Peran
  // ============================================================
  console.log('\n👤 Seeding pengguna...');

  const SALT_ROUNDS = 12;

  // IT — Super admin teknis (1 akun, unit pusat)
  const it = await prisma.pengguna.upsert({
    where: { email: 'it@rache.id' },
    update: {},
    create: {
      nama: 'IT Administrator',
      email: 'it@rache.id',
      kata_sandi: await bcrypt.hash('it@rache123', SALT_ROUNDS),
      peran: 'IT',
      no_hp: '6281234560001',
      id_unit: unitPusat.id_unit,
    },
  });
  console.log(`  ✅ IT: ${it.email}`);

  // ADMIN_GLOBAL — Admin seluruh unit (unit pusat)
  const adminGlobal = await prisma.pengguna.upsert({
    where: { email: 'admin@rache.id' },
    update: {},
    create: {
      nama: 'Admin Global',
      email: 'admin@rache.id',
      kata_sandi: await bcrypt.hash('admin@rache123', SALT_ROUNDS),
      peran: 'ADMIN_GLOBAL',
      no_hp: '6281234560002',
      id_unit: unitPusat.id_unit,
    },
  });
  console.log(`  ✅ ADMIN_GLOBAL: ${adminGlobal.email}`);

  // USER_UNIT — Satu pengguna per unit (modular)
  const userUnitSeeds = [
    {
      nama: 'Admin Unit KNA',
      email: 'unit.kna@rache.id',
      password: 'kna@rache123',
      no_hp: '6281234560011',
      id_unit: unitKNA.id_unit,
    },
    {
      nama: 'Admin Unit Barang',
      email: 'unit.barang@rache.id',
      password: 'barang@rache123',
      no_hp: '6281234560012',
      id_unit: unitBarang.id_unit,
    },
    {
      nama: 'Admin Unit Penumpang',
      email: 'unit.penumpang@rache.id',
      password: 'penumpang@rache123',
      no_hp: '6281234560013',
      id_unit: unitPenumpang.id_unit,
    },
    {
      nama: 'Admin Unit Keuangan',
      email: 'unit.keuangan@rache.id',
      password: 'keuangan@rache123',
      no_hp: '6281234560014',
      id_unit: unitKeuangan.id_unit,
    },
    {
      nama: 'User Terkunci',
      email: 'terkunci@rache.id',
      password: 'admin123',
      no_hp: '6281234560099',
      id_unit: unitPusat.id_unit,
    },
  ];

  for (const u of userUnitSeeds) {
    const created = await prisma.pengguna.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nama: u.nama,
        email: u.email,
        kata_sandi: await bcrypt.hash(u.password, SALT_ROUNDS),
        peran: 'USER_UNIT',
        no_hp: u.no_hp,
        id_unit: u.id_unit,
        terkunci: u.email === 'terkunci@rache.id' ? true : false,
        percobaan_login: u.email === 'terkunci@rache.id' ? 5 : 0,
      },
    });
    const namaUnit = createdUnits.find(cu => cu.id_unit === u.id_unit)?.nama_unit;
    console.log(`  ✅ USER_UNIT: ${created.email} → ${namaUnit}`);
  }

  // ============================================================
  // 3. Seed Komoditi Barang (per unit)
  // ============================================================
  console.log('\n📦 Seeding komoditi...');

  const KOMODITI = [
    { nama_komoditi: 'Batu Bara',  satuan: 'TON', id_unit: unitBarang.id_unit },
    { nama_komoditi: 'Semen',      satuan: 'TON', id_unit: unitBarang.id_unit },
    { nama_komoditi: 'Pupuk',      satuan: 'TON', id_unit: unitBarang.id_unit },
    { nama_komoditi: 'BBM',        satuan: 'KL',  id_unit: unitBarang.id_unit },
    { nama_komoditi: 'Beras',      satuan: 'TON', id_unit: unitBarang.id_unit },
    { nama_komoditi: 'Kontainer',  satuan: 'TEU', id_unit: unitBarang.id_unit },
  ];

  for (const k of KOMODITI) {
    const komoditi = await prisma.komoditiBarang.upsert({
      where: { id_komoditi: KOMODITI.indexOf(k) + 1 },
      update: {},
      create: k,
    });
    console.log(`  ✅ ${komoditi.nama_komoditi} (${komoditi.satuan})`);
  }

  // ============================================================
  // 4. Seed Target Tahun Berjalan (per unit)
  // ============================================================
  console.log('\n🎯 Seeding target...');

  const tahunIni = new Date().getFullYear();

  const TARGETS = [
    { tahun: tahunIni, kategori: 'KNA',          nilai: 500,           id_unit: unitKNA.id_unit },
    { tahun: tahunIni, kategori: 'BARANG',       nilai: 3000000,       id_unit: unitBarang.id_unit },
    { tahun: tahunIni, kategori: 'PENUMPANG',    nilai: 8000000,       id_unit: unitPenumpang.id_unit },
    { tahun: tahunIni, kategori: 'KEUANGAN',     nilai: 150000000000,  id_unit: unitKeuangan.id_unit },
  ];

  for (const t of TARGETS) {
    await prisma.target.upsert({
      where: {
        tahun_kategori_id_unit: {
          tahun: t.tahun,
          kategori: t.kategori,
          id_unit: t.id_unit,
        },
      },
      update: {},
      create: t,
    });
    const namaUnit = createdUnits.find(u => u.id_unit === t.id_unit)?.nama_unit;
    console.log(`  ✅ ${namaUnit} — ${t.kategori} ${t.tahun}: ${t.nilai.toLocaleString('id-ID')}`);
  }

  // ============================================================
  // RINGKASAN
  // ============================================================
  console.log('\n' + '='.repeat(55));
  console.log('🎉 Seeding selesai!\n');

  console.log('📋 UNIT TERDAFTAR:');
  createdUnits.forEach(u => console.log(`  [${u.id_unit}] ${u.nama_unit} (${u.jenis_unit})`));

  console.log('\n🔑 AKUN LOGIN:');
  console.log('  Peran         Email                      Password');
  console.log('  IT          : it@rache.id              → it@rache123');
  console.log('  ADMIN_GLOBAL: admin@rache.id           → admin@rache123');
  console.log('  USER_UNIT   : unit.kna@rache.id        → kna@rache123');
  console.log('  USER_UNIT   : unit.barang@rache.id     → barang@rache123');
  console.log('  USER_UNIT   : unit.penumpang@rache.id  → penumpang@rache123');
  console.log('  USER_UNIT   : unit.keuangan@rache.id   → keuangan@rache123');

  console.log('\n💡 Untuk menambah unit baru:');
  console.log('  POST /api/unit { nama_unit, jenis_unit } (login sebagai IT)');
  console.log('  Lalu tambah pengguna dengan id_unit baru tersebut.');
  console.log('='.repeat(55));
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
