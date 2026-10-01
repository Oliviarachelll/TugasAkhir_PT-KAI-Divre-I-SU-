# Panduan Handoff Setelah Pull: Export, Keamanan, dan WhatsApp

Dokumen ini adalah panduan operasional untuk rekan pengembang yang akan menarik
perubahan fitur mulai dari export PDF/Excel sampai notifikasi WhatsApp berbasis
Baileys. Ikuti urutan ini agar dependency, database, secret, dan proses WhatsApp
tidak saling bertabrakan.

## Hasil akhir yang diharapkan

Setelah seluruh langkah selesai:

- backend aktif di `http://localhost:5000`;
- frontend aktif di `http://localhost:3000`;
- export Excel dan PDF bekerja untuk seluruh data yang diizinkan maupun sesuai
  filter;
- database memiliki tabel durable outbox `notification_job`;
- QR pairing WhatsApp dapat dibuka oleh `IT`/`ADMIN_GLOBAL` dari `/notifikasi`;
- pengguna unit dapat mendaftarkan nomor WhatsApp sendiri dari `/settings`;
- notifikasi disimpan dahulu ke outbox terenkripsi sebelum dikirim Baileys.

---

## 0. Tugas pemilik branch sebelum rekan melakukan pull

Perubahan lokal tidak dapat ditarik oleh rekan sebelum semuanya di-commit dan
di-push ke branch yang disepakati.

1. Pastikan file sumber, lockfile, migration, tes, dan dokumentasi ikut masuk ke
   commit.
2. Pastikan file rahasia berikut **tidak** masuk Git:
   - `backend/.env`;
   - `backend/whatsapp-session/`;
   - dump database yang berisi data nyata;
   - QR pairing atau screenshot kredensial.
3. Periksa status:

   ```sh
   git status --short
   git diff --check
   ```

4. Commit dan push ke branch yang disepakati sesuai prosedur tim.
5. Beri tahu rekan nama branch dan apakah database yang digunakan:
   - database lokal baru;
   - database dump khusus development; atau
   - database bersama yang migrasinya sudah diterapkan.

> Jangan mengirim isi `.env`, token, QR, atau folder session melalui Git/chat.
> Bagikan secret melalui kanal secret manager yang disepakati tim.

---

## 1. Persiapan rekan sebelum pull

### Persyaratan

- Git;
- Node.js **22.13.0 atau lebih baru**;
- npm;
- MySQL aktif;
- Chrome/Edge tidak wajib untuk aplikasi, karena Puppeteer membawa runtime
  Chromium sendiri saat dependency backend dipasang.

Periksa versi:

```sh
node -v
npm -v
git --version
```

### Amankan pekerjaan dan data lokal

1. Commit atau stash perubahan lokal milik rekan.
2. Salin `backend/.env` ke lokasi aman **di luar repository**.
3. Jika pernah pairing WhatsApp, cadangkan `backend/whatsapp-session/` ke lokasi
   aman dan jangan membagikannya.
4. Backup database sebelum menjalankan perubahan schema.
5. Hentikan backend/worker WhatsApp lama dengan `Ctrl+C`.

Hanya satu proses boleh memiliki satu `WA_SESSION_PATH` pada saat yang sama.

### Pull branch

Dari root repository:

```sh
git fetch --all --prune
git switch <nama-branch-yang-disepakati>
git pull --ff-only
```

Jika `git pull --ff-only` gagal karena perubahan lokal, jangan memakai
`git reset --hard`. Simpan pekerjaan rekan dahulu melalui commit/stash, lalu
selesaikan konflik secara sadar.

---

## 2. Instal dependency yang terkunci

Gunakan `npm ci`, bukan `npm install`, agar versi mengikuti lockfile hasil
handoff.

### Backend

```sh
cd backend
npm ci
npm run prisma:generate
```

Dependency penting yang ikut terpasang:

- `exceljs` untuk workbook Excel;
- `puppeteer@24.43.1` untuk PDF;
- `handlebars` untuk template PDF;
- `@whiskeysockets/baileys@7.0.0-rc14` untuk WhatsApp;
- `qrcode` untuk QR pairing web.

Jika Prisma gagal dengan `EPERM ... query_engine-windows.dll.node`, masih ada
proses Node/backend yang mengunci file. Hentikan proses backend secara normal,
lalu ulangi `npm run prisma:generate`.

### Frontend

Buka terminal lain atau kembali ke root repository:

```sh
cd frontend
npm ci
```

