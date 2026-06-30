/**
 * Controller: Auth
 * Login, logout, reset password
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { sendSuccess, sendError } = require('../utils/response');
const whatsappService = require('../whatsapp/baileys.service');

const MAX_LOGIN_ATTEMPTS = 5;

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, kata_sandi } = req.body;

  const pengguna = await prisma.pengguna.findUnique({
    where: { email },
    include: { unit: { select: { nama_unit: true } } },
  });

  if (!pengguna) {
    return sendError(res, 'Email atau kata sandi salah', 401);
  }

  if (pengguna.terkunci) {
    return sendError(
      res,
      'Akun Anda terkunci karena terlalu banyak percobaan login. Hubungi administrator.',
      403
    );
  }

  const isPasswordValid = await bcrypt.compare(kata_sandi, pengguna.kata_sandi);

  if (!isPasswordValid) {
    const percobaan_baru = pengguna.percobaan_login + 1;
    const terkunci = percobaan_baru >= MAX_LOGIN_ATTEMPTS;

    await prisma.pengguna.update({
      where: { id_pengguna: pengguna.id_pengguna },
      data: { percobaan_login: percobaan_baru, terkunci },
    });

    const sisaCobaan = MAX_LOGIN_ATTEMPTS - percobaan_baru;
    const pesan = terkunci
      ? 'Akun Anda terkunci karena terlalu banyak percobaan login.'
      : `Email atau kata sandi salah. Sisa percobaan: ${sisaCobaan}`;

    return sendError(res, pesan, 401);
  }

  // Reset percobaan login saat berhasil
  await prisma.pengguna.update({
    where: { id_pengguna: pengguna.id_pengguna },
    data: { percobaan_login: 0 },
  });

  const token = generateToken({
    id_pengguna: pengguna.id_pengguna,
    email: pengguna.email,
    peran: pengguna.peran,
    id_unit: pengguna.id_unit,
  });

  return sendSuccess(res, {
    token,
    pengguna: {
      id_pengguna: pengguna.id_pengguna,
      nama: pengguna.nama,
      email: pengguna.email,
      peran: pengguna.peran,
      no_hp: pengguna.no_hp,
      unit: pengguna.unit,
    },
  }, 'Login berhasil');
};

/**
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  const pengguna = await prisma.pengguna.findUnique({
    where: { id_pengguna: req.pengguna.id_pengguna },
    select: {
      id_pengguna: true,
      nama: true,
      email: true,
      peran: true,
      no_hp: true,
      created_at: true,
      unit: { select: { id_unit: true, nama_unit: true, jenis_unit: true } },
    },
  });

  return sendSuccess(res, pengguna, 'Profil berhasil diambil');
};

/**
 * POST /api/auth/reset-password/request
 * Kirim token reset password (ke email atau WhatsApp)
 */
const requestResetPassword = async (req, res) => {
  const { email } = req.body;

  const pengguna = await prisma.pengguna.findUnique({ where: { email } });

  // Selalu kembalikan respons sukses agar tidak bocor info user
  if (!pengguna) {
    return sendSuccess(res, null, 'Jika email terdaftar, instruksi reset akan dikirim.');
  }

  // Hapus token lama yang belum dipakai
  await prisma.tokenReset.deleteMany({
    where: { id_pengguna: pengguna.id_pengguna, sudah_dipakai: false },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const kedaluwarsa = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

  await prisma.tokenReset.create({
    data: {
      token,
      kedaluwarsa_pada: kedaluwarsa,
      id_pengguna: pengguna.id_pengguna,
    },
  });

  // Selalu tampilkan token di console untuk mempermudah testing
  console.log(`[RESET TOKEN] ${pengguna.email}: ${token}`);

  // Kirim token via WhatsApp jika no_hp tersedia
  if (pengguna.no_hp) {
    whatsappService
      .kirimTokenReset(pengguna.no_hp, pengguna.nama, token)
      .catch((err) => console.error('[WA] Gagal kirim token reset:', err.message));
  }

  return sendSuccess(res, null, 'Instruksi reset kata sandi telah dikirim.');
};

/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  const { token, kata_sandi_baru } = req.body;

  const tokenRecord = await prisma.tokenReset.findUnique({ 
    where: { token },
    include: { pengguna: { select: { no_hp: true } } }
  });

  if (!tokenRecord) {
    return sendError(res, 'Token tidak valid', 400);
  }

  if (tokenRecord.sudah_dipakai) {
    return sendError(res, 'Token sudah digunakan', 400);
  }

  if (new Date() > tokenRecord.kedaluwarsa_pada) {
    return sendError(res, 'Token sudah kedaluwarsa', 400);
  }

  const hashed = await bcrypt.hash(kata_sandi_baru, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  await prisma.$transaction([
    prisma.pengguna.update({
      where: { id_pengguna: tokenRecord.id_pengguna },
      data: { kata_sandi: hashed, percobaan_login: 0, terkunci: false },
    }),
    prisma.tokenReset.update({
      where: { id_token_reset: tokenRecord.id_token_reset },
      data: { sudah_dipakai: true },
    }),
  ]);

  // Notifikasi WhatsApp jika password berhasil direset
  if (tokenRecord.pengguna.no_hp) {
    const pesan =
      '✅ *Kata sandi berhasil direset*\n\n' +
      'Halo, kata sandi akun Anda telah berhasil diubah.\n' +
      'Jika ini bukan Anda, segera hubungi admin.';

    whatsappService
      .kirimPesan(tokenRecord.pengguna.no_hp, pesan)
      .catch((err) => console.error('[WA] Gagal kirim notif reset:', err.message));
  }

  return sendSuccess(res, null, 'Kata sandi berhasil direset. Silakan login.');
};

/**
 * POST /api/auth/ganti-password
 */
const gantiPassword = async (req, res) => {
  const { kata_sandi_lama, kata_sandi_baru } = req.body;

  const pengguna = await prisma.pengguna.findUnique({
    where: { id_pengguna: req.pengguna.id_pengguna },
  });

  const isValid = await bcrypt.compare(kata_sandi_lama, pengguna.kata_sandi);
  if (!isValid) {
    return sendError(res, 'Kata sandi lama tidak sesuai', 400);
  }

  const hashed = await bcrypt.hash(kata_sandi_baru, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  await prisma.pengguna.update({
    where: { id_pengguna: req.pengguna.id_pengguna },
    data: { kata_sandi: hashed },
  });

  return sendSuccess(res, null, 'Kata sandi berhasil diubah');
};

module.exports = { login, getProfile, requestResetPassword, resetPassword, gantiPassword };
