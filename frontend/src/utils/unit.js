// Kategori target tahunan berdasarkan nama unit.
// Dipakai halaman Target & dashboard agar konsisten.
export function unitKategori(namaUnit = '') {
  const n = String(namaUnit || '').toLowerCase();
  if (n.includes('kna')) return 'KNA';
  if (n.includes('barang')) return 'BARANG';
  if (n.includes('penumpang')) return 'PENUMPANG';
  if (n.includes('keuang')) return 'KEUANGAN';
  return 'OPERASIONAL';
}
