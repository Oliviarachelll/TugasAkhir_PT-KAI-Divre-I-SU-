# Struktur Direktori & Proyek

Sistem ini menganut arsitektur terpisah (*decoupled*) di mana Frontend dan Backend berdiri secara mandiri dan saling berkomunikasi melalui protokol HTTP/REST API.

## D:\RACHE_TA (Root Directory)
Folder utama yang menampung seluruh file skripsi / proyek Anda, termasuk referensi gambar wireframe dan dokumen lainnya.

### 📁 /backend
Berisi seluruh logika server, koneksi database, dan REST API.
- `src/app.js`: Entry point server Express.js.
- `src/routes/`: Definisi URL API (contoh: `/api/auth`, `/api/laporan`).
- `src/controllers/`: Logika bisnis dan pemrosesan data request (contoh: validasi input, panggil Prisma).
- `src/middlewares/`: Penengah request, seperti verifikasi JWT Token (`auth.middleware.js`).
- `prisma/`: Konfigurasi ORM Database (file `schema.prisma` yang mendefinisikan tabel MySQL) dan data bawaan/seed (`seed.js`).
- `.env`: File rahasia berisi kredensial koneksi MySQL dan Secret Key JWT.

### 📁 /frontend
Berisi kode antarmuka pengguna React yang dirender di browser klien.
- `src/App.jsx`: Root komponen React.
- `src/index.css`: Tema utama (Enterprise Light Mode).
- `src/router/`: Mengatur perpindahan halaman (`index.jsx`) dan proteksi halaman (`ProtectedRoute.jsx`).
- `src/store/`: State management global menggunakan Zustand (`auth.store.js`).
- `src/api/`: Konfigurasi Axios (`client.js`) dan fungsi fetch data (`auth.api.js`).
- `src/components/`: Komponen yang bisa dipakai berulang (reusable), seperti `Sidebar.jsx`, `Header.jsx`, dan `AppLayout.jsx`.
- `src/pages/`: Terdiri dari berbagai folder sub-modul (berdasarkan wireframe):
  - `auth/`: Halaman Login.
  - `dashboard/`: Tampilan dashboard untuk masing-masing peran (Admin, IT, User Unit).
  - `laporan/`: Modul Input (Wizard), Review, dan History Laporan.
  - `helpdesk/`: Tiket bantuan, generate token darurat.
  - `manajemen/`: Pengelolaan User dan Unit.
  - `monitoring/`, `analitik/`, `notifikasi/`, `settings/`: Halaman pendukung operasional.

### 📁 /docs
Berisi panduan penggunaan dan dokumentasi arsitektur sistem.
- `01_Akun_dan_Akses.md`: Referensi sandi dan email default.
- `02_Dokumentasi_Web.md`: Penjelasan tech stack, desain UI, dan alur autentikasi.
- `03_Struktur_Proyek.md`: Penjelasan hierarki folder.
- `04_Roadmap_Pengembangan.md`: (Akan datang) Tahapan mengintegrasikan Baileys WhatsApp dan sistem Socket.io.
