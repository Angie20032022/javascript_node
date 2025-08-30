import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import Joi from 'joi';
import db from '../../config/database.js';
import { authenticateToken, authorize } from '../../middleware/auth.js';

const app = express();
const PORT = process.env.IMPORTS_SERVICE_PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Esquemas de validación
const importSchema = Joi.object({
  supplier_id: Joi.number().integer().positive().required(),
  import_date: Joi.date().required(),
  estimated_arrival: Joi.date(),
  notes: Joi.string().max(500),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required(),
      quantity: Joi.number().integer().positive().required(),
      unit_price: Joi.number().positive().required()
    })
  ).min(1).required()
});

// Conectar a la base de datos
await db.connect();

// Generar código único de importación
const generateImportCode = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `IMP-${timestamp}-${random}`.toUpperCase();
};

// Rutas de importaciones
app.get('/api/imports', authenticateToken, async (req, res) => {
  try {
    const { status, supplier_id } = req.query;
    let query = `
      SELECT i.*, s.name as supplier_name, s.country as supplier_country,
             u.username as created_by
      FROM imports i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      query += ' AND i.user_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (supplier_id) {
      query += ' AND i.supplier_id = ?';
      params.push(supplier_id);
    }

    query += ' ORDER BY i.created_at DESC';

    const imports = await db.query(query, params);
    res.json(imports);
  } catch (error) {
    console.error('Error obteniendo importaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/imports/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = `
      SELECT i.*, s.name as supplier_name, s.country as supplier_country,
             u.username as created_by
      FROM imports i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN users u ON i.user_id = u.id
      WHERE i.id = ?
    `;
    const params = [id];

    if (req.user.role !== 'admin') {
      query += ' AND i.user_id = ?';
      params.push(req.user.id);
    }

    const imports = await db.query(query, params);
    
    if (imports.length === 0) {
      return res.status(404).json({ error: 'Importación no encontrada' });
    }

    // Obtener items de la importación
    const items = await db.query(`
      SELECT ii.*, p.name as product_name, p.description as product_description
      FROM import_items ii
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE ii.import_id = ?
    `, [id]);

    res.json({
      ...imports[0],
      items
    });
  } catch (error) {
    console.error('Error obteniendo importación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/imports', authenticateToken, async (req, res) => {
  try {
    const { error, value } = importSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { supplier_id, import_date, estimated_arrival, notes, items } = value;

    // Calcular total
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price;
    }

    const importCode = generateImportCode();

    // Crear importación
    const importResult = await db.run(
      `INSERT INTO imports (import_code, user_id, supplier_id, total_amount, import_date, estimated_arrival, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [importCode, req.user.id, supplier_id, totalAmount, import_date, estimated_arrival, notes]
    );

    // Crear items de importación
    for (const item of items) {
      const totalPrice = item.quantity * item.unit_price;
      await db.run(
        'INSERT INTO import_items (import_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [importResult.id, item.product_id, item.quantity, item.unit_price, totalPrice]
      );
    }

    const newImport = await db.query(`
      SELECT i.*, s.name as supplier_name 
      FROM imports i 
      LEFT JOIN suppliers s ON i.supplier_id = s.id 
      WHERE i.id = ?
    `, [importResult.id]);

    res.status(201).json({
      message: 'Importación creada exitosamente',
      import: newImport[0]
    });
  } catch (error) {
    console.error('Error creando importación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/imports/:id/status', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, tracking_number } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'in_transit', 'customs', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    await db.run(
      'UPDATE imports SET status = ?, tracking_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, tracking_number || null, id]
    );

    const updatedImport = await db.query('SELECT * FROM imports WHERE id = ?', [id]);
    
    if (updatedImport.length === 0) {
      return res.status(404).json({ error: 'Importación no encontrada' });
    }

    res.json({
      message: 'Estado actualizado exitosamente',
      import: updatedImport[0]
    });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/imports/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const stats = {};

    // Total importaciones por estado
    const statusStats = await db.query(`
      SELECT status, COUNT(*) as count, SUM(total_amount) as total_value
      FROM imports 
      GROUP BY status
    `);

    // Importaciones por mes
    const monthlyStats = await db.query(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as imports_count,
        SUM(total_amount) as total_value
      FROM imports 
      WHERE created_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `);

    // Top proveedores
    const topSuppliers = await db.query(`
      SELECT 
        s.name,
        COUNT(i.id) as imports_count,
        SUM(i.total_amount) as total_value
      FROM suppliers s
      LEFT JOIN imports i ON s.id = i.supplier_id
      GROUP BY s.id, s.name
      ORDER BY total_value DESC
      LIMIT 5
    `);

    stats.statusBreakdown = statusStats;
    stats.monthlyTrends = monthlyStats;
    stats.topSuppliers = topSuppliers;

    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    service: 'Imports Service',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`📊 Imports Service corriendo en puerto ${PORT}`);
});