Jangan menjalankan `npm audit fix --force` sebagai langkah setup karena dapat
mengubah versi mayor dan merusak lockfile/kompatibilitas.

---

## 3. Siapkan konfigurasi backend

Gunakan kembali `.env` lokal yang sudah ada atau buat dari `.env.example`.
Jangan menimpa `.env` yang berisi kredensial lingkungan tanpa backup.

Konfigurasi minimum untuk boot pertama tanpa WhatsApp:

```env
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/rache_db"

JWT_SECRET=<secret-random-1>
TOKEN_PEPPER=<secret-random-2>
NOTIFICATION_ENCRYPTION_KEY=<secret-random-3>

ENABLE_WHATSAPP=false
ENABLE_NOTIFICATION_WORKER=false
ENABLE_NOTIFICATION_SCHEDULER=false

WA_SESSION_PATH=./whatsapp-session
WA_WEB_QR_ENABLED=true
WA_WEB_QR_TTL_MS=60000
WA_SHOW_QR_IN_TERMINAL=false
WA_EMIT_RAW_QR=false
```

Ketiga secret wajib berbeda. Untuk membuat satu nilai random 32-byte:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Jalankan perintah tersebut tiga kali dan tempatkan masing-masing hasil pada
variabel yang berbeda. Jangan mencetak ulang secret ke log atau tiket bantuan.

Konfigurasi export opsional; bila tidak ditulis, default berikut dipakai:

```env
EXPORT_MAX_CONCURRENCY=2
EXPORT_MAX_QUEUE=10
EXPORT_QUEUE_TIMEOUT_MS=30000
```

Untuk detail seluruh konfigurasi notifikasi, baca
`backend/docs/whatsapp-notifications.md`.

---

## 4. Sinkronkan database

### Penting: pilih hanya satu skenario

Migration dalam repository saat ini bersifat **incremental**, bukan baseline
lengkap untuk database kosong. Jangan menjalankan semua perintah database secara
acak atau mencampur skenario.

### Skenario A — database lokal baru (direkomendasikan untuk rekan)

Buat database kosong:

```sql
CREATE DATABASE rache_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Pastikan `DATABASE_URL` menunjuk database tersebut, lalu:

```sh
cd backend
npx prisma db push
npm run prisma:seed
npm run prisma:generate
```

`db push` membuat schema akhir langsung dari `schema.prisma`. Karena database
baru tidak memiliki token legacy, transformasi data legacy di migration tidak
diperlukan.

Seed hanya untuk lingkungan development. Jangan menjalankan seed pada database
staging/production atau database bersama tanpa persetujuan.

### Skenario B — database sudah dikelola Prisma Migrate

Backup database terlebih dahulu, kemudian:

```sh
cd backend
npx prisma migrate status
npx prisma migrate deploy
npm run prisma:generate
```

Migration keamanan `20260930000000_notification_security` akan:

- membatalkan token reset legacy yang masih aktif;
- menghapus token revisi plaintext lama;
- menambahkan `session_version` dan lock sementara pengguna;
- membuat tabel `notification_job`;
- menormalisasi konfigurasi template notifikasi legacy;
- menambahkan index laporan/notifikasi.

Setelah migration, sesi login lama dapat ditolak dan pengguna perlu login ulang.

### Skenario C — database lama dibuat dengan `prisma db push`

Jangan langsung menjalankan `migrate deploy`, karena riwayat migration database
mungkin tidak sesuai dengan schema yang sudah ada. Pilihan aman untuk development:

1. gunakan database lokal baru melalui Skenario A; atau
2. impor dump development yang sudah diperbarui oleh pemilik branch.

Jika data lama wajib dipertahankan, backup dahulu dan minta maintainer/DBA
melakukan baseline serta menjalankan migration incremental secara terkontrol.
Jangan menandai migration sebagai `--applied` tanpa memverifikasi bahwa seluruh
DDL dan transformasi datanya benar-benar sudah dijalankan.

### Verifikasi schema akhir

Jalankan pada MySQL:

```sql
SHOW TABLES LIKE 'notification_job';
SHOW COLUMNS FROM pengguna LIKE 'session_version';
SHOW COLUMNS FROM pengguna LIKE 'terkunci_sampai';
```

Ketiga pemeriksaan harus menghasilkan record.

---

## 5. Validasi backend sebelum mengaktifkan WhatsApp

Pastikan flag WhatsApp masih `false`, lalu dari folder `backend`:

```sh
npm test
npm run test:pdf
```

Hasil acuan saat handoff dibuat:

- seluruh backend: `112/112` tes lulus;
- smoke PDF menghasilkan file dengan signature PDF yang valid.

`npm run test:pdf` meluncurkan Chromium. Jika instalasi Puppeteer tidak sempat
mengunduh browser, ulangi `npm ci` pada jaringan yang mengizinkan download
package/browser Puppeteer.

Jalankan backend:

```sh
npm run dev
```

Biarkan terminal tetap terbuka. Dari terminal lain:

```sh
curl http://localhost:5000/health
```

Respons yang diharapkan memiliki:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected"
  }
}
```

