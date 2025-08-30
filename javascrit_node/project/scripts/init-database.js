import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

// Crear directorio database si no existe
const dbDir = './database';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database('./database/imports.db');

// Crear tablas
const createTables = `
-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  supplier_id INTEGER,
  stock INTEGER DEFAULT 0,
  hs_code TEXT,
  weight DECIMAL(8,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Tabla de importaciones
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  total_amount DECIMAL(12,2) DEFAULT 0,
  import_date DATE,
  estimated_arrival DATE,
  tracking_number TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Tabla de items de importación
CREATE TABLE IF NOT EXISTS import_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
`;

// Datos de prueba
const insertSampleData = `
-- Usuarios de prueba
INSERT OR IGNORE INTO users (username, email, password, role) VALUES 
('admin', 'admin@imports.com', '$2a$10$rQ4Q4Q4Q4Q4Q4Q4Q4Q4Q4.', 'admin'),
('importer1', 'importer1@company.com', '$2a$10$rQ4Q4Q4Q4Q4Q4Q4Q4Q4Q4.', 'user');

-- Proveedores de prueba
INSERT OR IGNORE INTO suppliers (name, country, contact_email, phone, address) VALUES 
('Tech Supplies China', 'China', 'contact@techsupplies.cn', '+86-138-0013-8000', 'Shenzhen, Guangdong'),
('European Electronics', 'Alemania', 'sales@euroelectronics.de', '+49-30-12345678', 'Berlin, Germany'),
('Global Components', 'Taiwan', 'info@globalcomp.tw', '+886-2-1234-5678', 'Taipei, Taiwan');

-- Productos de prueba
INSERT OR IGNORE INTO products (name, description, price, category, supplier_id, stock, hs_code, weight) VALUES 
('Smartphone XYZ', 'Smartphone de alta gama', 299.99, 'Electronics', 1, 50, '8517.12.00', 0.18),
('Laptop ABC', 'Laptop profesional', 899.99, 'Electronics', 2, 25, '8471.30.01', 2.1),
('Tablet DEF', 'Tablet para uso general', 199.99, 'Electronics', 1, 30, '8471.30.02', 0.5),
('Auriculares GHI', 'Auriculares inalámbricos', 89.99, 'Accessories', 3, 100, '8518.30.00', 0.25);
`;

db.serialize(() => {
  // Ejecutar creación de tablas
  const queries = createTables.split(';').filter(query => query.trim());
  queries.forEach(query => {
    if (query.trim()) {
      db.run(query, (err) => {
        if (err) {
          console.error('Error creando tabla:', err.message);
        }
      });
    }
  });

  // Insertar datos de prueba
  const dataQueries = insertSampleData.split(';').filter(query => query.trim());
  dataQueries.forEach(query => {
    if (query.trim()) {
      db.run(query, (err) => {
        if (err) {
          console.error('Error insertando datos:', err.message);
        }
      });
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error cerrando la base de datos:', err.message);
  } else {
    console.log('✅ Base de datos inicializada correctamente');
    console.log('📁 Base de datos creada en: ./database/imports.db');
  }
});