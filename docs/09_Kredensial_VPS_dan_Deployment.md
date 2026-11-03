# 🖥️ Dokumentasi Akses VPS & Kredensial Sistem DashKAI

Dokumen ini mencatat seluruh informasi akses infrastruktur, server VPS, database, serta kredensial akun aplikasi DashKAI yang telah aktif di lingkungan produksi (Tencent Cloud).

---

## 🌐 1. Profil Server & Akses SSH

| Parameter | Keterangan |
| :--- | :--- |
| **Penyedia Hosting** | Tencent Cloud Lighthouse (Region Singapore) |
| **Sistem Operasi** | Ubuntu 24.04 LTS (Noble Numbat) |
| **IP Publik Server** | `43.157.241.115` |
| **User SSH** | `ubuntu` |
| **Password Awal** | `Ulangandadakan2#` |
| **Autentikasi Utama** | **SSH Key (`id_ed25519`)** — Passwordless login |
| **File Kunci Lokal** | `~/.ssh/id_ed25519` (Public key terdaftar di `~/.ssh/authorized_keys` VPS) |

### Perintah Masuk ke VPS (Terminal / PowerShell):
```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@43.157.241.115
```

---

## 🌍 2. Domain & Sertifikat SSL (HTTPS)

| Komponen | Nilai / Konfigurasi |
| :--- | :--- |
| **Domain Utama** | **`https://dashkai.us.ci`** |
| **DNS Provider** | FreeDNS ([afraid.org](https://freedns.afraid.org/)) |
| **Record DNS** | `A` record -> `43.157.241.115` |
| **SSL / TLS Certificate** | Let's Encrypt (Otomatis via Certbot) |
| **Lokasi Sertifikat** | `/etc/letsencrypt/live/dashkai.us.ci/fullchain.pem` |
| **Lokasi Private Key** | `/etc/letsencrypt/live/dashkai.us.ci/privkey.pem` |
| **Auto-Renewal** | Aktif melalui timer systemd `certbot.timer` (otomatis renew sebelum 90 hari) |
| **Redirect Port 80** | HTTP otomatis dialihkan ke HTTPS (HTTP 301 Moved Permanently) |

---

## 🗄️ 3. Database MySQL Server

| Parameter | Nilai |
| :--- | :--- |
| **Database Engine** | MySQL 8.0 |
| **Host & Port** | `127.0.0.1:3306` (Hanya listen internal / localhost) |
| **Nama Database** | `dashkai_db` |
| **Username DB** | `lucky` |
| **Password DB** | `Ulangandadakan2#` |
| **Koneksi Root Admin** | `sudo mysql` (Autentikasi unix socket tanpa password) |

### Format Connection String (`DATABASE_URL`):
> *Catatan: Simbol `#` wajib di-URL encode menjadi `%23` agar tidak dianggap URL fragment oleh driver Prisma.*
```env
DATABASE_URL="mysql://lucky:Ulangandadakan2%23@localhost:3306/dashkai_db"
```

---

## 📂 4. Direktori Aplikasi & Layanan di VPS

| Item | Lokasi / Nilai |
| :--- | :--- |
| **Root Aplikasi** | `/var/www/dashkai` |
| **Symlink Rilis Aktif** | `/var/www/dashkai/current` |
| **Shared Env (`.env`)** | `/var/www/dashkai/shared/.env` (Mode 600) |
| **Shared WA Session** | `/var/www/dashkai/shared/whatsapp-session` |
| **Frontend Static** | `/var/www/dashkai/current/frontend/dist` |
| **Backend Node.js** | `/var/www/dashkai/current/backend` |
| **Port Internal Backend** | `127.0.0.1:5050` |
| **Nama Proses PM2** | `dashkai-backend` |
| **Config Nginx** | `/etc/nginx/sites-available/dashkai` (symlink ke `sites-enabled`) |

---

## 🔑 5. Daftar Akun Pengguna Aplikasi DashKAI

Akun-akun berikut telah di-seeding ke database `dashkai_db` dan dapat langsung digunakan untuk masuk ke **https://dashkai.us.ci**:

| No | Unit / Departemen | Peran (*Role*) | Nama Pengguna | Email Login | Kata Sandi |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Unit Pusat** | `IT` | IT Administrator | `it@kai.id` | `it@kai123` |
| 2 | **Unit Pusat** | `ADMIN_GLOBAL` | Admin Global | `admin@kai.id` | `admin@kai123` |
| 3 | **Unit KNA** | `USER_UNIT` | Admin Unit KNA | `unit.kna@kai.id` | `kna@kai123` |
| 4 | **Unit Angkutan Barang** | `USER_UNIT` | Admin Unit Barang | `unit.barang@kai.id` | `barang@kai123` |
| 5 | **Unit Angkutan Penumpang** | `USER_UNIT` | Admin Unit Penumpang | `unit.penumpang@kai.id` | `penumpang@kai123` |
| 6 | **Unit Keuangan** | `USER_UNIT` | Admin Unit Keuangan | `unit.keuangan@kai.id` | `keuangan@kai123` |
| 7 | **Unit Pusat (Uji Skenario)** | `USER_UNIT` | User Terkunci | `terkunci@kai.id` | `kunci@kai123` *(Status Terkunci)* |

---

## 🛠️ 6. Cheat Sheet Perintah Operasional Server

### Mengelola Daemon Backend (PM2):
```bash
# Cek status proses
pm2 status

# Melihat log realtime backend
pm2 logs dashkai-backend

# Restart aplikasi backend
pm2 restart dashkai-backend

# Simpan state PM2 setelah perubahan
pm2 save
```

### Mengelola Web Server (Nginx):
```bash
# Tes validitas sintaks konfigurasi Nginx
sudo nginx -t

# Reload konfigurasi tanpa downtime
sudo systemctl reload nginx

# Cek status service Nginx
sudo systemctl status nginx
```

### Menguji Sertifikat SSL:
```bash
# Simulasi perpanjangan sertifikat
sudo certbot renew --dry-run
```

### Akses Cepat Database via CLI:
```bash
# Masuk ke MySQL console
sudo mysql -D dashkai_db

# Cek tabel pengguna
SELECT id_pengguna, nama, email, peran FROM dashkai_db.pengguna;
```