---

## 6. Validasi dan jalankan frontend

Dari folder `frontend`:

```sh
npm run build
npm run dev
```

Buka `http://localhost:3000`.

Vite meneruskan `/api` dan `/socket.io` ke `http://localhost:5000`. Error berikut
berarti backend belum hidup atau portnya berbeda:

```text
[vite] http proxy error ... ECONNREFUSED
```

Periksa `http://localhost:5000/health`, lalu jalankan/restart backend. Jangan
menjalankan backend kedua pada port dan session WhatsApp yang sama.

> Build production sudah lulus saat handoff. Lint penuh repository masih
> memiliki sejumlah error lama di modul yang tidak terkait fitur ini; gunakan
> hasil `npm run build` dan tes backend sebagai gate utama sampai debt lint lama
> diselesaikan terpisah.

---

## 7. Uji fitur export Excel dan PDF

Dokumentasi teknis lengkap tersedia di `docs/07_Export_PDF_Excel.md`.

### Uji melalui UI

1. Login sebagai `ADMIN_GLOBAL` untuk menguji scope global melalui UI.
2. Buka Dashboard Admin atau halaman History Laporan. Untuk uji scope unit,
   login terpisah sebagai `USER_UNIT` dan buka History Laporan.
3. Uji **tanpa filter**:
   - biarkan unit/status/tanggal atau bulan kosong;
   - klik **Excel**;
   - klik **PDF**.
4. Uji **dengan filter**:
   - pilih satu unit;
   - pilih satu status;
   - pilih rentang tanggal pada Dashboard, atau bulan pada History;
   - export Excel dan PDF lagi.
5. Pastikan tombol menampilkan status proses dan browser mengunduh file, bukan
   JSON/error page.

Export tidak mengambil hanya baris pagination yang terlihat. Backend menjalankan
query export terpisah tanpa pagination sesuai scope pengguna.

### Hasil Excel yang harus diperiksa

Buka `.xlsx` dan pastikan sheet berikut tersedia sesuai data:

- `Ringkasan`;
- `Laporan`;
- `KNA`;
- `Penumpang`;
- `Barang`;
- `Keuangan`;
- `Transaksi`;
- `SPJ`;
- `Invoice`;
- `Peringatan` bila ada masalah kualitas data.

Periksa minimal:

- jumlah record cocok dengan filter;
- tanggal terbaca sebagai tanggal, bukan string rusak;
- nominal tetap numerik;
- data unit lain tidak bocor ke akun `USER_UNIT`;
- header dan nama unit sesuai scope.

### Hasil PDF yang harus diperiksa

Pastikan PDF:

- dapat dibuka dan tidak kosong;
- memiliki identitas, metadata filter, dan jumlah laporan;
- menampilkan tabel detail yang sesuai data;
- memiliki header/footer dan nomor halaman;
- tidak memotong teks/tabel utama secara tidak wajar.

### Matriks uji akses

| Akun/jalur | Hasil yang diharapkan |
| --- | --- |
| `ADMIN_GLOBAL` melalui UI, tanpa filter unit | Seluruh unit yang diizinkan |
| `ADMIN_GLOBAL` melalui UI, pilih unit | Hanya unit terpilih |
| `IT` melalui endpoint API | Scope global; UI export khusus IT belum tersedia pada router saat ini |
| `USER_UNIT` melalui History, tanpa filter | Hanya unit miliknya |
| `USER_UNIT`, mencoba unit lain via API | Tetap dipaksa ke unit miliknya |

### Uji endpoint opsional

Gunakan token login development yang sah:

```sh
curl -X POST http://localhost:5000/api/exports/laporan/xlsx \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  --output laporan.xlsx \
  --data "{\"filters\":{\"status\":\"DISETUJUI\",\"bulan\":\"2026-09\"}}"
```

Ganti `xlsx` menjadi `pdf` dan nama output menjadi `laporan.pdf` untuk PDF.
Jangan menggabungkan filter `bulan` dengan `tanggal_mulai`/`tanggal_akhir`.

