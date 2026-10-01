-- Invalidate every legacy reset token before changing recovery-token storage.
UPDATE `token_reset`
SET `sudah_dipakai` = true
WHERE `sudah_dipakai` = false;

-- Retain only irreversible 64-character digests for legacy reset-token rows.
UPDATE `token_reset`
SET `token` = SHA2(`token`, 256);

-- Legacy report revision tokens were stored as plaintext and cannot be retained safely.
UPDATE `laporan`
SET `token_revisi` = NULL,
    `token_revisi_exp` = NULL
WHERE `token_revisi` IS NOT NULL
   OR `token_revisi_exp` IS NOT NULL;

ALTER TABLE `pengguna`
  ADD COLUMN `session_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `terkunci_sampai` DATETIME(3) NULL;

ALTER TABLE `token_reset`
  MODIFY COLUMN `token` VARCHAR(64) NOT NULL,
  ADD COLUMN `tujuan` VARCHAR(50) NOT NULL DEFAULT 'RESET_PASSWORD',
  ADD COLUMN `used_at` DATETIME(3) NULL,
  ADD COLUMN `attempt_count` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `token_reset_id_pengguna_sudah_dipakai_kedaluwarsa_pada_idx`
  ON `token_reset` (`id_pengguna`, `sudah_dipakai`, `kedaluwarsa_pada`);

-- Preserve legacy behavior: revision-named templates were revision reminders,
-- PENGINGAT-prefixed templates were deadline reminders, and every other local
-- template was a custom broadcast. Unknown legacy scopes/triggers are converted
-- to MANUAL BROADCAST instead of silently widening a scheduled audience.
ALTER TABLE `konfigurasi_template`
  ADD COLUMN `tipe_notifikasi` ENUM('DEADLINE', 'REVISI', 'BROADCAST') NULL;

UPDATE `konfigurasi_template`
SET `unit_penerima` = UPPER(TRIM(`unit_penerima`))
WHERE UPPER(TRIM(`unit_penerima`)) IN ('SEMUA', 'PUSAT', 'DAERAH', 'CABANG');

UPDATE `konfigurasi_template`
SET `trigger_waktu` = UPPER(TRIM(`trigger_waktu`))
WHERE UPPER(TRIM(`trigger_waktu`)) IN ('MANUAL', 'MINGGUAN', 'BULANAN', 'H_MIN_1', 'H_MIN_3');

UPDATE `konfigurasi_template`
SET `tipe_notifikasi` = CASE
  WHEN UPPER(`nama_template`) LIKE '%REVISI%'
    OR UPPER(`nama_template`) LIKE '%DITOLAK%' THEN 'REVISI'
  WHEN UPPER(`nama_template`) LIKE 'PENGINGAT%' THEN 'DEADLINE'
  ELSE 'BROADCAST'
END;

UPDATE `konfigurasi_template`
SET `unit_penerima` = 'SEMUA',
    `trigger_waktu` = 'MANUAL',
    `tipe_notifikasi` = 'BROADCAST'
WHERE `unit_penerima` IS NULL
   OR `unit_penerima` NOT IN ('SEMUA', 'PUSAT', 'DAERAH', 'CABANG');

UPDATE `konfigurasi_template`
SET `trigger_waktu` = 'MANUAL',
    `tipe_notifikasi` = 'BROADCAST'
WHERE `trigger_waktu` IS NULL
   OR `trigger_waktu` NOT IN ('MANUAL', 'MINGGUAN', 'BULANAN', 'H_MIN_1', 'H_MIN_3');

UPDATE `konfigurasi_template`
SET `tipe_notifikasi` = 'BROADCAST'
WHERE `trigger_waktu` = 'MANUAL';

ALTER TABLE `konfigurasi_template`
  MODIFY COLUMN `tipe_notifikasi` ENUM('DEADLINE', 'REVISI', 'BROADCAST') NOT NULL DEFAULT 'BROADCAST';

CREATE TABLE `notification_job` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `dedupe_key` VARCHAR(191) NOT NULL,
  `jenis` ENUM(
    'PASSWORD_RESET',
    'PASSWORD_CHANGED',
    'REPORT_APPROVED',
    'REPORT_REJECTED',
    'REPORT_REVISION_REQUESTED',
    'REPORT_RESUBMITTED',
    'REQUEST_STATUS',
    'DEADLINE_REMINDER',
    'REVISION_REMINDER',
    'CUSTOM_BROADCAST'
  ) NOT NULL,
  `recipient_name` VARCHAR(100) NULL,
  `recipient_phone` VARCHAR(30) NOT NULL,
  `payload_encrypted` LONGTEXT NOT NULL,
  `status` ENUM(
    'PENDING',
    'PROCESSING',
    'RETRY',
    'ACCEPTED',
    'DELIVERED',
    'FAILED',
    'EXPIRED'
  ) NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `max_attempts` INTEGER NOT NULL DEFAULT 5,
  `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at` DATETIME(3) NULL,
  `locked_at` DATETIME(3) NULL,
  `lock_owner` VARCHAR(100) NULL,
  `provider_message_id` VARCHAR(191) NULL,
  `last_error` TEXT NULL,
  `accepted_at` DATETIME(3) NULL,
  `delivered_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `notification_job_dedupe_key_key` (`dedupe_key`),
  INDEX `notification_job_status_next_attempt_at_idx` (`status`, `next_attempt_at`),
  INDEX `notification_job_recipient_phone_created_at_idx` (`recipient_phone`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `laporan_status_updated_at_idx`
  ON `laporan` (`status`, `updated_at`);
