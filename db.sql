-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.4.5 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.6.0.6765
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table payment_gateway.banks
CREATE TABLE IF NOT EXISTS `banks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issuer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.banks: ~3 rows (approximately)
INSERT INTO `banks` (`id`, `name`, `issuer_name`, `api_url`, `user_name`, `user_password`, `status`, `code`, `branch`, `created_at`, `updated_at`) VALUES
	(1, 'National Bank', 'NB', 'https://api.nbank.com', 'nb_user', 'nb_pass', 1, 'NB001', 'Dhaka Branch', '2025-11-10 11:05:50', '2025-11-10 11:05:50'),
	(2, 'City Bank', 'CB', 'https://api.citybank.com', 'cb_user', 'cb_pass', 1, 'CB002', 'Chittagong Branch', '2025-11-10 11:05:50', '2025-11-10 11:05:50'),
	(3, 'Dutch-Bangla Bank', 'DBBL', 'https://api.dbbl.com', 'dbbl_user', 'dbbl_pass', 1, 'DB003', 'Sylhet Branch', '2025-11-10 11:05:50', '2025-11-10 11:05:50');

-- Dumping structure for table payment_gateway.currencies
CREATE TABLE IF NOT EXISTS `currencies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `currencies_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.currencies: ~2 rows (approximately)
INSERT INTO `currencies` (`id`, `name`, `symbol`, `code`, `created_at`, `updated_at`) VALUES
	(4, 'Taka', '৳', 'BDT', '2025-11-11 23:55:32', '2025-11-11 23:55:32'),
	(6, 'Us Doller', 'Y', 'USD', '2025-11-12 07:09:32', '2025-11-12 07:09:32');

-- Dumping structure for table payment_gateway.failed_jobs
CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.failed_jobs: ~0 rows (approximately)

-- Dumping structure for table payment_gateway.merchants
CREATE TABLE IF NOT EXISTS `merchants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `store_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `status` tinyint NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `merchants_store_id_unique` (`store_id`),
  UNIQUE KEY `merchants_email_unique` (`email`),
  KEY `merchants_user_id_foreign` (`user_id`),
  CONSTRAINT `merchants_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.merchants: ~3 rows (approximately)
INSERT INTO `merchants` (`id`, `user_id`, `store_id`, `name`, `email`, `address`, `status`, `created_at`, `updated_at`) VALUES
	(1, 4, 'STORE1001', 'Merchant One', 'merchant1@example.com', '123 Main Street, Dhaka', 1, '2025-11-10 11:05:25', '2025-11-10 11:05:25'),
	(2, 5, 'STORE1002', 'Merchant Two', 'merchant2@example.com', '456 Lake Road, Chittagong', 1, '2025-11-10 11:05:25', '2025-11-10 11:05:25'),
	(3, 6, 'STORE1003', 'Merchant Three', 'merchant3@example.com', '789 Hill View, Sylhet', 0, '2025-11-10 11:05:25', '2025-11-10 11:05:25');

-- Dumping structure for table payment_gateway.migrations
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.migrations: ~11 rows (approximately)
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
	(1, '2014_10_12_000000_create_users_table', 1),
	(2, '2014_10_12_100000_create_password_reset_tokens_table', 1),
	(3, '2019_08_19_000000_create_failed_jobs_table', 1),
	(4, '2019_12_14_000001_create_personal_access_tokens_table', 1),
	(5, '2025_11_10_103200_create_merchants_table', 1),
	(6, '2025_11_10_103201_create_currencies_table', 1),
	(7, '2025_11_10_103201_create_wallets_table', 1),
	(8, '2025_11_10_103202_create_banks_table', 1),
	(9, '2025_11_10_103202_create_pos_table', 1),
	(10, '2025_11_10_103202_create_transactions_table', 1),
	(11, '2025_11_10_103203_create_refunds_table', 1);

-- Dumping structure for table payment_gateway.password_reset_tokens
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.password_reset_tokens: ~0 rows (approximately)

-- Dumping structure for table payment_gateway.personal_access_tokens
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.personal_access_tokens: ~0 rows (approximately)

