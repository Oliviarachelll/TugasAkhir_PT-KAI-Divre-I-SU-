const prisma = require('../config/database');

/**
 * Heuristik untuk mendeteksi ID kontak Meta
 */
function resolveContactId(waMessage, waContacts) {
  const contact = waContacts?.[0];
  const from = waMessage?.from; // nomor pengirim (bisa BSUID)
  
  const waId = contact?.wa_id || from;
  return {
    waId: waId,
    phoneNumber: contact?.profile?.phone_number || null,
    name: contact?.profile?.name || null,
    isBSUID: waId ? !/^\d{10,15}$/.test(waId) : false
  };
}

/**
 * Helper to format phone number to Meta's requirement (e.g., 628xxx without + or 0)
 */
const formatPhoneNumber = (rawNumber) => {
  let phone = rawNumber.trim();
  if (/^\d+$/.test(phone)) {
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
  }
  return phone;
};

/**
 * Broadcast message via Meta WhatsApp Cloud API
 */
const sendBroadcast = async (req, res) => {
  try {
    const { messageType, messageText, templateName } = req.body;

    // Fetch target phone numbers / bsuid from database
    const users = await prisma.pengguna.findMany({
      where: {
        peran: 'USER_UNIT',
        OR: [
          { no_hp: { not: null } },
          { bsuid: { not: null } }
        ]
      },
      select: { no_hp: true, bsuid: true }
    });

    const targets = users.map(u => {
      // Prioritaskan BSUID, jika tidak ada fallback ke no_hp
      if (u.bsuid) return u.bsuid;
      return u.no_hp;
    }).filter(target => target && target.trim() !== '');

    if (targets.length === 0) {
      return res.status(400).json({ error: 'Tidak ada unit dengan nomor HP / BSUID yang valid di database.' });
    }

    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_WA_API_VERSION || 'v20.0';

    if (!accessToken || !phoneNumberId) {
      return res.status(500).json({ error: 'Meta API credentials are not configured in .env' });
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    const results = {
      success: [],
      failed: []
    };

    // Note: In production with thousands of numbers, consider using a queue (e.g., BullMQ)
    for (const rawNumber of targets) {
      const phone = formatPhoneNumber(rawNumber);
      
      let payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
      };

      // Karena kita menggunakan Template Lokal, kita selalu ubah menjadi tipe TEKS BEBAS
      let actualMessageText = messageText;
      if (messageType === 'template') {
        const templateConfig = await prisma.konfigurasiTemplate.findUnique({
          where: { nama_template: templateName }
        });
        if (templateConfig && templateConfig.isi_pesan) {
          actualMessageText = templateConfig.isi_pesan;
        } else {
          // Fallback or error, for safety we skip if not found
          console.error(`Template ${templateName} tidak ditemukan di database`);
          results.failed.push({ phone: rawNumber, error: 'Template lokal tidak ditemukan' });
          continue;
        }
      }

      payload.type = 'text';
      payload.text = {
        preview_url: false,
        body: actualMessageText
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`Failed to send to ${phone}: ${JSON.stringify(data)}`);
          results.failed.push({ phone: rawNumber, error: data.error?.message || 'Unknown error' });
        } else {
          results.success.push({ phone: rawNumber, messageId: data.messages[0].id });
        }
      } catch (err) {
        console.error(`Error sending to ${phone}: ${err.message}`);
        results.failed.push({ phone: rawNumber, error: err.message });
      }
    }

    // Simpan ke LogNotifikasi
    const templateTitle = messageType === 'template' ? templateName : 'Teks Bebas';
    const penerimaText = `${results.success.length + results.failed.length} Pengguna`;
    const statusText = `${results.success.length} Berhasil, ${results.failed.length} Gagal`;

    try {
      await prisma.logNotifikasi.create({
        data: {
          template: templateTitle,
          penerima: penerimaText,
          status: statusText
        }
      });
    } catch (logErr) {
      console.error('Gagal mencatat log notifikasi:', logErr);
    }

    res.status(200).json({
      message: 'Broadcast processing completed',
      results
    });

  } catch (error) {
    console.error(`Broadcast error: ${error.message}`);
    res.status(500).json({ error: 'Internal server error during broadcast' });
  }
};

/**
 * Webhook Verification for Meta
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'rache_secure_token_123';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.status(400).send('Missing parameters');
  }
};

/**
 * Receive Webhook Events from Meta
 */
const handleWebhook = async (req, res) => {
  const body = req.body;
  
  console.log('--- Menerima Webhook dari Meta ---');
  console.log(JSON.stringify(body, null, 2));

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
      const value = body.entry[0].changes[0].value;
      const message = value.messages[0];
      const contacts = value.contacts;
      
      console.log('📩 Pesan masuk via Webhook Meta:', message);

      // Resolusi BSUID vs Nomor HP
      const contactInfo = resolveContactId(message, contacts);
      
      if (!contactInfo.waId) {
        console.warn('⚠️ Alert: Format wa_id tidak dikenali, cek payload baru dari Meta');
      } else {
        try {
          // Cari apakah nomor HP (jika ada) sudah terdaftar di DB tanpa bsuid
          let phoneToMatch = contactInfo.phoneNumber;
          if (!phoneToMatch && !contactInfo.isBSUID) {
            phoneToMatch = contactInfo.waId; // jika waId murni angka, anggap no_hp
          }

          if (phoneToMatch) {
            // Coba normalkan nomor (misal 628 -> 08 untuk pencarian)
            const localPhone = phoneToMatch.startsWith('62') ? '0' + phoneToMatch.substring(2) : phoneToMatch;
            
            const existingUser = await prisma.pengguna.findFirst({
              where: { 
                OR: [
                  { no_hp: phoneToMatch },
                  { no_hp: localPhone }
                ],
                bsuid: null 
              }
            });

            if (existingUser) {
              await prisma.pengguna.update({
                where: { id_pengguna: existingUser.id_pengguna },
                data: { bsuid: contactInfo.waId } // Simpan BSUID
              });
              console.log(`✅ Mapping BSUID berhasil untuk pengguna: ${existingUser.nama}`);
            }
          }
        } catch (dbError) {
          console.error("Gagal update BSUID ke database:", dbError);
        }
      }
      
    } else if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.statuses) {
      const status = body.entry[0].changes[0].value.statuses[0];
      console.log('🔄 Status update via Webhook Meta:', status);
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};

/**
 * Create a new message template via Meta WhatsApp Business Management API
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
      message: 'Template berhasil dibuat dan disimpan ke database lokal.',
      data: {
        id: template.id_konfig.toString(),
        name: template.nama_template,
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'id'
      }
    });

  } catch (error) {
    console.error('Error saat create template lokal:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server saat membuat template.' });
  }
};

/**
 * Fetch list of message templates from Meta
 */
const getTemplates = async (req, res) => {
  try {
    // Fetch local configurations ONLY
    const configs = await prisma.konfigurasiTemplate.findMany();

    // Map to match frontend expected structure
    const mappedData = configs.map(localConfig => {
      return {
        id: localConfig.id_konfig.toString(),
        name: localConfig.nama_template,
        status: 'APPROVED', // Mock status for UI
        category: 'UTILITY', // Mock category
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

module.exports = {
  sendBroadcast,
  verifyWebhook,
  handleWebhook,
  createTemplate,
  getTemplates,
  getLogs
};
