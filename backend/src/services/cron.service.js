const cron = require('node-cron');
const prisma = require('../config/database');

// Helper to format phone number to Meta's requirement
const formatPhoneNumber = (rawNumber) => {
  let phone = rawNumber.trim();
  if (/^\d+$/.test(phone)) {
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
  }
  return phone;
};

// Function to send the broadcast to Meta
const executeBroadcast = async (template) => {
  try {
    const { nama_template, isi_pesan, unit_penerima } = template;
    console.log(`[Cron] Executing scheduled broadcast for template: ${nama_template}`);

    // Build where clause based on unit_penerima
    let whereClause = {
      peran: 'USER_UNIT',
      OR: [
        { no_hp: { not: null } },
        { bsuid: { not: null } }
      ]
    };

    if (unit_penerima !== 'SEMUA') {
      whereClause.unit = unit_penerima;
    }

    const users = await prisma.pengguna.findMany({
      where: whereClause,
      select: { no_hp: true, bsuid: true }
    });

    const targets = users.map(u => {
      if (u.bsuid) return u.bsuid;
      return u.no_hp;
    }).filter(target => target && target.trim() !== '');

    if (targets.length === 0) {
      console.log(`[Cron] Skipping broadcast for ${nama_template}, no valid targets.`);
      return;
    }

    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_WA_API_VERSION || 'v20.0';

    if (!accessToken || !phoneNumberId) {
      console.error('[Cron] Meta API credentials are not configured in .env');
      return;
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    
    let successCount = 0;
    let failedCount = 0;

    for (const rawNumber of targets) {
      const phone = formatPhoneNumber(rawNumber);
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          preview_url: false,
          body: isi_pesan
        }
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

        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    // Log to LogNotifikasi
    const penerimaText = `${successCount + failedCount} Pengguna`;
    const statusText = `${successCount} Berhasil, ${failedCount} Gagal`;

    await prisma.logNotifikasi.create({
      data: {
        template: nama_template,
        penerima: penerimaText,
        status: statusText + ' (Otomatis)'
      }
    });

    console.log(`[Cron] Broadcast ${nama_template} completed: ${statusText}`);

  } catch (error) {
    console.error(`[Cron] Error executing broadcast for template ${template.nama_template}:`, error);
  }
};

const initCronJobs = () => {
  console.log('🕒 Initializing Cron Scheduler...');

  // Run every day at 09:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('🕒 Running daily scheduled broadcast check...');
    
    try {
      const now = new Date();
      const currentDay = now.getDate();
      const currentDayOfWeek = now.getDay();
      
      // Calculate last day of the current month
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const triggersToRun = [];

      // MINGGUAN: Runs on Monday (day 1)
      if (currentDayOfWeek === 1) triggersToRun.push('MINGGUAN');

      // BULANAN: Runs on the 1st of every month
      if (currentDay === 1) triggersToRun.push('BULANAN');

      // H_MIN_1: Runs 1 day before the last day of the month
      if (currentDay === lastDayOfMonth - 1) triggersToRun.push('H_MIN_1');

      // H_MIN_3: Runs 3 days before the last day of the month
      if (currentDay === lastDayOfMonth - 3) triggersToRun.push('H_MIN_3');

      if (triggersToRun.length > 0) {
        console.log(`[Cron] Active triggers today: ${triggersToRun.join(', ')}`);
        
        const templates = await prisma.konfigurasiTemplate.findMany({
          where: {
            trigger_waktu: {
              in: triggersToRun
            }
          }
        });

        if (templates.length > 0) {
          console.log(`[Cron] Found ${templates.length} templates to broadcast.`);
          for (const template of templates) {
            await executeBroadcast(template);
          }
        } else {
          console.log('[Cron] No matching templates found for today\'s triggers.');
        }
      } else {
        console.log('[Cron] No active triggers for today.');
      }
    } catch (error) {
      console.error('[Cron] Error during scheduled check:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Jakarta" // Set timezone accordingly
  });
};

module.exports = { initCronJobs };
