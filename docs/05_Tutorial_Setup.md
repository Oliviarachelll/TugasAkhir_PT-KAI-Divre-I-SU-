# Panduan Instalasi dan Setup Proyek (Tutorial Setup)

Dokumen ini memandu langkah demi langkah menjalankan Sistem Informasi RACHE secara lokal dari nol sampai bisa login.

> Untuk rekan yang melakukan pull implementasi export, keamanan, dan WhatsApp,
> gunakan urutan terbaru di `08_Panduan_Handoff_Setelah_Pull.md`.

Hasil akhir yang diharapkan:

- Backend (API) jalan di `http://localhost:5000`
- Frontend (tampilan web) jalan di `http://localhost:3000`
- Bisa login dengan akun bawaan (lihat `01_Akun_dan_Akses.md`)

---

## 1. Persiapan Sistem (Prerequisites)

Pastikan sudah terinstal:

- **Node.js versi 22.13.0 atau lebih baru** agar kompatibel dengan Vite 8 dan runtime export Puppeteer. Cek dengan:
  ```bash
  node -v
  npm -v
  ```
- **MySQL** — bisa lewat XAMPP / Laragon / MySQL Server. Pastikan service MySQL **menyala**.
- **Git** (opsional, bila clone dari repository).
- Code editor, mis. **VS Code**.

---

## 2. Setup Database

1. Nyalakan MySQL (mis. klik *Start* pada MySQL di XAMPP).
2. Buat database kosong bernama `rache_db` (via phpMyAdmin atau CLI):
   ```sql
   CREATE DATABASE rache_db;
   ```

---

## 3. Setup Backend (Server & API)

1. Buka terminal, masuk ke folder backend (sesuaikan path di komputer Anda):
   ```bash
   cd backend
   ```
2. Instal library:
   ```bash
   npm install
   ```
3. Buat file `.env` dari contoh yang tersedia:
   ```bash
   copy .env.example .env
   ```
   Lalu buka `.env` dan sesuaikan minimal 2 baris ini:
   ```env
   DATABASE_URL="mysql://root:PASSWORD_ANDA@localhost:3306/rache_db"
   JWT_SECRET="ganti_dengan_kata_acak_yang_panjang"
   ```
   Keterangan:
   - `PASSWORD_ANDA` = password MySQL Anda (kosongkan bila MySQL tanpa password: `mysql://root:@localhost:3306/rache_db`).
   - `PORT` default `5000`, `CORS_ORIGIN` default `http://localhost:3000` — umumnya tidak perlu diubah.
   - WhatsApp (`ENABLE_WHATSAPP`) default mati, jadi bisa diabaikan untuk pertama kali jalan.

4. Buat tabel + data awal (unit, akun, komoditi, target, laporan contoh):
   ```bash
   npx prisma db push
   npm run prisma:seed
   ```
   > Catatan: perintah resminya `npm run prisma:seed` (bukan `npx prisma db seed`).
   > Seed aman dijalankan ulang — data bawaan memakai upsert dan tanggal yang sudah ada akan dilewati.

5. Jalankan backend:
   ```bash
   npm run dev
   ```
   Tunggu sampai muncul:
   ```
   ✅ Database terhubung
   🚀 Server berjalan di http://localhost:5000
   ```
   **Biarkan terminal ini tetap menyala.** Jangan tutup.

6. Tes cepat (terminal lain / browser): buka `http://localhost:5000/health`.
   Harus muncul `{"success":true,"message":"Server sehat",...}`.

---

## 4. Setup Frontend (Tampilan Web)

1. Buka terminal **baru** (terminal backend biarkan jalan), masuk ke folder frontend:
   ```bash
   cd frontend
   ```
2. Instal library:
   ```bash
   npm install
   ```
3. Jalankan frontend:
   ```bash
   npm run dev
   ```
   Tunggu sampai muncul `Local: http://localhost:3000/`.
   > Frontend tidak butuh file `.env` — request ke `/api` otomatis diteruskan ke backend `:5000`.

---

## 5. Cara Mengakses Aplikasi

1. Buka browser (Chrome/Edge): `http://localhost:3000`
2. Login dengan salah satu akun bawaan (daftar lengkap di `01_Akun_dan_Akses.md`):
   - IT: `it@rache.id` / `it@rache123`
   - Admin Global: `admin@rache.id` / `admin@rache123`
   - Unit KNA: `unit.kna@rache.id` / `kna@rache123`
   - Unit Barang: `unit.barang@rache.id` / `barang@rache123`
   - Unit Penumpang: `unit.penumpang@rache.id` / `penumpang@rache123`
   - Unit Keuangan: `unit.keuangan@rache.id` / `keuangan@rache123`
3. Setelah login sebagai unit, buka **Target Saya** — isi target + (khusus unit barang) program tahunan **sekali setahun**, lalu buat laporan harian di **Input Laporan**.

Selamat! RACHE sudah berjalan lokal di komputer Anda. 🚀

---

## 6. Masalah Umum (Troubleshooting)

| Gejala | Penyebab & Solusi |
|---|---|
| `Can't reach database` / `Access denied` saat `db push` | MySQL belum nyala, atau password di `DATABASE_URL` salah. Nyalakan MySQL dan perbaiki `.env`. |
| `npx prisma migrate dev` gagal (shadow DB) | Abaikan migrate, pakai `npx prisma db push` seperti langkah 4. |
| `EPERM ... query_engine` saat generate | Matikan dulu server backend yang sedang jalan, ulangi perintahnya, lalu nyalakan lagi. |
| Port 5000/3000 sudah dipakai | Tutup aplikasi yang memakai port tersebut, atau jalankan ulang terminal. |
| Dibuka `http://localhost:5000/api/...` langsung di browser muncul 401 | Wajar — API butuh login. Buka aplikasinya di `http://localhost:3000`, bukan URL API. |
| Mental ke halaman login / `Sesi telah habis` | Token kedaluwarsa (7 hari) atau terhapus. Login ulang. |
| Halaman Target tidak bisa dibuka user unit | Pastikan sudah login ulang setelah update (sesi lama tidak punya `id_unit`). Menu Target memang hanya ada untuk USER_UNIT. |
| Grafik masih menampilkan data contoh | Data contoh dari seed. Hapus via database bila ingin mulai dari nol, atau timpa dengan laporan asli. |
