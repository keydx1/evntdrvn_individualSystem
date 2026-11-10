-- MySQL dump 10.13  Distrib 8.0.30, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: aquapiol_inventory
-- ------------------------------------------------------
-- Server version	8.0.30

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `api_idempotency`
--

DROP TABLE IF EXISTS `api_idempotency`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_idempotency` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idempotency_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `response_status` int NOT NULL,
  `response_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idem_service_key` (`service`,`idempotency_key`),
  KEY `idx_idem_expires` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_idempotency`
--

LOCK TABLES `api_idempotency` WRITE;
/*!40000 ALTER TABLE `api_idempotency` DISABLE KEYS */;
INSERT INTO `api_idempotency` VALUES (1,'pos','smoke-1794239958116','POST /api/v1/stock/movements/bulk','14f679379f6784fc9f343fd91355a099bb97f67a5970a49f52f3428c7419f7e3',201,'{\"data\":{\"reference\":\"SMOKE-1794239958116\",\"idempotent_replay\":false,\"lines\":[{\"sku\":\"BRUSH-BTL\",\"movement_id\":31,\"previous_stock\":15,\"new_stock\":14,\"status\":\"applied\"}]},\"meta\":{\"request_id\":\"req_247f4c6f-d532-432f-8cb9-3b78db1cd0ad\"}}','2026-11-16 23:59:18','2026-11-09 23:59:18','2026-11-09 23:59:18');
/*!40000 ALTER TABLE `api_idempotency` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `categories_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'CAT-545798','',1,'2026-11-05 23:52:03','2026-11-05 23:52:03'),(2,'CAT-914886','',1,'2026-11-05 23:52:59','2026-11-05 23:52:59'),(3,'Gallons','5-gallon and 1-gallon returnable containers',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(4,'Bottled Water','Ready-to-drink bottled water packs',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(5,'Caps','Bottle caps and closures',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(6,'Seals','Heat seals, shrink wrap and tamper seals',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(7,'Labels','Brand labels and sticker seals',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(8,'Water Treatment','Filters, membranes and mineral cartridges',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(9,'Cleaning & Sanitation','Food-grade cleaning supplies',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(10,'Testing & Office','Water testing kits and office consumables',1,'2026-11-09 23:09:58','2026-11-09 23:09:58');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sku` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoryId` int NOT NULL,
  `supplierId` int DEFAULT NULL,
  `unit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'piece',
  `quantity` int NOT NULL DEFAULT '0',
  `reorderLevel` int NOT NULL DEFAULT '10',
  `costPrice` decimal(12,2) NOT NULL DEFAULT '0.00',
  `sellingPrice` decimal(12,2) NOT NULL DEFAULT '0.00',
  `location` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  UNIQUE KEY `products_sku` (`sku`),
  KEY `products_category_id` (`categoryId`),
  KEY `products_supplier_id` (`supplierId`),
  KEY `products_is_active` (`isActive`),
  KEY `idx_products_active_sku` (`isActive`,`sku`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`categoryId`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'BTL-5G-SLIM','5-Gallon Slim Bottle',3,1,'piece',145,40,175.00,260.00,'Bottle rack A','Food-grade PC bottle for returnable 5-gallon deliveries.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(2,'BTL-5G-ROUND','5-Gallon Round Bottle',3,1,'piece',72,24,195.00,280.00,'Bottle rack B','Round profile bottle used for walk-in refills.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(3,'BTL-1G','1-Gallon Bottle',3,1,'piece',48,20,85.00,140.00,'Bottle rack B','Small bottle for office and household refills.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(4,'CAP-BLUE','Bottle Cap — Blue',5,1,'piece',1080,300,1.45,3.00,'Shelf C1','Non-spill cap with AquaPiol blue finish.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(5,'SEAL-HEAT-5G','Heat Seal — 5 Gallon',6,1,'roll',20,8,320.00,450.00,'Shelf C2','Tamper-evident heat seal roll for 5-gallon bottles.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(6,'WRAP-SHRINK','Shrink Wrap Roll',6,1,'roll',12,5,240.00,380.00,'Shelf C3','Shrink wrap for bundled bottle deliveries.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(7,'BW-500-24','Bottled Water 500ml (24-pack)',4,1,'pack',48,15,210.00,300.00,'Front chiller','Case of 24 ready-to-drink 500ml bottles for walk-in sales.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(8,'LBL-GALLON','AquaPiol Gallon Label',7,1,'piece',820,250,0.85,2.00,'Shelf D1','Waterproof gallon label with delivery hotline.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(9,'SEAL-STICKER','AquaPiol Sticker Seal',7,1,'piece',600,200,0.65,1.50,'Shelf D2','Tamper seal sticker applied after filling.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(10,'FLT-SED-10','Sediment Filter 10\"',8,2,'piece',4,6,95.00,180.00,'Treatment cabinet','5-micron sediment cartridge for the first filtration stage.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(11,'FLT-CARB-10','Carbon Block Filter 10\"',8,2,'piece',5,5,135.00,240.00,'Treatment cabinet','Carbon block cartridge for chlorine and odor removal.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(12,'MEM-RO-100','RO Membrane 100 GPD',8,2,'piece',1,2,1450.00,2200.00,'Locked cabinet','100-gallon-per-day reverse osmosis membrane.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(13,'MIN-CART','Mineral Cartridge',8,2,'piece',7,4,260.00,420.00,'Treatment cabinet','Remineralization cartridge for finished drinking water.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(14,'SAN-FOOD-1L','Food-Grade Sanitizer 1L',9,3,'bottle',11,5,210.00,320.00,'Chemical shelf','No-rinse food contact sanitizer for bottles and equipment.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(15,'BRUSH-BTL','Bottle Brush',9,3,'piece',14,6,75.00,130.00,'Cleaning station','Long-handled brush for 5-gallon bottle washing.',1,'2026-11-09 23:09:58','2026-11-09 23:59:18'),(16,'TEST-CL','Chlorine Test Kit',10,3,'kit',0,2,380.00,560.00,'Quality desk','Colorimetric test kit for residual chlorine checks.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(17,'TEST-TDS','TDS Meter',10,2,'piece',3,2,420.00,650.00,'Quality desk','Handheld total dissolved solids meter.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58'),(18,'OFF-RCPT','Receipt Paper Roll',10,4,'roll',32,12,28.00,45.00,'Front desk','Thermal receipt paper roll for delivery receipts.',1,'2026-11-09 23:09:58','2026-11-09 23:09:58');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` datetime NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES ('001_baseline.sql','2026-11-09 23:57:32'),('002_api_layer.sql','2026-11-09 23:58:26'),('003_integration_indexes.sql','2026-11-10 13:37:20');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `productId` int NOT NULL,
  `userId` int NOT NULL,
  `supplierId` int DEFAULT NULL,
  `type` enum('in','out','adjustment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `previousStock` int NOT NULL,
  `newStock` int NOT NULL,
  `unitCost` decimal(12,2) DEFAULT NULL,
  `reference` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime NOT NULL,
  `source_system` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurred_at` datetime DEFAULT NULL,
  `customer_ref` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_movement_product_reference_type` (`productId`,`reference`,`type`),
  KEY `supplierId` (`supplierId`),
  KEY `stock_movements_product_id` (`productId`),
  KEY `stock_movements_user_id` (`userId`),
  KEY `stock_movements_type` (`type`),
  KEY `stock_movements_created_at` (`createdAt`),
  KEY `idx_sm_customer_ref` (`customer_ref`),
  KEY `idx_sm_occurred_at` (`occurred_at`),
  KEY `idx_sm_source_created` (`source_system`,`createdAt`),
  KEY `idx_sm_product_created` (`productId`,`createdAt`),
  KEY `idx_sm_reference` (`reference`),
  CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_movements_ibfk_3` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

LOCK TABLES `stock_movements` WRITE;
/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
INSERT INTO `stock_movements` VALUES (1,1,1,1,'in',180,0,180,175.00,'OPENING-BTL-5G-SLIM','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(2,1,2,NULL,'out',-35,180,145,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(3,2,1,1,'in',72,0,72,195.00,'OPENING-BTL-5G-ROUND','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(4,3,1,1,'in',48,0,48,85.00,'OPENING-BTL-1G','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(5,4,1,1,'in',1200,0,1200,1.45,'OPENING-CAP-BLUE','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(6,4,2,NULL,'out',-120,1200,1080,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(7,5,1,1,'in',24,0,24,320.00,'OPENING-SEAL-HEAT-5G','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(8,5,2,NULL,'out',-4,24,20,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(9,6,1,1,'in',12,0,12,240.00,'OPENING-WRAP-SHRINK','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(10,7,1,1,'in',60,0,60,210.00,'OPENING-BW-500-24','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(11,7,2,NULL,'out',-12,60,48,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(12,8,1,1,'in',900,0,900,0.85,'OPENING-LBL-GALLON','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(13,8,2,NULL,'out',-80,900,820,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(14,9,1,1,'in',650,0,650,0.65,'OPENING-SEAL-STICKER','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(15,9,2,NULL,'out',-50,650,600,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(16,10,1,2,'in',6,0,6,95.00,'OPENING-FLT-SED-10','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(17,10,2,NULL,'out',-2,6,4,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(18,11,1,2,'in',8,0,8,135.00,'OPENING-FLT-CARB-10','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(19,11,2,NULL,'out',-3,8,5,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(20,12,1,2,'in',1,0,1,1450.00,'OPENING-MEM-RO-100','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(21,13,1,2,'in',9,0,9,260.00,'OPENING-MIN-CART','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(22,13,2,NULL,'out',-2,9,7,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(23,14,1,3,'in',14,0,14,210.00,'OPENING-SAN-FOOD-1L','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(24,14,2,NULL,'out',-3,14,11,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(25,15,1,3,'in',18,0,18,75.00,'OPENING-BRUSH-BTL','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(26,15,2,NULL,'out',-3,18,15,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(27,17,1,2,'in',4,0,4,420.00,'OPENING-TEST-TDS','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(28,17,2,NULL,'out',-1,4,3,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(29,18,1,4,'in',40,0,40,28.00,'OPENING-OFF-RCPT','Opening balance loaded with the AquaPiol demo data set.','2026-10-10 08:15:00',NULL,NULL,NULL),(30,18,2,NULL,'out',-8,40,32,NULL,'DAILY-USE','Demo consumption recorded during station operations.','2026-11-05 14:15:00',NULL,NULL,NULL),(31,15,5,NULL,'out',-1,15,14,75.00,'SMOKE-1794239958116',NULL,'2026-11-09 23:59:18','pos','2026-11-09 23:59:18','CUST-SMOKE');
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contactPerson` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `suppliers_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,'San Jose Packaging Supply','Matt Kirby B. Malaiba','0917 555 0142','mattkirbymalaiba@gmail.com','San Jose, Occidental Mindoro','Bottles, caps, seals and labels. Delivers every Tuesday.',1,'2026-10-30 20:52:17','2026-10-30 21:47:49'),(2,'AquaTech Water Solutions','Princess Diane Dasco','0918 555 0288','princessdiane@gmail.com','Calapan City, Oriental Mindoro','Filter cartridges, RO membranes and treatment parts.',1,'2026-10-30 20:52:17','2026-10-30 21:45:18'),(3,'Mindoro Hygiene Depot','Dwyane Maxcelle G. Cupit','0920 555 0119','dwyanecupit@gmail.com','Mamburao, Occidental Mindoro','Sanitizers, brushes and water testing supplies.',1,'2026-10-30 20:52:17','2026-10-30 22:10:43'),(4,'Island Office Essentials','Ced G. Magsino','0922 555 0371','cedmagsino@gmail.com','San Jose, Occidental Mindoro','Receipt paper and general office supplies.',1,'2026-10-30 20:52:17','2026-10-30 21:46:20');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','staff') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'staff',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `external_employee_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `users_email` (`email`),
  UNIQUE KEY `uq_users_external_employee` (`external_employee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Piol Admin','admin@aquapiol.local','$2a$12$qB5t1sFB8aEAvM76lAcRoe/XP1g27clu3kyBo.6thq24xVm09UPpq','admin',1,'2026-10-30 20:52:17','2026-11-05 22:18:03',NULL),(2,'Station Staff','staff@aquapiol.local','$2a$12$9CU.bKedp/F73jR4DSQxY.mngEpJKr7QCg2CTHLTXYodGRwHmgaM6','staff',1,'2026-10-30 20:52:17','2026-11-10 13:38:43',NULL),(3,'Carl Ivan U. Alcantara','carlalcantara22sh@gmail.com','$2a$12$Ifx0ol74EQRKiQWQqk0wyu9B5sMuCcV09lSO7s.Syc5K2n19IiJK2','admin',1,'2026-10-30 21:14:15','2026-10-30 21:14:15',NULL),(4,'Jerome Villasor','jeromevillasor@gmail.com','$2a$12$5DILJ2.UUojKMtGGBKBMZuzuGVkftRgd9ykGTWFAUxqZ4fy6vQSvS','staff',1,'2026-10-30 21:21:04','2026-10-30 21:21:04',NULL),(5,'pos integration','pos-system@integration.local','$2a$08$YF9xvCXVMy4LLwMHaCn.TuAjJxfkZi.rLhSSM7dfouftDiTW8a71m','staff',1,'2026-11-09 23:59:17','2026-11-09 23:59:17',NULL),(6,'accounting integration','accounting-system@integration.local','$2a$08$aSXVPnhVjfv/w8FOVMsHr.2EARyz5lm9TFwfriSH4T..uvs3PZD0m','staff',1,'2026-11-09 23:59:18','2026-11-09 23:59:18',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'aquapiol_inventory'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-10 23:24:26
