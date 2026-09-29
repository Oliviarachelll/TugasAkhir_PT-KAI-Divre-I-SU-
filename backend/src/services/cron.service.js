const cron = require('node-cron');
const prisma = require('../config/database');
const whatsappService = require('../whatsapp/baileys.service');
const reminderService = require('./reminder.service');

// Eksekusi 1 template terjadwal via Baileys (pengganti executeBroadcast Meta).
// Hanya kirim ke unit yang RELEVAN: belum lapor (deadline) atau revisi tertunda.
const executeReminderBaileys = async (template) => {
  const { nama_template, isi_pesan, unit_penerima } = template;
  console.log(`[Cron-Baileys] Menjalankan template: ${nama_template}`);

  const jenis = (nama_template || '').toUpperCase();
  const isRevisi = jenis.includes('REVISI') || jenis.includes('DITOLAK');

  try {
    if (isRevisi) {
      const tertunda = await reminderService.cariRevisiTertunda(3);
      const relevan = unit_penerima === 'SEMUA'
        ? tertunda
        : tertunda.filter((l) => l.unit?.nama_unit === unit_penerima);
      if (relevan.length === 0) {
        console.log(`[Cron-Baileys] Skip ${nama_template}: tidak ada revisi tertunda.`);
        return;
      }
      let s = 0, f = 0;
      for (const lap of relevan) {
        if (!lap.pengguna?.no_hp) { f++; continue; }
        const tgl = new Date(lap.tanggal).toLocaleDateString('id-ID');
        const hari = Math.floor((Date.now() - new Date(lap.updated_at)) / 86400000);
        const ok = await whatsappService.notifikasiRevisiTertunda(
          lap.pengguna.no_hp, lap.pengguna.nama, tgl, lap.status, hari
        );
        ok ? s++ : f++;
        await new Promise((r) => setTimeout(r, 2000));
      }
      await prisma.logNotifikasi.create({
        data: {
          template: nama_template,
          penerima: `${relevan.length} Laporan tertunda`,
          status: `${s} Berhasil, ${f} Gagal (Otomatis Baileys)`,
        },
      });
      console.log(`[Cron-Baileys] ${nama_template}: ${s} berhasil, ${f} gagal.`);
      return;
    }

    // Default: pengingat deadline → hanya unit yang belum lapor bulan ini
    const belum = await reminderService.cariUnitBelumLapor();
    const target = unit_penerima === 'SEMUA'
      ? belum
      : belum.filter((u) => u.nama_unit === unit_penerima);
    if (target.length === 0) {
      console.log(`[Cron-Baileys] Skip ${nama_template}: semua unit sudah lapor.`);
      return;
    }
    // Jika template punya isi kustom, pakai broadcast teksnya; jika tidak, pakai template deadline baku
    if (isi_pesan && isi_pesan.trim() && !nama_template.toUpperCase().startsWith('PENGINGAT')) {
      const results = await reminderService.broadcastBaileys({
        messageType: 'text', messageText: isi_pesan, unitPenerima: unit_penerima,
      });
      console.log(`[Cron-Baileys] ${nama_template}: ${results.success.length} berhasil.`);
      return;
    }
    for (const unit of target) {
      await reminderService.kirimPengingatUnit(unit);
    }
    console.log(`[Cron-Baileys] ${nama_template}: pengingat ke ${target.length} unit.`);
  } catch (error) {
    console.error(`[Cron-Baileys] Error template ${template.nama_template}:`, error.message);
  }
};

const cekTriggerHarian = async () => {
  console.log('🕒 [Baileys] Cek trigger pengingat harian...');
  try {
    const now = new Date();
    const currentDay = now.getDate();
    const currentDayOfWeek = now.getDay();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const triggersToRun = [];
    if (currentDayOfWeek === 1) triggersToRun.push('MINGGUAN');
    if (currentDay === 1) triggersToRun.push('BULANAN');
    if (currentDay === lastDayOfMonth - 1) triggersToRun.push('H_MIN_1');
    if (currentDay === lastDayOfMonth - 3) triggersToRun.push('H_MIN_3');

    if (triggersToRun.length === 0) {
      console.log('[Cron-Baileys] Tidak ada trigger aktif hari ini.');
      return;
    }
    console.log(`[Cron-Baileys] Trigger aktif: ${triggersToRun.join(', ')}`);
    const templates = await prisma.konfigurasiTemplate.findMany({
      where: { trigger_waktu: { in: triggersToRun } },
    });
    if (templates.length === 0) {
      console.log('[Cron-Baileys] Tidak ada template cocok untuk trigger hari ini.');
      return;
    }
    console.log(`[Cron-Baileys] ${templates.length} template akan dijalankan.`);
    for (const template of templates) {
      await executeReminderBaileys(template);
    }
  } catch (error) {
    console.error('[Cron-Baileys] Error cek harian:', error.message);
  }
};

const cekRevisiTertunda = async () => {
  console.log('🕒 [Baileys] Cek revisi tertunda...');
  try {
    const tertunda = await reminderService.cariRevisiTertunda(3);
    if (tertunda.length === 0) {
      console.log('[Cron-Baileys] Tidak ada revisi tertunda.');
      return;
    }
    let s = 0, f = 0;
    for (const lap of tertunda) {
      if (!lap.pengguna?.no_hp) { f++; continue; }
      const tgl = new Date(lap.tanggal).toLocaleDateString('id-ID');
      const hari = Math.floor((Date.now() - new Date(lap.updated_at)) / 86400000);
      const ok = await whatsappService.notifikasiRevisiTertunda(
        lap.pengguna.no_hp, lap.pengguna.nama, tgl, lap.status, hari
      );
      ok ? s++ : f++;
      await new Promise((r) => setTimeout(r, 2000));
    }
    await prisma.logNotifikasi.create({
      data: {
        template: 'PENGINGAT_REVISI (Baileys)',
        penerima: `${tertunda.length} Laporan tertunda`,
        status: `${s} Berhasil, ${f} Gagal (Otomatis Baileys)`,
      },
    });
    console.log(`[Cron-Baileys] Revisi tertunda: ${s} berhasil, ${f} gagal.`);
  } catch (error) {
    console.error('[Cron-Baileys] Error revisi tertunda:', error.message);
  }
};

const initCronJobs = () => {
  console.log('🕒 Initializing Cron Scheduler (Baileys)...');

  // 08:00 — pengingat deadline kondisional (hanya unit belum lapor)
  cron.schedule('0 8 * * *', cekTriggerHarian, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });

  // 16:00 — pengingat revisi tertunda
  cron.schedule('0 16 * * *', cekRevisiTertunda, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });

  // 09:00 — kompatibilitas trigger lama (dulu Meta 09:00), kini via Baileys
  cron.schedule('0 9 * * *', cekTriggerHarian, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });
};

module.exports = { initCronJobs, executeReminderBaileys };
