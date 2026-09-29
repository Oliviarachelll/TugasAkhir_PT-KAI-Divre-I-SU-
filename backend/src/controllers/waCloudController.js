const prisma = require('../config/database');
const whatsappService = require('../whatsapp/baileys.service');
const reminderService = require('../services/reminder.service');

/**
 * DEPRECATED (Meta Cloud API): BSUID/webhook tidak lagi dipakai setelah migrasi ke Baileys.
 * Fungsi dipertahankan agar tidak merusak import lama, tapi selalu melempar.
 */
function resolveContactId() {
  throw new Error('Meta webhook deprecated: gunakan Baileys (ENABLE_WHATSAPP=true)');
}

/**
 * Broadcast message via Baileys (migrasi dari Meta WhatsApp Cloud API).
 * Kontrak request tetap sama agar frontend lama tidak jebol:
 * { messageType: 'text'|'template', messageText, templateName, unitPenerima }
 */
const sendBroadcast = async (req, res) => {
  try {
    const { messageType, messageText, templateName, unitPenerima } = req.body;

    const results = await reminderService.broadcastBaileys({
      messageType,
      messageText,
      templateName,
      unitPenerima,
    });

    if (results.success.length === 0 && results.failed.length === 0) {
      return res.status(400).json({ error: 'Tidak ada unit dengan nomor HP yang valid di database.' });
    }

    // Kompatibilitas: frontend lama membaca response.results
    res.status(200).json({
      message: 'Broadcast via Baileys selesai diproses',
      results,
    });

  } catch (error) {
    console.error(`[WA-Baileys] Broadcast error: ${error.message}`);
    const status = error.message.includes('tidak ditemukan') || error.message.includes('kosong') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
};

/**
 * Webhook Verification for Meta — DEPRECATED setelah migrasi Baileys.
 * Selalu 410 agar integrasi lama jelas-jelas dimatikan.
 */
const verifyWebhook = (req, res) => {
  return res.status(410).json({ error: 'Meta webhook deprecated: gunakan Baileys (ENABLE_WHATSAPP=true)' });
};

/**
 * Receive Webhook Events from Meta — DEPRECATED setelah migrasi Baileys.
 */
const handleWebhook = async (req, res) => {
  return res.status(410).json({ error: 'Meta webhook deprecated: gunakan Baileys (ENABLE_WHATSAPP=true)' });
};

/**
 * Create a new message template — lokal saja (tidak lagi ke Meta Management API).
 */
const createTemplate = async (req, res) => {
  try {
    const { name, body, trigger, unit } = req.body;
    
    if (!name || !body) {
      return res.status(400).json({ error: 'Nama template dan isi pesan (body) wajib diisi.' });
    }

    const templateName = name.toLowerCase().replace(/\s+/g, '_');

    // Save to local database
    const template = await prisma.konfigurasiTemplate.upsert({
      where: { nama_template: templateName },
      update: {
        isi_pesan: body,
        trigger_waktu: trigger || 'MANUAL',
        unit_penerima: unit || 'SEMUA'
      },
      create: {
        nama_template: templateName,
        isi_pesan: body,
        trigger_waktu: trigger || 'MANUAL',
        unit_penerima: unit || 'SEMUA'
      }
    });

    return res.status(200).json({
      message: 'Template berhasil dibuat dan disimpan ke database lokal (Baileys).',
      data: {
        id: template.id_konfig.toString(),
        name: template.nama_template,
        status: 'APPROVED',
        category: 'LOCAL',
        language: 'id'
      }
    });

  } catch (error) {
    console.error('Error saat create template lokal:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat membuat template.' });
  }
};

/**
 * Fetch list of message templates — lokal saja (Baileys, tanpa Meta).
 */
const getTemplates = async (req, res) => {
  try {
    // Fetch local configurations ONLY (Baileys tidak butuh approval Meta)
    const configs = await prisma.konfigurasiTemplate.findMany({ orderBy: { created_at: 'desc' } });

    // Map to match frontend expected structure
    const mappedData = configs.map(localConfig => {
      return {
        id: localConfig.id_konfig.toString(),
        name: localConfig.nama_template,
        status: 'APPROVED', // lokal selalu siap kirim via Baileys
        category: 'LOCAL',
        language: 'id',
        trigger_waktu: localConfig.trigger_waktu,
        unit_penerima: localConfig.unit_penerima,
        components: [
          {
            type: 'BODY',
            text: localConfig.isi_pesan || ''
          }
        ]
      };
    });

    return res.status(200).json({
      data: mappedData
    });

  } catch (error) {
    console.error('Error saat fetch templates lokal:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat mengambil template.' });
  }
};

/**
 * Fetch logs of previous broadcasts
 */
const getLogs = async (req, res) => {
  try {
    const logs = await prisma.logNotifikasi.findMany({
      orderBy: { waktu: 'desc' },
      take: 50 // Limit to last 50 logs
    });
    
    return res.status(200).json({
      data: logs
    });
  } catch (error) {
    console.error('Error saat mengambil log notifikasi:', error);
    return res.status(500).json({ error: 'Gagal mengambil log pengiriman' });
  }
};

/**
 * Status koneksi Baileys untuk UI admin (ganti ketergantungan Meta).
 */
const getWaStatus = async (req, res) => {
  const s = whatsappService.getStatus();
  return res.status(200).json({
    data: {
      channel: 'baileys',
      connected: s.connected,
      queued: s.queued,
    },
  });
};

/**
 * Daftar unit yang belum lapor bulan berjalan (sumber panel pengingat).
 */
const getUnitBelumLapor = async (req, res) => {
  try {
    const data = await reminderService.cariUnitBelumLapor();
    return res.status(200).json({ data });
  } catch (error) {
    console.error('Error getUnitBelumLapor:', error);
    return res.status(500).json({ error: 'Gagal mengambil unit belum lapor' });
  }
};

/**
 * Kirim pengingat manual ke 1 unit via Baileys.
 * POST /wacloud/kirim-unit/:id_unit  body opsional { tenggat }
 */
const kirimPerUnit = async (req, res) => {
  try {
    const idUnit = parseInt(req.params.id_unit, 10);
    if (Number.isNaN(idUnit)) {
      return res.status(400).json({ error: 'id_unit tidak valid' });
    }
    const unit = await prisma.unit.findUnique({
      where: { id_unit: idUnit },
      include: {
        pengguna: {
          where: { peran: 'USER_UNIT', no_hp: { not: null } },
          select: { nama: true, no_hp: true },
        },
      },
    });
    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' });

    const target = {
      id_unit: unit.id_unit,
      nama_unit: unit.nama_unit,
      penanggung: unit.pengguna.filter((p) => p.no_hp && p.no_hp.trim() !== ''),
    };
    if (target.penanggung.length === 0) {
      return res.status(400).json({ error: 'Unit tidak punya penanggung dengan no_hp valid' });
    }

    const hasil = await reminderService.kirimPengingatUnit(target, {
      tenggat: req.body?.tenggat,
      skipAntiSpam: true, // manual admin selalu dikirim
    });
    return res.status(200).json({ message: 'Pengingat unit diproses via Baileys', results: hasil });
  } catch (error) {
    console.error('Error kirimPerUnit:', error);
    return res.status(500).json({ error: 'Gagal mengirim pengingat unit' });
  }
};

module.exports = {
  sendBroadcast,
  verifyWebhook,
  handleWebhook,
  createTemplate,
  getTemplates,
  getLogs,
  getWaStatus,
  getUnitBelumLapor,
  kirimPerUnit
};