---

## 8. Aktifkan notifikasi WhatsApp

Setelah export dan aplikasi dasar lolos, hentikan backend dengan `Ctrl+C`.
Untuk tahap pairing awal, aktifkan transport tetapi **jangan** langsung
menyalakan worker atau scheduler:

```env
ENABLE_WHATSAPP=true
ENABLE_NOTIFICATION_WORKER=false
ENABLE_NOTIFICATION_SCHEDULER=false
WA_SESSION_PATH=./whatsapp-session
WA_WEB_QR_ENABLED=true
WA_WEB_QR_TTL_MS=60000
WA_SHOW_QR_IN_TERMINAL=false
WA_EMIT_RAW_QR=false
```

Worker dapat langsung memproses job aktif yang sudah ada dalam database.
Scheduler dapat membuat reminder pada jadwal bisnis. Pada database lama/bersama,
periksa dahulu bahwa tidak ada job atau penerima yang tidak dimaksudkan sebelum
mengaktifkan keduanya.

Pastikan hanya satu proses menggunakan session tersebut, lalu:

```sh
cd backend
npm start
```

Startup tetap melanjutkan API bila Baileys sementara masuk backoff. Log versi
yang sehat berbentuk:

```text
[WA] Using WhatsApp Web version 2.3000.x (maintainer).
```

Jangan memakai dua terminal/backend sebagai owner WhatsApp yang sama.

---

## 9. Pairing WhatsApp dari web

1. Login sebagai `IT` atau `ADMIN_GLOBAL`.
2. Buka `/notifikasi`.
3. Tunggu status `pairing_required` dan QR muncul.
4. Pada ponsel utama buka:
   `WhatsApp → Perangkat tertaut → Tautkan perangkat`.
5. Scan QR dari halaman web.
6. Tunggu status menjadi `connected`.

QR hanya tersedia untuk admin terautentikasi, tidak disimpan di database, tidak
dikirim lewat Socket.IO, memakai response `no-store`, dan dihapus saat connected,
disconnected, shutdown, atau TTL habis.

Jika QR tidak muncul:

- pastikan backend benar-benar sudah direstart setelah pull;
- pastikan `WA_WEB_QR_ENABLED=true`;
- pastikan role adalah `IT` atau `ADMIN_GLOBAL`;
- pastikan tidak ada proses lain memakai `WA_SESSION_PATH`;
- periksa status melalui halaman `/notifikasi`, bukan endpoint publik;
- jangan membagikan raw QR atau folder session saat meminta bantuan.

---

## 10. Daftarkan nomor WhatsApp penerima

Nomor penerima disimpan pada `Pengguna.no_hp`, bukan pada tabel `Unit`.

### Nomor awal oleh admin

Melalui UI, gunakan akun `ADMIN_GLOBAL`:

1. buka `/manajemen/user`;
2. tambah atau edit akun unit;
3. isi **No. Kontak (WA)**;
4. simpan.

### Perubahan mandiri oleh unit

`USER_UNIT`:

1. login;
2. buka `/settings`;
3. isi nomor WhatsApp aktif;
4. isi kata sandi akun sebagai konfirmasi;
5. klik **Simpan nomor WhatsApp**.

Format `08…`, `628…`, dan `+628…` diterima dan disimpan sebagai `62…`.
Perubahan kontak membatalkan token reset lama dan dicatat dalam audit tanpa
menulis nomor mentah pada detail log.

Distribusi penerima:

- reminder deadline unit: seluruh akun `USER_UNIT` pada unit tersebut yang
  memiliki nomor valid; nomor duplikat dikolaps;
- hasil review/revisi laporan: akun pembuat laporan;
- tiket bantuan/reset password: pemilik akun/tiket sesuai workflow;
- nomor kosong atau tidak valid: dilewati, tidak ditebak atau dialihkan.

---

## 11. Uji notifikasi secara aman

Lakukan hanya dengan akun dan nomor pengujian yang disetujui.

1. Pastikan status Baileys `connected`.
2. Daftarkan satu nomor WhatsApp test pada satu akun unit.
3. Pastikan database tidak memiliki job aktif lama yang tidak boleh dikirim.
4. Hentikan backend, ubah `ENABLE_NOTIFICATION_WORKER=true`, lalu start ulang.
   Biarkan `ENABLE_NOTIFICATION_SCHEDULER=false` selama smoke test.
5. Gunakan satu aksi terbatas, misalnya perubahan status laporan test atau
   permintaan reset akun test.
