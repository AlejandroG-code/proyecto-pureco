-- Script para crear la base de datos Click-Go en MySQL / XAMPP (phpMyAdmin)

CREATE DATABASE IF NOT EXISTS `clickgo`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `clickgo`;

-- 1. Tabla: Estado
-- 0 = Apagado (Desenergizado), 1 = En Proceso, 2 = Terminado, 3 = En espera, 4 = Error
CREATE TABLE IF NOT EXISTS `Estado` (
  `ID_estado` TINYINT(1) NOT NULL,
  `almacen` TINYINT(1) NOT NULL DEFAULT 1,
  `banda` TINYINT(1) NOT NULL DEFAULT 1,
  `mitsubishi` TINYINT(1) NOT NULL DEFAULT 1,
  `lugar_entrega` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`ID_estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla: estado_historico
CREATE TABLE IF NOT EXISTS `estado_historico` (
  `ID_estado_historico` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
  `ID_estado` TINYINT(1) NOT NULL,
  `fecha_hora` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_estado_historico`),
  CONSTRAINT `fk_estado_historico_estado`
    FOREIGN KEY (`ID_estado`) REFERENCES `Estado` (`ID_estado`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabla: alarmas
CREATE TABLE IF NOT EXISTS `alarmas` (
  `ID_alarmas` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
  `ID_estado` TINYINT(1) NOT NULL,
  `fecha_hora` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `descripcion` TINYTEXT NOT NULL,
  PRIMARY KEY (`ID_alarmas`),
  CONSTRAINT `fk_alarmas_estado`
    FOREIGN KEY (`ID_estado`) REFERENCES `Estado` (`ID_estado`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla: categoria_piezas
-- 1 = Electrónica, 2 = Arte, 3 = Juguetes
CREATE TABLE IF NOT EXISTS `categoria_piezas` (
  `ID_categoria` TINYINT(1) NOT NULL,
  `nombre_categoria` VARCHAR(15) NOT NULL,
  `cantidad` TINYINT(1) NOT NULL DEFAULT 3,
  PRIMARY KEY (`ID_categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tabla: Almacen
-- horizontal = Fila, vertical = Columna, disponible = Disponible en stock (1 = sí, 0 = no)
CREATE TABLE IF NOT EXISTS `Almacen` (
  `ID_almacen` MEDIUMINT(6) NOT NULL AUTO_INCREMENT,
  `ID_estado_historico` MEDIUMINT(6) DEFAULT NULL,
  `ID_categoria` TINYINT(1) NOT NULL,
  `horizontal` TINYINT(2) NOT NULL,
  `vertical` TINYINT(2) NOT NULL,
  `disponible` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`ID_almacen`),
  CONSTRAINT `fk_almacen_estado_historico`
    FOREIGN KEY (`ID_estado_historico`) REFERENCES `estado_historico` (`ID_estado_historico`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_almacen_categoria`
    FOREIGN KEY (`ID_categoria`) REFERENCES `categoria_piezas` (`ID_categoria`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Tabla: pedido_historico
-- en_espera: 1 = esperando, 0 = ya pasó
CREATE TABLE IF NOT EXISTS `pedido_historico` (
  `ID_pedido` INT NOT NULL AUTO_INCREMENT,
  `ID_categoria` TINYINT(1) NOT NULL,
  `fecha_hora` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `en_espera` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`ID_pedido`),
  CONSTRAINT `fk_pedido_categoria`
    FOREIGN KEY (`ID_categoria`) REFERENCES `categoria_piezas` (`ID_categoria`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================================
-- DATOS INICIALES (SEED)
-- ==========================================================

-- Línea única de Estado inicial (por defecto todo en 1 = En Proceso)
INSERT INTO `Estado` (`ID_estado`, `almacen`, `banda`, `mitsubishi`, `lugar_entrega`)
VALUES (1, 1, 1, 1, 1)
ON DUPLICATE KEY UPDATE
  `almacen` = VALUES(`almacen`),
  `banda` = VALUES(`banda`),
  `mitsubishi` = VALUES(`mitsubishi`),
  `lugar_entrega` = VALUES(`lugar_entrega`);

-- Categorías iniciales con stock disponible (cantidad = 3)
-- Nota: Cambia cantidad a 0 para probar cuando una categoría se queda sin piezas (se pondrá en gris)
INSERT INTO `categoria_piezas` (`ID_categoria`, `nombre_categoria`, `cantidad`) VALUES
  (1, 'Electrónica', 3),
  (2, 'Arte', 3),
  (3, 'Juguetes', 3)
ON DUPLICATE KEY UPDATE
  `nombre_categoria` = VALUES(`nombre_categoria`),
  `cantidad` = VALUES(`cantidad`);

-- Registro inicial en estado_historico
INSERT INTO `estado_historico` (`ID_estado_historico`, `ID_estado`)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE `ID_estado` = VALUES(`ID_estado`);

-- Posiciones iniciales del Almacén (3 filas x 3 columnas)
INSERT INTO `Almacen` (`ID_almacen`, `ID_estado_historico`, `ID_categoria`, `horizontal`, `vertical`, `disponible`) VALUES
  (1, 1, 1, 1, 1, 1),
  (2, 1, 1, 1, 2, 1),
  (3, 1, 1, 1, 3, 1),
  (4, 1, 2, 2, 1, 1),
  (5, 1, 2, 2, 2, 1),
  (6, 1, 2, 2, 3, 1),
  (7, 1, 3, 3, 1, 1),
  (8, 1, 3, 3, 2, 1),
  (9, 1, 3, 3, 3, 1)
ON DUPLICATE KEY UPDATE
  `disponible` = VALUES(`disponible`);
