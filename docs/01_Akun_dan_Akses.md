# Kredensial & Akses Pengguna

Dokumen ini berisi daftar akun default yang telah di-seeding ke dalam sistem untuk keperluan *development* dan *testing*.

## 1. Akses Role: IT Support
Role ini memiliki akses tertinggi untuk sistem monitoring, pengaturan infrastruktur, dan pengelolaan masalah (*Helpdesk*).
- **Email / Username:** `it@rache.id`
- **Password Default:** `admin` (di frontend mockup) / `ITRache2026!` (di backend/database asli jika sudah terhubung)
- **Akses Halaman:** Dashboard IT, Monitoring Sistem, Helpdesk, Notifikasi, Settings.

## 2. Akses Role: ADMIN GLOBAL (Pusat)
Role ini bertanggung jawab melakukan rekapitulasi data dari seluruh unit, melihat laporan analitik, dan me-review (*ACC/Revisi*) laporan unit.
- **Email / Username:** `admin@rache.id`
- **Password Default:** `admin` (di frontend mockup) / `AdminRache2026!` (di backend/database asli jika sudah terhubung)
- **Akses Halaman:** Dashboard Admin, Review Laporan, History Laporan, Analitik & Grafik, Manajemen Unit, Manajemen User, Helpdesk, Notifikasi, Settings.

## 3. Akses Role: USER UNIT (Admin Unit Daop)
Role ini bertugas mengisi laporan harian dan mengecek target yang telah ditetapkan pusat untuk wilayah operasionalnya.
- **Email / Username:** `unit@rache.id`
- **Password Default:** `admin` (di frontend mockup) / `UnitRache2026!` (di backend/database asli jika sudah terhubung)
- **Akses Halaman:** Dashboard Unit, Input Laporan, History Laporan, Target Saya, Helpdesk, Settings.

## 4. Simulasi Akun Terkunci (Mockup)
Digunakan untuk menguji coba fitur Helpdesk IT (Generate Token) saat pengguna tidak bisa login.
- **Email / Username:** `terkunci@rache.id`
- **Password:** `admin`
- **Perilaku:** Saat dicoba login, sistem akan merespon dengan error 403 (Akun Terkunci) dan menampilkan tombol ke halaman Bantuan IT.

---

> **Catatan:** Pada tahap produksi (Production), seluruh password akan di-enkripsi menggunakan *Bcrypt*. Pengguna baru yang ditambahkan oleh Admin/IT akan diberikan password *default* seperti `Rache2026!` dan wajib mengubahnya saat login pertama kali.