6. Buka `/notifikasi` dan periksa log/outbox.
7. Pastikan status bergerak dari `PENDING`/`PROCESSING` ke `ACCEPTED`.

Aktifkan `ENABLE_NOTIFICATION_SCHEDULER=true` hanya pada satu owner setelah
scope template, jadwal, kontak, dan hasil smoke test telah diverifikasi.

`ACCEPTED` berarti provider menerima operasi kirim; status tersebut **bukan**
bukti pesan sudah dibaca atau pasti delivered.

Jangan memakai broadcast semua unit sebagai smoke test pertama. Jangan melakukan
live-send ke nomor pengguna nyata tanpa persetujuan operasional.

---

## 12. Checklist penerimaan rekan

- [ ] Pull branch berhasil tanpa menghapus pekerjaan lokal.
- [ ] Node.js minimal `22.13.0`.
- [ ] `npm ci` backend dan frontend berhasil.
- [ ] `.env` tersedia dan tiga secret berbeda.
- [ ] Database disiapkan memakai salah satu skenario yang benar.
- [ ] Tabel `notification_job` tersedia.
- [ ] `npm run prisma:generate` berhasil.
- [ ] `npm test` backend lulus (`112` tes pada handoff ini).
- [ ] `npm run test:pdf` lulus.
- [ ] `npm run build` frontend berhasil.
- [ ] `/health` menyatakan database connected.
- [ ] Export Excel tanpa filter berhasil.
- [ ] Export PDF tanpa filter berhasil.
- [ ] Export Excel/PDF dengan filter berhasil.
- [ ] Scope `USER_UNIT` tidak dapat membaca/export unit lain.
- [ ] Backend direstart setelah perubahan konfigurasi.
- [ ] QR web hanya terlihat oleh `IT`/`ADMIN_GLOBAL`.
- [ ] Baileys berstatus `connected`.
- [ ] Nomor WA unit dapat disimpan dari `/settings`.
- [ ] Worker baru diaktifkan setelah job lama diperiksa.
- [ ] Satu notifikasi test masuk durable outbox.
- [ ] Scheduler hanya aktif pada satu owner setelah scope penerima diverifikasi.
- [ ] Tidak ada `.env`, session, QR, atau secret yang masuk Git.

---

## 13. Troubleshooting ringkas

| Gejala | Pemeriksaan dan solusi |
| --- | --- |
| Vite `ECONNREFUSED` untuk `/api/...` | Backend port `5000` belum aktif. Buka `/health`, lalu start/restart backend. |
| Route baru menghasilkan `404` | Proses backend masih memuat kode lama. Hentikan dengan `Ctrl+C`, lalu start ulang. |
| API menghasilkan `401` setelah migration | Login ulang; session lama tanpa `session_version` ditolak. |
| Prisma `EPERM query_engine...` | Hentikan proses backend yang mengunci Prisma Client, lalu generate ulang. |
| Export PDF gagal launch browser | Pastikan `npm ci` backend selesai dan runtime Puppeteer terunduh. |
| Export `503` | Antrean/concurrency export penuh; tunggu atau evaluasi batas env. |
| QR tidak tersedia | Periksa flag web QR, role, status pairing, dan pastikan hanya satu owner. |
| Baileys berulang error `405` sebelum QR | Pastikan lockfile memasang Baileys `7.0.0-rc14`; jangan terus menghapus session kosong. |
| Notifikasi tidak bergerak dari pending | Periksa status Baileys, flag worker, secret encryption, dan log outbox. |
| Nomor ditolak | Gunakan nomor Indonesia valid dalam format `08…`, `628…`, atau `+628…`. |

---

## 14. Catatan rollback

- Rollback source code tidak otomatis membalik schema/migration database.
- Jangan menghapus `notification_job` hanya untuk menghilangkan error.
- Jangan mengganti `NOTIFICATION_ENCRYPTION_KEY` ketika masih ada job aktif;
  payload lama menjadi tidak dapat dibaca.
- Jika migration harus dibatalkan, gunakan backup database dan prosedur DBA,
  bukan edit manual tanpa snapshot.
- Simpan folder session WhatsApp sebagai credential dengan akses terbatas.

## Referensi

- Setup dasar: `docs/05_Tutorial_Setup.md`
- Detail export: `docs/07_Export_PDF_Excel.md`
- Arsitektur notifikasi: `backend/docs/whatsapp-notifications.md`
- Migration keamanan:
  `backend/prisma/migrations/20260930000000_notification_security/migration.sql`
