import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import Joi from 'joi';
import db from '../../config/database.js';
import { authenticateToken } from '../../middleware/auth.js';

const app = express();
const PORT = process.env.PRODUCTS_SERVICE_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Esquemas de validación
const productSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500),
  price: Joi.number().positive().required(),
  category: Joi.string().required(),
  supplier_id: Joi.number().integer().positive().required(),
  stock: Joi.number().integer().min(0).default(0),
  hs_code: Joi.string().max(20),
  weight: Joi.number().positive()
});

const supplierSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  country: Joi.string().min(2).max(50).required(),
  contact_email: Joi.string().email(),
  phone: Joi.string().max(20),
  address: Joi.string().max(200)
});

// Conectar a la base de datos
await db.connect();

// Rutas de productos
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const { category, supplier_id, search } = req.query;
    let query = `
      SELECT p.*, s.name as supplier_name, s.country as supplier_country 
      FROM products p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id 
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    if (supplier_id) {
      query += ' AND p.supplier_id = ?';
      params.push(supplier_id);
    }

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC';

    const products = await db.query(query, params);
    res.json(products);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const products = await db.query(
      `SELECT p.*, s.name as supplier_name, s.country as supplier_country 
       FROM products p 
       LEFT JOIN suppliers s ON p.supplier_id = s.id 
       WHERE p.id = ?`, 
      [id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, price, category, supplier_id, stock, hs_code, weight } = value;

    const result = await db.run(
      `INSERT INTO products (name, description, price, category, supplier_id, stock, hs_code, weight) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, price, category, supplier_id, stock, hs_code, weight]
    );

    const newProduct = await db.query('SELECT * FROM products WHERE id = ?', [result.id]);
    
    res.status(201).json({
      message: 'Producto creado exitosamente',
      product: newProduct[0]
    });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, description, price, category, supplier_id, stock, hs_code, weight } = value;

    await db.run(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, category = ?, supplier_id = ?, 
           stock = ?, hs_code = ?, weight = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, description, price, category, supplier_id, stock, hs_code, weight, id]
    );

    const updatedProduct = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    
    if (updatedProduct.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      message: 'Producto actualizado exitosamente',
      product: updatedProduct[0]
    });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de proveedores
app.get('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await db.query('SELECT * FROM suppliers ORDER BY name');
    res.json(suppliers);
  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/suppliers', authenticateToken, async (req, res) => {
  try {
    const { error, value } = supplierSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, country, contact_email, phone, address } = value;

    const result = await db.run(
      'INSERT INTO suppliers (name, country, contact_email, phone, address) VALUES (?, ?, ?, ?, ?)',
      [name, country, contact_email, phone, address]
    );

    const newSupplier = await db.query('SELECT * FROM suppliers WHERE id = ?', [result.id]);
    
    res.status(201).json({
      message: 'Proveedor creado exitosamente',
      supplier: newSupplier[0]
    });
  } catch (error) {
    console.error('Error creando proveedor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    service: 'Products Service',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📦 Products Service corriendo en puerto ${PORT}`);
});