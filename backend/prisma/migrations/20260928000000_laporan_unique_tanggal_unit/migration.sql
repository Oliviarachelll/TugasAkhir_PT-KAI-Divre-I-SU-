-- Sinkron seed 1-27 Sep 2026: satu unit hanya boleh satu laporan per tanggal.
CREATE UNIQUE INDEX `laporan_tanggal_id_unit_key` ON `laporan` (`tanggal`, `id_unit`);
