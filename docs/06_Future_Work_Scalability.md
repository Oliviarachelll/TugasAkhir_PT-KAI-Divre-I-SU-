# 06. Future Work & Scalability Plan

Dokumen ini merangkum strategi pengembangan lanjutan (*Future Work*) yang berfokus pada **skalabilitas** (*scalability*) sistem. Saat ini aplikasi masih menggunakan pendekatan yang cocok untuk fase MVP (*Minimum Viable Product*). Ketika volume data laporan bertambah pesat (mencapai puluhan ribu hingga jutaan data), beberapa struktur arsitektur perlu direkayasa ulang agar aplikasi tidak melambat.

## 1. Migrasi dari Client-Side ke Server-Side Aggregation (Dashboard)

**Kondisi Saat Ini:**
Halaman Dashboard (seperti `DashboardAdmin.jsx`) mengambil hingga ratusan data laporan mentah (termasuk seluruh detail tabel `laporan_kna`, `laporan_keuangan`, dsb.) dari API (`GET /api/laporan?limit=500`). Seluruh agregasi metrik (menghitung Total Volume, Total Pendapatan, dan distribusi Komoditi) kemudian diproses di peramban (frontend) menggunakan fungsi manipulasi array pada React `useMemo`.

**Masalah Skalabilitas:**
Saat data laporan menumpuk, *array* JSON yang dikirimkan oleh API ke *browser* akan membengkak dari ukuran Kilobyte menjadi Megabyte. Hal ini akan memicu pemborosan kuota data jaringan (*bandwidth*) serta menguras CPU dan memori (RAM) pada komputer/HP pengguna (bisa memicu *freeze* atau *lag* parah saat merender grafik).

**Rencana Peningkatan:**
*   **Buat API Statistik Khusus:** Alih-alih mengambil seluruh baris data, buat *endpoint* khusus seperti `GET /api/dashboard/stats/barang`.
*   **Agregasi di Tingkat Database (Prisma/SQL):** Manfaatkan kemampuan mesin *Database* untuk melakukan *computing*. Contohnya, kita bisa mengganti *looping* Javascript dengan fitur komputasi langsung Prisma:
    ```javascript
    const totalVolume = await prisma.laporan_barang.aggregate({
      _sum: { volume: true },
      where: { laporan: { status: 'DISETUJUI' } }
    });
    ```
*   **Data Ringan ke Frontend:** Setelah dihitung oleh mesin Server, Backend **HANYA** mengirimkan objek JSON rekapitulasi angka mentah yang sangat ringan ke React, misalnya:
    ```json
    { "totalVolume": 15000, "totalPendapatan": 500000000 }
    ```

## 2. Server-Side Pagination & Caching

**Kondisi Saat Ini:**
Pencarian dan pemfilteran pada tabel terkadang masih mengandalkan memori lokal atau hanya mengambil iterasi standar tanpa teknik *caching* (penyimpanan sementara) di memori backend.

**Rencana Peningkatan:**
*   **Implementasi Redis Caching:** Gunakan *in-memory database* seperti **Redis** untuk menyimpan hasil *query* yang sifatnya masif dan sering diakses semua orang (misalnya data ringkasan bulan ini). Jika tidak ada pengguna yang mengirim *submit* laporan baru, API akan langsung melontarkan data dari *Redis RAM* tanpa membebani *query* ke MySQL sama sekali.
*   **Cursor-Based Pagination:** Pada tabel riwayat, gunakan sistem *cursor pagination* yang dimiliki Prisma (`cursor: { id: ... }`). Teknik ini jauh lebih cepat dan konstan secara eksponensial dibandingkan metode *offset-based pagination* (`skip` dan `take`) biasa saat mengakses halaman ke-1.000 atau lebih.

## 3. Optimasi Prisma Schema (Database Indexing)

**Kondisi Saat Ini:**
Desain *database* masih berupa struktur relasional mentah biasa (standar _Foreign Key_). Belum ada optimasi penandaan (*Indexing*) khusus.

**Rencana Peningkatan:**
*   **Tambahkan Composite Index:** Pada konfigurasi file `schema.prisma`, identifikasi *field-field* yang amat sangat sering dijadikan parameter untuk filter atau diurutkan, contohnya pada kolom `tanggal`, `id_unit`, atau `status`. Tambahkan instruksi indeks:
    ```prisma
    model Laporan {
      // ...
      @@index([tanggal(sort: Desc)])
      @@index([status, id_unit])
    }
    ```
    Teknik B-Tree Indexing pada SQL akan memampukan mesin mencari status laporan spesifik di tumpukan 1 juta baris data hanya dalam hitungan `0.5` milidetik tanpa harus melakukan *Full Table Scan*.

## 4. Arsitektur Pemisahan Tugas (Background Worker & Cloud)

**Kondisi Saat Ini:**
Beban eksekusi mengunggah file bukti PDF, pembuatan tabel PDF global, hingga pemrosesan *query* berjalan seutuhnya pada satu putaran proses tunggal (_Node.js event loop_) yang sama.

**Rencana Peningkatan:**
*   **Asynchronous Background Jobs:** Untuk proses kalkulasi berat, seperti meng-*export* tabel Excel komprehensif berisi puluhan ribu *row*, jangan halangi utas (*thread*) utama Node.js. Pindahkan pekerjaan ini ke dalam sistem Antrean Pesan (_Message Broker_) menggunakan pustaka seperti **BullMQ** atau **RabbitMQ**. API utama hanya merespons *"Export Anda sedang diproses, silakan cek notifikasi nanti"*, sementara _Worker_ bekerja keras di balik layar tanpa mengganggu pengguna lain yang sedang mengakses sistem.
*   **Cloud Object Storage:** File bukti (dokumen) Laporan KNA jangan disimpan secara lokal di dalam *folder* _filesystem_ server aplikasi (seperti di `./uploads`). Migrasikan manajemen media (penyimpanan gambar/PDF) ke arsitektur layanan *Object Storage* eksternal seperti **AWS S3** atau **Google Cloud Storage (GCS)** agar *disk* (memori internal) VPS server Anda tidak cepat membengkak habis.
