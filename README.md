# 🚆 RACHE — Sistem Laporan Operasional Harian Terintegrasi
### PT Kereta Api Indonesia (Persero) Divisi Regional I Sumatera Utara

[![Production Status](https://img.shields.io/badge/Production-Live-success?style=for-the-badge&logo=nginx&logoColor=white)](https://rache.us.ci)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js_22-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma_5-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MySQL 8](https://img.shields.io/badge/MySQL_8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer_24-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)](https://pptr.dev/)

---

## 📌 Ringkasan Eksekutif

**RACHE** (*Reporting & Automated Coordination Hub Enterprise*) adalah sistem informasi terpadu yang dirancang dan dikembangkan untuk mendigitalisasi serta mengotomatisasi alur pelaporan harian pada **PT Kereta Api Indonesia (Persero) Divisi Regional I Sumatera Utara**. 

Platform ini menyelesaikan kendala fragmentasi data operasional lintas unit, mempercepat rekonsiliasi data angkutan penumpang, barang, sarana/prasarana (KNA), dan keuangan harian, serta menyediakan visibilitas analitik *real-time* kepada jajaran manajemen eksekutif.

---

## 🏛️ Arsitektur Sistem

```mermaid
graph TD
    subgraph Client Tier
        Browser["Desktop & Mobile Browser"]
    end

    subgraph Edge & Reverse Proxy
        Nginx["Nginx Reverse Proxy & SSL (rache.us.ci)"]
    end

    subgraph Application Tier
        ViteSPA["React 19 SPA (Static Bundle)"]
        ExpressApp["Express.js REST & WebSocket API (Port 5050)"]
        Worker["Notification Worker & Node-Cron Service"]
        PuppeteerEngine["Puppeteer PDF Rendering Engine"]
    end

    subgraph Data & Integration Tier
        MySQL[(MySQL 8.0 with Prisma ORM)]
        WhatsAppAPI["WhatsApp Gateway (Baileys Multi-Device)"]
    end

    Browser -->|HTTPS / WSS| Nginx
    Nginx -->|Static Assets /| ViteSPA
    Nginx -->|API Proxy /api/| ExpressApp
    Nginx -->|WebSocket /socket.io/| ExpressApp
    ExpressApp -->|Prisma Client| MySQL
    ExpressApp -->|Generate PDF| PuppeteerEngine
    Worker -->|Queue Processor| WhatsAppAPI
```

---

## 🎯 Fitur Utama

### 1. 🏢 Multi-Unit Role-Based Operational Reporting
Sistem memisahkan alur penginputan dan verifikasi secara ketat berdasarkan hierarki wewenang:
- **Unit Kantor Non Angkutan (KNA)**: Pelaporan armada lokomotif, kereta, gerbong, serta kesiapan sarana prasarana.
- **Unit Angkutan Barang**: Pelaporan tonase harian, ritase komoditi (CPO, BBM, Karet, Pasir Kuarsa), dan pencapaian target volume.
- **Unit Angkutan Penumpang**: Pelaporan okupansi kereta api penumpang (KA Putri Deli, Siantar Ekspres, Sribilah), pendapatan tiket, dan ketepatan waktu (*On-Time Performance*).
- **Unit Keuangan**: Rekapitulasi arus kas harian, realisasi pendapatan lintas unit, dan anggaran operasional.
- **Unit Pusat & Admin Global**: Monitoring menyeluruh, persetujuan bertingkat (*Approval / Reject / Revision workflow*), dan verifikasi validitas data.
- **IT Support**: Pemantauan kesehatan server, audit log aktivitas, manajemen kredensial, dan modul *Helpdesk assistance*.

### 2. ⚡ Real-Time Synchronization & Notifikasi
- Didukung oleh **Socket.io** untuk pembaruan status laporan secara instan tanpa perlu me-refresh browser.
- Integrasi **WhatsApp Gateway (Baileys Engine)** untuk pengiriman reminder otomatis batas waktu pengisian laporan harian (*deadline enforcement*) dan alert revisi langsung ke nomor petugas terkait.

### 3. 📄 Automated Document Generation Engine
- **High-Fidelity PDF Export**: Menggunakan Chromium Headless via Puppeteer 24 dengan template HTML/Handlebars berstandar kop surat resmi PT KAI, tabel komparasi dinamis, dan legalisasi digital.
- **Excel Spreadsheet Export**: Menghasilkan file Excel multi-sheet terstruktur dengan formula otomatis menggunakan ExcelJS untuk kebutuhan arsip dan audit korporat.

### 4. 📊 Dashboard Analitik & Business Intelligence
- Visualisasi interaktif menggunakan Recharts menampilkan tren performa harian, persentase ketercapaian target bulanan, dan perbandingan performa antar-stasiun/unit kerja.

---

## 🔐 Keamanan & Standar Kepatuhan Data

- **Autentikasi & Otorisasi**: JSON Web Token (JWT) dengan *stateless expiration* dan enkripsi password menggunakan algoritma `bcryptjs` (12 salt rounds).
- **Audit Logging**: Setiap aksi krusial (pembuatan laporan, perubahan data, revisi, hingga penghapusan) tercatat rapi pada tabel audit trail dengan metadata IP, user agent, dan timestamp ISO.
- **Hardened HTTP Headers**: Perlindungan terhadap XSS, Clickjacking, dan MIME-sniffing menggunakan konfigurasi Helmet dan CORS whitelist ketat.

---

## 👥 Hak Akses & Akun Sistem

| Role | Cakupan Wewenang | Domain Kerja |
| :--- | :--- | :--- |
| **IT Support** | Manajemen sistem, monitoring performa, konfigurasi gateway, unlock akun pengguna | Sistem Global & Server |
| **Admin Global** | Tinjauan laporan seluruh unit, persetujuan (*approval*), analitik eksekutif, rekapitulasi data | Divre I Sumatera Utara |
| **User Unit KNA** | Pelaporan kelaikan armada, inventaris lokomotif dan sarana | Operasional KNA |
| **User Unit Barang** | Pelaporan komoditi barang, tonase harian, dan monitoring mitra kargo | Angkutan Barang |
| **User Unit Penumpang** | Pelaporan volume penumpang, pendapatan tiket harian, okupansi rute | Angkutan Penumpang |
| **User Unit Keuangan** | Pelaporan realisasi penerimaan kas dan rekonsiliasi finansial | Keuangan Divre I |

---

## 🌐 Tautan Produksi

Aplikasi ini dapat diakses secara publik pada infrastruktur cloud:
- **Production URL**: [https://rache.us.ci](https://rache.us.ci)
- **Deployment Platform**: Tencent Cloud Lighthouse (Singapore)
- **Status API Gateway**: Healthy & Monitored
