# Ekspor PDF dan Excel

Fitur ekspor laporan dibuat di backend agar hasil tidak bergantung pada data tabel yang sedang termuat atau batas pagination frontend.

## Endpoint

```http
POST /api/exports/laporan/pdf
POST /api/exports/laporan/xlsx
Authorization: Bearer <token>
Content-Type: application/json
```

Tanpa filter, endpoint mengekspor seluruh laporan yang diizinkan untuk pengguna:

```json
{
  "filters": {}
}
```

Filter yang tersedia:

```json
{
  "filters": {
    "id_unit": 3,
    "status": "DISETUJUI",
    "tanggal_mulai": "2026-09-01",
    "tanggal_akhir": "2026-09-30"
  }
}
```

Filter bulan dapat dipakai sebagai pengganti rentang tanggal:

```json
{
  "filters": {
    "bulan": "2026-09"
  }
}
```

`bulan` tidak boleh dikombinasikan dengan `tanggal_mulai` atau `tanggal_akhir`. Nilai status yang valid adalah `DRAFT`, `DIAJUKAN`, `DISETUJUI`, `DITOLAK`, dan `REVISI`. Tahun ekspor dibatasi pada `2000–2100`. `id_unit` hanya menerima integer positif atau string yang seluruh karakternya berupa digit; boolean, array, dan string campuran ditolak.

## Otorisasi

- `ADMIN_GLOBAL` dan `IT` dapat mengekspor seluruh unit atau unit yang dipilih.
- `USER_UNIT` selalu dibatasi ke unit pada token/login, meskipun request mencoba mengirim `id_unit` lain.
- Unit terpilih divalidasi sebelum query laporan. ID unit yang tidak ada menghasilkan respons `404`, bukan file kosong dengan label semua unit.
- Setiap ekspor yang berhasil dicoba untuk dicatat sebagai `EXPORT_LAPORAN` pada log audit. Pencatatan ini bersifat *best effort*: kegagalan log dicatat di server tetapi tidak membatalkan file yang sudah berhasil dibuat.

## Isi Excel

Workbook dibangun menggunakan ExcelJS dan terdiri dari:

- `Ringkasan`
- `Laporan`
- `KNA`
- `Penumpang`
- `Barang`
- `Keuangan`
- `Transaksi`
- `SPJ`
- `Invoice`
- `Peringatan`, jika terdapat masalah kualitas data

Tanggal dan angka ditulis sebagai tipe Excel asli. Timestamp laporan dikonversi menjadi waktu dinding `Asia/Jakarta` sebelum ditulis ke sel Excel. Penjumlahan nominal dan realisasi kumulatif menggunakan `Prisma.Decimal` hingga batas renderer untuk menghindari akumulasi galat floating-point. Baris komoditi `id_komoditi=99` tidak dimasukkan ke detail atau dijumlahkan ulang.

## Isi PDF

PDF dibuat dari template Handlebars menggunakan Chromium/Puppeteer. Dokumen mencakup:

- Identitas KAI dan metadata ekspor
- Filter serta jumlah laporan
- Ringkasan status, unit, dan metrik
- Detail KNA, penumpang, barang, dan keuangan
- Rincian transaksi, SPJ, dan invoice
- Header/footer dan nomor halaman
- Peringatan kualitas data

Semua asset PDF dibaca secara lokal. Renderer memblokir request eksternal ketika Chromium membuat dokumen.

## Runtime

Gunakan Node.js `22.13.0` atau lebih baru. Puppeteer dipin pada versi `24.43.1` agar versi browser konsisten dengan package lock.

Pada container yang memang tidak dapat menjalankan Chromium sandbox, environment berikut dapat diaktifkan setelah threat assessment:

```env
PUPPETEER_NO_SANDBOX=true
```

Jangan mengaktifkan opsi tersebut secara default pada deployment yang mendukung sandbox.

### Batas concurrency

Query dan rendering dilindungi semaphore proses-lokal agar beberapa ekspor besar tidak menghabiskan memori secara bersamaan. Nilai default dan konfigurasi opsional:

```env
EXPORT_MAX_CONCURRENCY=2
EXPORT_MAX_QUEUE=10
EXPORT_QUEUE_TIMEOUT_MS=30000
```

- `EXPORT_MAX_CONCURRENCY` harus integer minimal `1`.
- `EXPORT_MAX_QUEUE` harus integer minimal `0`; nilai `0` menonaktifkan antrean tunggu.
- `EXPORT_QUEUE_TIMEOUT_MS` harus integer minimal `1`.
- Antrean penuh atau waktu tunggu habis menghasilkan respons `503` yang dapat ditampilkan frontend.
- Batas ini berlaku per proses Node.js. Pada cluster atau beberapa container, kapasitas total adalah jumlah kapasitas setiap proses.
- Saat menerima `SIGINT`/`SIGTERM`, server menutup antrean baru dan memberi ekspor aktif waktu maksimal 30 detik untuk selesai sebelum Chromium dan Prisma ditutup.

## Referensi implementasi

- [ExcelJS](https://github.com/exceljs/exceljs) untuk workbook `.xlsx`, tipe sel, style, filter, dan freeze pane.
- [Puppeteer PDF](https://pptr.dev/guides/pdf-generation) untuk rendering HTML menjadi PDF melalui Chromium.
- [Handlebars](https://handlebarsjs.com/guide/) untuk template laporan PDF yang terpisah dari controller.
- [Prisma Decimal](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types#working-with-decimal) untuk aritmetika nominal dan agregat presisi tetap.

## Validasi

Dari folder `backend`:

```bash
npm test
npm run test:pdf
```

Dari folder `frontend`:

```bash
npm run build
```

`npm run test:pdf` meluncurkan Chromium dan memastikan output memiliki signature PDF yang valid.
