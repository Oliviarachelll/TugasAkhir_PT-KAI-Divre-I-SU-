/**
 * reminder.service.js — Mesin pengingat kondisional via Baileys
 * (migrasi dari broadcast buta Meta Cloud API)
 *
 * Tanggung jawab:
 *  - cariUnitBelumLapor(): unit yang belum punya Laporan bulan berjalan
 *  - cariRevisiTertunda(): laporan DITOLAK/REVISI yang belum diperbaiki X hari
 *  - kirimPengingatUnit(): kirim 1 pengingat via Baileys + catat LogNotifikasi
 *  - broadcastBaileys(): dipakai controller manual + cron terjadwal
 *
 * Anti-spam: max 1 pengingat sejenis per unit per hari + jeda antar kirim.
 */
const prisma = require('../config/database');
const whatsappService = require('../whatsapp/baileys.service');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY_ANTAR_PESAN_MS = parseInt(process.env.WA_DELAY_MS || '2000', 10);

const formatTanggalID = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const tenggatAkhirBulan = (ref = new Date()) =>
  new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

/**
 * Cek apakah unit sudah dikirimi pengingat sejenis hari ini (guard anti-spam).
 * Memakai tabel LogNotifikasi existing: template = jenis pengingat.
 */
async function sudahDikirimHariIni(namaTemplate, namaUnit) {
  const awalHari = new Date();
  awalHari.setHours(0, 0, 0, 0);
  const count = await prisma.logNotifikasi.count({
    where: {
      template: namaTemplate,
      penerima: { contains: namaUnit },
      waktu: { gte: awalHari },
    },
  });
  return count > 0;
}

async function catatLog(template, penerima, status) {
  try {
    await prisma.logNotifikasi.create({ data: { template, penerima, status } });
  } catch (err) {
    console.error('[Reminder] Gagal catat LogNotifikasi:', err.message);
  }
}

/**
 * Unit yang belum punya Laporan pada bulan kalender berjalan.
 * Mengembalikan daftar { id_unit, nama_unit, penanggung: { nama, no_hp }[] }.
 */
async function cariUnitBelumLapor(ref = new Date()) {
  const awalBulan = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const akhirBulan = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59);

  const units = await prisma.unit.findMany({
    include: {
      pengguna: {
        where: { peran: 'USER_UNIT', no_hp: { not: null } },
        select: { nama: true, no_hp: true },
      },
    },
  });

  const laporanBulanIni = await prisma.laporan.findMany({
    where: { tanggal: { gte: awalBulan, lte: akhirBulan } },
    select: { id_unit: true },
  });
  const sudahLapor = new Set(laporanBulanIni.map((l) => l.id_unit));

  return units
    .filter((u) => !sudahLapor.has(u.id_unit))
    .map((u) => ({
      id_unit: u.id_unit,
      nama_unit: u.nama_unit,
      penanggung: u.pengguna.filter((p) => p.no_hp && p.no_hp.trim() !== ''),
    }))
    .filter((u) => u.penanggung.length > 0);
}

/**
 * Laporan DITOLAK/REVISI yang updated_at-nya lebih tua dari ambang hari.
 */
async function cariRevisiTertunda(ambangHari = 3) {
  const batas = new Date();
  batas.setDate(batas.getDate() - ambangHari);

  return prisma.laporan.findMany({
    where: {
      status: { in: ['DITOLAK', 'REVISI'] },
      updated_at: { lt: batas },
    },
    include: {
      unit: { select: { nama_unit: true } },
      pengguna: { select: { nama: true, no_hp: true } },
    },
    orderBy: { updated_at: 'asc' },
    take: 100,
  });
}

/**
 * Kirim 1 pengingat deadline ke semua penanggung 1 unit.
 */
async function kirimPengingatUnit(unit, opsi = {}) {
  const { tenggat = formatTanggalID(tenggatAkhirBulan()), skipAntiSpam = false } = opsi;
  const tenggatDate = tenggatAkhirBulan();
  const sisaHari = Math.ceil((tenggatDate - new Date()) / (1000 * 60 * 60 * 24));
  const namaTemplate = 'PENGINGAT_DEADLINE (Baileys)';

  const hasil = { success: [], failed: [] };

  if (!skipAntiSpam && (await sudahDikirimHariIni(namaTemplate, unit.nama_unit))) {
    console.log(`[Reminder] Skip ${unit.nama_unit}: sudah diingatkan hari ini.`);
    return { ...hasil, skipped: true };
  }

  for (const p of unit.penanggung) {
    try {
      const ok = await whatsappService.notifikasiPengingatDeadline(
        p.no_hp, p.nama, unit.nama_unit, tenggat, sisaHari
      );
      (ok ? hasil.success : hasil.failed).push({ phone: p.no_hp, nama: p.nama });
      await delay(DELAY_ANTAR_PESAN_MS);
    } catch (err) {
      hasil.failed.push({ phone: p.no_hp, error: err.message });
    }
  }

  await catatLog(
    namaTemplate,
    `${unit.nama_unit} (${hasil.success.length + hasil.failed.length} kontak)`,
    `${hasil.success.length} Berhasil, ${hasil.failed.length} Gagal (Otomatis Baileys)`
  );

  return hasil;
}

/**
 * Broadcast manual dari UI admin — tetap via Baileys.
 * Kontrak input sama seperti sebelumnya agar frontend tidak jebol:
 * { messageType: 'text'|'template', messageText, templateName, unitPenerima }
 */
async function broadcastBaileys({ messageType, messageText, templateName, unitPenerima = 'SEMUA' }) {
  let isiPesan = messageText;

  if (messageType === 'template') {
    const tpl = await prisma.konfigurasiTemplate.findUnique({
      where: { nama_template: templateName },
    });
    if (!tpl || !tpl.isi_pesan) {
      throw new Error(`Template lokal "${templateName}" tidak ditemukan`);
    }
    isiPesan = tpl.isi_pesan;
  }

  if (!isiPesan || !isiPesan.trim()) {
    throw new Error('Isi pesan tidak boleh kosong');
  }

  const wherePengguna = { peran: 'USER_UNIT', no_hp: { not: null } };
  if (unitPenerima !== 'SEMUA') {
    wherePengguna.unit = { jenis_unit: unitPenerima };
  }

  const users = await prisma.pengguna.findMany({
    where: wherePengguna,
    select: { nama: true, no_hp: true, unit: { select: { nama_unit: true } } },
  });

  const results = { success: [], failed: [] };
  for (const u of users) {
    if (!u.no_hp || !u.no_hp.trim()) continue;
    try {
      const ok = await whatsappService.kirimPesan(u.no_hp, isiPesan);
      (ok ? results.success : results.failed).push({ phone: u.no_hp, nama: u.nama });
      await delay(DELAY_ANTAR_PESAN_MS);
    } catch (err) {
      results.failed.push({ phone: u.no_hp, error: err.message });
    }
  }

  const judul = messageType === 'template' ? templateName : 'Teks Bebas (Baileys)';
  await catatLog(
    judul,
    `${results.success.length + results.failed.length} Pengguna`,
    `${results.success.length} Berhasil, ${results.failed.length} Gagal (Baileys)`
  );

  return results;
}

module.exports = {
  cariUnitBelumLapor,
  cariRevisiTertunda,
  kirimPengingatUnit,
  broadcastBaileys,
  tenggatAkhirBulan,
};
