# Dokumentasi Web & Arsitektur Frontend

Dokumen ini menjelaskan struktur teknologi yang digunakan untuk membangun antarmuka pengguna (Frontend) Sistem Informasi RACHE.

## 1. Tech Stack (Frontend)
- **Framework:** React.js (v18+)
- **Build Tool:** Vite (v8) untuk kompilasi yang sangat cepat (HMR).
- **Styling:** Vanilla CSS murni (`index.css`) dipadukan dengan utility-first classes bawaan TailwindCSS yang diadaptasi tanpa config berat, untuk kecepatan *prototyping*.
- **State Management:** Zustand (ringan, cepat, dan mendukung persistensi state ke *localStorage*).
- **Routing:** React Router DOM (v6) dengan pelindung *role-based access* (`ProtectedRoute`).
- **HTTP Client:** Axios dengan sistem *Interceptor* untuk otomatisasi Token Bearer di setiap request.
- **Charts:** Recharts (Library grafik berbasis SVG yang responsif untuk Analitik).
- **Icons:** Lucide React.

## 2. Pendekatan Desain (UI/UX)
Sistem ini menggunakan gaya desain **Premium Enterprise Light Mode**. Desain ini dirancang berdasarkan instruksi ketat dari **22 Wireframe Low-Fi** milik pengguna, dengan karakteristik utama:
1. **Layout Bersih & Minimalis:** Latar belakang konten berwarna abu-abu sangat muda (`#F4F5F7`) dipadukan dengan *card* putih solid.
2. **Navigasi Terpusat:** Sidebar vertikal berwarna dark-grey (`#2E2E2E`) yang sangat kontras dengan konten, persis seperti rancangan *Dashboard Admin* pada wireframe 03.
3. **Split-Screen Login:** Layar login dibagi dua secara presisi (50% area gelap di kiri untuk *branding*, 50% area putih di kanan untuk *form*), merujuk langsung pada gambar *01 Login.png*.
4. **Hierarki Visual:** Tidak ada elemen bayangan (shadow) atau efek kaca (glassmorphism) yang berlebihan. Form dan tombol menggunakan *flat-border* yang kokoh.

## 3. Sistem Routing dan Role-Based Access Control (RBAC)
Frontend memastikan pengguna hanya bisa mengakses halaman yang berhak mereka lihat:
- `<ProtectedRoute />` akan memvalidasi apakah pengguna sudah login (`isAuthenticated`).
- `<ProtectedRoute allowedRoles={['ADMIN_GLOBAL', 'IT']} />` akan memblokir pengguna biasa (`USER_UNIT`) jika mereka mencoba masuk ke URL `/manajemen/user` secara paksa, dan mengalihkan mereka ke halaman *Unauthorized* (atau Dashboard mereka).
- **Navigasi Dinamis:** Komponen `Sidebar.jsx` membaca data `user.peran` dari Zustand dan merender *link* menu yang sesuai.

## 4. Mekanisme API & Autentikasi
1. Pengguna memasukkan Email dan Password di halaman Login.
2. Frontend (via `Axios`) menembak ke `http://localhost:5000/api/auth/login`.
3. Backend memvalidasi dan mengembalikan data pengguna beserta **JWT Token**.
4. Frontend menyimpan token ini menggunakan Zustand (tersimpan di *browser localStorage* agar tidak hilang saat di-refresh).
5. File `src/api/client.js` memiliki interceptor yang membaca token dari Zustand dan otomatis menambahkannya ke `Headers: { Authorization: "Bearer <token>" }` setiap kali frontend mengambil data dari backend.
