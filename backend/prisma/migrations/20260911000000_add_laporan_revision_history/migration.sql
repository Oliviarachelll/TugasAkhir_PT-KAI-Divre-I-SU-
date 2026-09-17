ALTER TABLE `log_audit`
  ADD COLUMN `tabel_terkait` VARCHAR(100) NULL,
  ADD COLUMN `id_record_terkait` INTEGER NULL;

CREATE TABLE `revisi_laporan` (
  `id_revisi` INTEGER NOT NULL AUTO_INCREMENT,
  `versi` INTEGER NOT NULL,
  `data_sebelum` JSON NOT NULL,
  `data_sesudah` JSON NOT NULL,
  `field_berubah` JSON NOT NULL,
  `id_laporan` INTEGER NOT NULL,
  `id_pengguna` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `revisi_laporan_id_laporan_versi_key` (`id_laporan`, `versi`),
  PRIMARY KEY (`id_revisi`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `revisi_laporan`
  ADD CONSTRAINT `revisi_laporan_id_laporan_fkey`
    FOREIGN KEY (`id_laporan`) REFERENCES `laporan` (`id_laporan`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `revisi_laporan_id_pengguna_fkey`
    FOREIGN KEY (`id_pengguna`) REFERENCES `pengguna` (`id_pengguna`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
