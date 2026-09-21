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
  // 3. Komoditi (upsert — data laporan asli tidak dihapus)
  // ============================================================
  console.log('\n📦 Seeding komoditi...');

  // Komoditi wajib yang diminta user
  const KOMODITI = [
    { id_komoditi: 10, nama_komoditi: 'Peti Kemas',  satuan: 'TON', id_unit: unitBarang.id_unit },
    { id_komoditi: 11, nama_komoditi: 'CPO',         satuan: 'TON', id_unit: unitBarang.id_unit },
    { id_komoditi: 12, nama_komoditi: 'BBM',         satuan: 'TON', id_unit: unitBarang.id_unit },
    { id_komoditi: 13, nama_komoditi: 'Palm Kernel', satuan: 'TON', id_unit: unitBarang.id_unit },
    { id_komoditi: 14, nama_komoditi: 'Lateks',      satuan: 'TON', id_unit: unitBarang.id_unit },
    { id_komoditi: 15, nama_komoditi: 'BHP',         satuan: 'B',   id_unit: unitBarang.id_unit },
    // Tambahkan custom komoditi dan total summary (id_unit: 1 sesuai log sebelumnya)
    { id_komoditi: 98, nama_komoditi: 'CUSTOM KOMODITI', satuan: '-', id_unit: unitPusat.id_unit },
    { id_komoditi: 99, nama_komoditi: 'TOTAL SUMMARY',   satuan: '-', id_unit: unitPusat.id_unit }
  ];

  for (const k of KOMODITI) {
    const komoditi = await prisma.komoditiBarang.upsert({
      where: { id_komoditi: k.id_komoditi },
      update: { nama_komoditi: k.nama_komoditi, satuan: k.satuan, id_unit: k.id_unit },
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
  // 6. Seed Laporan Dummy SESUAI TEMPLATE (tidak menghapus data asli:
  //    tanggal+unit yang sudah ada dilewati)
  // ============================================================
  console.log('\n📄 Seeding laporan dummy sesuai template...');

  // target_rkad mengikuti master target per unit (agar konsisten dgn Target Saya).
  const targetRows = await prisma.target.findMany();
  const targetOf = (idUnit, fallback) => {
    const t = targetRows.find((x) => x.id_unit === idUnit);
    return t ? Number(t.nilai) : fallback;
  };
  const targetKNA = targetOf(unitKNA.id_unit, 10000000000);
  const targetKeuangan = targetOf(unitKeuangan.id_unit, 150000000000);

  // Kombinasi unit+tanggal yang sudah ada (data asli user) dilewati.
  const sudahAda = new Set(
    (await prisma.laporan.findMany({ select: { id_unit: true, tanggal: true } }))
      .map((l) => `${l.id_unit}-${new Date(l.tanggal).toISOString().slice(0, 10)}`)
  );

  const userKna = await prisma.pengguna.findUnique({ where: { email: 'unit.kna@rache.id' } });
  const userBarang = await prisma.pengguna.findUnique({ where: { email: 'unit.barang@rache.id' } });
  const userPenumpang = await prisma.pengguna.findUnique({ where: { email: 'unit.penumpang@rache.id' } });
  const userKeuangan = await prisma.pengguna.findUnique({ where: { email: 'unit.keuangan@rache.id' } });
  
  const semuaKomoditiBarang = await prisma.komoditiBarang.findMany({
    where: { 
      id_unit: unitBarang.id_unit,
      id_komoditi: { notIn: [98, 99] }
    }
  });

  const statusInternalList = ['PENDING', 'DALAM_PROSES', 'SELESAI', 'DIBATALKAN'];
  // KA asli Unit Angkutan Penumpang Divre I (huruf besar semua).
  const namaKaList = ['SRILELAWANGSA', 'SRIBILAH UTAMA', 'DATUK BELAMBANGAN', 'PUTRI DELI', 'SIANTAR EKSPRES', 'AMIR HAMZAH', 'NURMALA', 'CUT MUTIA'];

  let countKNA = 0;
  let countBarang = 0;
  let countPenumpang = 0;
  let countKeuangan = 0;
  let skipped = 0;

  const tglKey = (d, idUnit) => `${idUnit}-${new Date(d).toISOString().slice(0, 10)}`;

  for (let i = 0; i < 30; i++) {
    // Tanggal berurut dari hari ini mundur 30 hari
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i);

    // Fungsi bantuan untuk merandom status.
    // Dummy hanya DISETUJUI (70%) / DIAJUKAN (30%) agar tidak mengotori
    // (tidak ada DRAFT/REVISI/DITOLAK).
    const getRandomInternal = () => statusInternalList[Math.floor(Math.random() * statusInternalList.length)];
    const getRandomStatus = () => (Math.random() < 0.7 ? 'DISETUJUI' : 'DIAJUKAN');

    // 1. Seed KNA (dilewati bila unit+tanggal sudah ada = data asli)
    if (userKna && !sudahAda.has(tglKey(pastDate, unitKNA.id_unit))) {
      await prisma.laporan.create({
        data: {
          tanggal: pastDate,
          status_internal: getRandomInternal(),
          status: getRandomStatus(),
          id_unit: unitKNA.id_unit,
          id_pengguna: userKna.id_pengguna,
          laporan_kna: {
            create: {
              jml_kontrak_row: Math.floor(Math.random() * 20) + 5,
              luas_t_row: parseFloat((Math.random() * 10000 + 1000).toFixed(4)),
              luas_b_row: parseFloat((Math.random() * 5000 + 500).toFixed(4)),
              nilai_row: parseFloat((Math.random() * 500000 + 50000).toFixed(2)),
              target_rkad: targetKNA,
              jml_kontrak_non_row: Math.floor(Math.random() * 10) + 1,
              luas_t_non_row: parseFloat((Math.random() * 5000 + 500).toFixed(4)),
              luas_b_non_row: parseFloat((Math.random() * 2000 + 200).toFixed(4)),
              nilai_non_row: parseFloat((Math.random() * 200000 + 20000).toFixed(2))
            }
          }
        }
      });
      countKNA++;
    } else if (userKna) {
      skipped++;
    }

    // 2. Seed Barang
    if (userBarang && semuaKomoditiBarang.length > 0 && !sudahAda.has(tglKey(pastDate, unitBarang.id_unit))) {
      const arrayLaporanBarang = semuaKomoditiBarang.map(komoditi => {
        return {
          jml_ka: Math.floor(Math.random() * 15) + 2,
          volume: parseFloat((Math.random() * 20000 + 5000).toFixed(4)),
          volume_kumulatif: parseFloat((Math.random() * 100000 + 20000).toFixed(4)),
          volume_program: 150000,
          volume_pencapaian: parseFloat((Math.random() * 100).toFixed(2)),
          pendapatan: parseFloat((Math.random() * 1000000000 + 100000000).toFixed(2)),
          pendapatan_kumulatif: parseFloat((Math.random() * 5000000000 + 500000000).toFixed(2)),
          pendapatan_program: 6000000000,
          pendapatan_pencapaian: parseFloat((Math.random() * 100).toFixed(2)),
          id_komoditi: komoditi.id_komoditi
        };
      });

      await prisma.laporan.create({
        data: {
          tanggal: pastDate,
          status_internal: getRandomInternal(),
          status: getRandomStatus(),
          id_unit: unitBarang.id_unit,
          id_pengguna: userBarang.id_pengguna,
          laporan_barang: {
            create: arrayLaporanBarang
          }
        }
      });
      countBarang++;
    } else if (userBarang) {
      skipped++;
    }

    // 3. Seed Penumpang
    if (userPenumpang && !sudahAda.has(tglKey(pastDate, unitPenumpang.id_unit))) {
      const arrayLaporanPenumpang = namaKaList.map(ka => ({
        nama_ka: ka,
        jml_penumpang: Math.floor(Math.random() * 5000) + 1000,
        pendapatan: parseFloat((Math.random() * 500000000 + 50000000).toFixed(2))
      }));

      await prisma.laporan.create({
        data: {
          tanggal: pastDate,
          status_internal: getRandomInternal(),
          status: getRandomStatus(),
          id_unit: unitPenumpang.id_unit,
          id_pengguna: userPenumpang.id_pengguna,
          laporan_penumpang: {
            create: arrayLaporanPenumpang
          }
        }
      });
      countPenumpang++;
    } else if (userPenumpang) {
      skipped++;
    }
    // 4. Seed Keuangan
    if (userKeuangan && !sudahAda.has(tglKey(pastDate, unitKeuangan.id_unit))) {
      const p1 = Math.floor(Math.random() * 4000000) + 1000000;
      const e1 = Math.floor(Math.random() * 1000000);
      const e2 = Math.floor(Math.random() * 500000);
      const e3 = Math.floor(Math.random() * 200000);

      const rincianTransaksi = [
        { id: '1', jenis: 'Penerimaan', uraian: 'Pendapatan Jasa', penerimaan: p1.toString(), pengeluaran: '0', unit_kerja: 'KNA' },
        { id: '2', jenis: 'Pengeluaran', uraian: 'Biaya Operasional', penerimaan: '0', pengeluaran: e1.toString(), unit_kerja: 'Keuangan' }
      ];
      const rincianSPJ = [
        { id: '1', no_spj: `SPJ-${i}`, tanggal_spj: pastDate.toISOString().split('T')[0], uraian: 'Biaya Dinas', nominal: e2.toString(), keterangan: '-' }
      ];
      const rincianInvoice = [
        { id: '1', no_invoice: `INV-${i}`, tanggal_invoice: pastDate.toISOString().split('T')[0], vendor: 'Vendor A', nominal: e3.toString(), jatuh_tempo: pastDate.toISOString().split('T')[0], status: 'Belum Lunas', keterangan: '-' }
      ];

      const pendapatan = p1;
      const pengeluaran = e1 + e2 + e3;
      const labaRugi = pendapatan - pengeluaran;

      const targetRKAD = targetKeuangan;

      await prisma.laporan.create({
        data: {
          tanggal: pastDate,
          status_internal: getRandomInternal(),
          status: getRandomStatus(),
          id_unit: unitKeuangan.id_unit,
          id_pengguna: userKeuangan.id_pengguna,
          laporan_keuangan: {
            create: {
              target_rkad: targetRKAD,
              rincian_transaksi: JSON.stringify(rincianTransaksi),
              rincian_spj: JSON.stringify(rincianSPJ),
              rincian_invoice: JSON.stringify(rincianInvoice),
              pendapatan: pendapatan,
              pengeluaran: pengeluaran,
              laba_rugi: labaRugi
            }
          }
        }
      });
      countKeuangan++;
    } else if (userKeuangan) {
      skipped++;
    }
  }

  console.log(`  ✅ Berhasil generate ${countKNA} KNA, ${countBarang} Barang, ${countPenumpang} Penumpang, ${countKeuangan} Keuangan bervariasi (${skipped} tanggal dilewati = data asli).`);

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