-- Dumping structure for table payment_gateway.pos
CREATE TABLE IF NOT EXISTS `pos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_id` bigint unsigned NOT NULL,
  `currency_id` bigint unsigned NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `commission_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `commission_fixed` decimal(10,2) NOT NULL DEFAULT '0.00',
  `bank_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `settlement_day` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pos_bank_id_foreign` (`bank_id`),
  KEY `pos_currency_id_foreign` (`currency_id`),
  CONSTRAINT `pos_bank_id_foreign` FOREIGN KEY (`bank_id`) REFERENCES `banks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pos_currency_id_foreign` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.pos: ~0 rows (approximately)

-- Dumping structure for table payment_gateway.refunds
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `transaction_id` bigint unsigned NOT NULL,
  `invoice_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_state` enum('Completed','Pending','Refunded','Partial Refunded','Failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `refunds_transaction_id_foreign` (`transaction_id`),
  CONSTRAINT `refunds_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.refunds: ~2 rows (approximately)

-- Dumping structure for table payment_gateway.transactions
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_state` enum('Completed','Pending','Refunded','Partial Refunded','Failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `gross` decimal(15,2) NOT NULL,
  `net` decimal(15,2) NOT NULL,
  `fee` decimal(15,2) NOT NULL DEFAULT '0.00',
  `refunded_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `pos_id` bigint unsigned NOT NULL,
  `currency_id` bigint unsigned NOT NULL,
  `merchant_id` bigint unsigned NOT NULL,
  `settlement_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transactions_pos_id_foreign` (`pos_id`),
  KEY `transactions_currency_id_foreign` (`currency_id`),
  KEY `transactions_merchant_id_foreign` (`merchant_id`),
  CONSTRAINT `transactions_currency_id_foreign` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_merchant_id_foreign` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_pos_id_foreign` FOREIGN KEY (`pos_id`) REFERENCES `pos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.transactions: ~4 rows (approximately)

-- Dumping structure for table payment_gateway.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type` tinyint NOT NULL COMMENT '1->admin, 2->merchant',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1->active, 0->passive',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.users: ~7 rows (approximately)
INSERT INTO `users` (`id`, `name`, `user_type`, `status`, `email`, `password`, `created_at`, `updated_at`) VALUES
	(1, 'Rashfi', 1, 1, 'rashfi@example.com', '$2y$12$k7uk2ypNoZHIZ5yJMLF2bebWgYi3lSwNP.eAu2TXqzNgxyYFx/NuS', '2025-11-10 11:05:14', '2025-11-12 05:04:34'),
	(2, 'Nazifa', 1, 1, 'nazifa@example.com', '$2y$10$hashedpassword2', '2025-11-10 11:05:14', '2025-11-10 11:05:14'),
	(3, 'Tazin', 1, 1, 'tazin@example.com', '$2y$10$hashedpassword3', '2025-11-10 11:05:14', '2025-11-10 11:05:14'),
	(4, 'MerchantUser1', 2, 1, 'merchantuser1@example.com', '$2y$10$hashedmerchant1', '2025-11-10 11:05:14', '2025-11-10 11:05:14'),
	(5, 'MerchantUser2', 2, 1, 'merchantuser2@example.com', '$2y$10$hashedmerchant2', '2025-11-10 11:05:14', '2025-11-10 11:05:14'),
	(6, 'MerchantUser3', 2, 1, 'merchantuser3@example.com', '$2y$10$hashedmerchant3', '2025-11-10 11:05:14', '2025-11-10 11:05:14'),
	(7, 'Riyadh Ahmed', 1, 1, 'riyadhahmed777@gmail.com', '$2y$12$bp10h6/938FABaW6NJ25Nug9KQT9z5kxVZBICXpv7IqC8WHoVSb8O', '2025-11-11 07:34:51', '2025-11-12 05:03:05');

-- Dumping structure for table payment_gateway.wallets
CREATE TABLE IF NOT EXISTS `wallets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `currency_id` bigint unsigned NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wallets_user_id_foreign` (`user_id`),
  KEY `wallets_currency_id_foreign` (`currency_id`),
  CONSTRAINT `wallets_currency_id_foreign` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wallets_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table payment_gateway.wallets: ~3 rows (approximately)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
