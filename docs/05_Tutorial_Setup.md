# Panduan Instalasi dan Setup Proyek (Tutorial Setup)

Dokumen ini memandu Anda langkah demi langkah untuk menjalankan Sistem Informasi RACHE secara lokal di komputer Anda dari nol.

## 1. Persiapan Sistem (Prerequisites)
Pastikan aplikasi berikut sudah terinstal di komputer Anda:
- **Node.js** (Versi 18 ke atas disarankan)
- **MySQL** (XAMPP / Laragon / MySQL Server murni)
- **Git** (Opsional)
- Code Editor seperti **VS Code**

## 2. Setup Database
1. Nyalakan server MySQL Anda (misal: klik *Start* pada MySQL di XAMPP).
2. Buat database kosong bernama `rache_db`. Anda bisa melakukannya via phpMyAdmin atau CLI:
   ```sql
   CREATE DATABASE rache_db;
   ```

## 3. Setup Backend (Server & API)
1. Buka terminal/command prompt, lalu arahkan ke folder backend:
   ```bash
   cd D:\RACHE_TA\Source_code\backend
   ```
2. Instal semua pustaka / library yang dibutuhkan:
   ```bash
   npm install
   ```
3. Sesuaikan koneksi database. Buka file `.env` di folder `backend` dan pastikan URL-nya benar. Contoh (sesuaikan password jika ada):
   ```env
   DATABASE_URL="mysql://root:@localhost:3306/rache_db"
   PORT=5000
   JWT_SECRET="rahasia_super_aman_123"
   ```
4. Lakukan migrasi skema tabel ke MySQL dan masukkan data awal (seeding):
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```
5. Jalankan server backend:
   ```bash
   npm run dev
   ```
   > **Catatan:** Server akan berjalan di `http://localhost:5000`. Biarkan terminal ini tetap menyala.

## 4. Setup Frontend (User Interface)
1. Buka terminal **baru** (biarkan terminal backend tetap berjalan), lalu arahkan ke folder frontend:
   ```bash
   cd D:\RACHE_TA\Source_code\frontend
   ```
2. Instal pustaka yang dibutuhkan:
   ```bash
   npm install
   ```
3. Jalankan server frontend:
   ```bash
   npm run dev
   ```
   > **Catatan:** Frontend akan berjalan di `http://localhost:5173` (atau port 3000 tergantung Vite).

## 5. Cara Mengakses Aplikasi
Setelah kedua server berjalan, ikuti langkah berikut:
1. Buka web browser (Chrome/Edge/Firefox).
2. Kunjungi `http://localhost:5173` (cek port yang muncul di terminal frontend Anda).
3. Anda akan diarahkan ke halaman Login. Gunakan akun default yang telah dibuat otomatis saat proses *seeding* (merujuk pada dokumen `01_Akun_dan_Akses.md`):
   - **Admin Global:** `admin@rache.id` / Sandi: `admin`
   - **IT Support:** `it@rache.id` / Sandi: `admin`
   - **User Unit:** `unit@rache.id` / Sandi: `admin`

Selamat! Proyek RACHE sudah berhasil dijalankan secara lokal di komputer Anda. 🚀
