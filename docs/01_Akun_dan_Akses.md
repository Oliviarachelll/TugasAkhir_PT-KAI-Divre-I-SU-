# Kredensial & Akses Pengguna

Dokumen ini berisi daftar akun yang telah di-seeding ke dalam sistem (*database*) untuk keperluan operasional awal, *development*, dan *testing*.

Sistem diatur dengan membagi akun ke dalam 5 Unit fungsional yang sudah terdaftar di database:
1. **Unit Pusat** (menjadi lokasi untuk IT dan Admin Global)
2. **Unit KNA**
3. **Unit Angkutan Barang**
4. **Unit Angkutan Penumpang**
5. **Unit Keuangan**

---

## 1. Akses Role: IT Support (Unit Pusat)
Role ini memiliki akses tertinggi untuk sistem monitoring, pengaturan infrastruktur, dan pengelolaan masalah (*Helpdesk*).
- **Email / Username:** `it@rache.id`
- **Password Default:** `it@rache123`
- **Akses Halaman:** Dashboard IT, Monitoring Sistem, Helpdesk, Notifikasi, Settings.

## 2. Akses Role: ADMIN GLOBAL (Unit Pusat)
Role ini bertanggung jawab melakukan rekapitulasi data dari seluruh unit, melihat laporan analitik, dan me-review (*ACC/Revisi*) laporan unit.
- **Email / Username:** `admin@rache.id`
- **Password Default:** `admin@rache123`
- **Akses Halaman:** Dashboard Admin, Review Laporan, History Laporan, Analitik & Grafik, Manajemen Unit, Manajemen User, Helpdesk, Notifikasi, Settings.

## 3. Akses Role: USER UNIT (Fungsional)
Role ini bertugas mengisi laporan harian dan mengecek target yang telah ditetapkan pusat untuk fungsi spesifik mereka. Masing-masing unit hanya bisa mengakses form dan data milik unitnya sendiri.

Terdapat 4 akun spesifik untuk masing-masing bidang:
- **Unit KNA**
  - **Email:** `unit.kna@rache.id`
  - **Password:** `kna@rache123`
- **Unit Angkutan Barang**
  - **Email:** `unit.barang@rache.id`
  - **Password:** `barang@rache123`
- **Unit Angkutan Penumpang**
  - **Email:** `unit.penumpang@rache.id`
  - **Password:** `penumpang@rache123`
- **Unit Keuangan**
  - **Email:** `unit.keuangan@rache.id`
  - **Password:** `keuangan@rache123`

- **Akses Halaman:** Dashboard Unit, Input Laporan, History Laporan, Target Saya, Helpdesk, Settings.

## 4. Simulasi Akun Terkunci (Skenario Testing UI)
Digunakan untuk menguji coba fitur Helpdesk IT (Generate Token) saat pengguna tidak bisa login dari sisi antarmuka web.
- **Email / Username:** `terkunci@rache.id`
- **Password:** `admin123`
- **Perilaku:** Saat dicoba login, sistem Frontend akan merespon untuk simulasi error (menampilkan tombol ke halaman Bantuan IT).
