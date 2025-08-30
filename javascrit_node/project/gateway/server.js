import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// URLs de los microservicios
const SERVICES = {
  users: `http://localhost:${process.env.USERS_SERVICE_PORT || 3003}`,
  products: `http://localhost:${process.env.PRODUCTS_SERVICE_PORT || 3001}`,
  imports: `http://localhost:${process.env.IMPORTS_SERVICE_PORT || 3002}`
};

// Middleware para proxy de requests
const proxyRequest = (serviceUrl) => {
  return async (req, res) => {
    try {
      const targetUrl = `${serviceUrl}${req.path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
      
      const config = {
        method: req.method,
        url: targetUrl,
        headers: {
          ...req.headers,
          host: undefined // Remover header host para evitar conflictos
        }
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
        config.data = req.body;
      }

      const response = await axios(config);
      res.status(response.status).json(response.data);
    } catch (error) {
      console.error(`Error en proxy hacia ${serviceUrl}:`, error.message);
      
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else if (error.code === 'ECONNREFUSED') {
        res.status(503).json({ 
          error: 'Servicio no disponible',
          message: 'El microservicio no está respondiendo'
        });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  };
};

// Rutas del gateway
app.get('/', (req, res) => {
  res.json({
    message: 'Gateway de Microservicios - Sistema de Importaciones',
    version: '1.0.0',
    services: {
      users: `${SERVICES.users}/health`,
      products: `${SERVICES.products}/health`,
      imports: `${SERVICES.imports}/health`
    },
    endpoints: {
      auth: {
        login: 'POST /api/users/login',
        register: 'POST /api/users/register'
      },
      products: {
        list: 'GET /api/products',
        create: 'POST /api/products',
        update: 'PUT /api/products/:id'
      },
      suppliers: {
        list: 'GET /api/suppliers',
        create: 'POST /api/suppliers'
      },
      imports: {
        list: 'GET /api/imports',
        create: 'POST /api/imports',
        details: 'GET /api/imports/:id',
        updateStatus: 'PUT /api/imports/:id/status',
        stats: 'GET /api/imports/stats/dashboard'
      }
    }
  });
});

// Health check del gateway
app.get('/health', async (req, res) => {
  const healthStatus = {
    gateway: 'UP',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Verificar salud de cada microservicio
  for (const [serviceName, serviceUrl] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
      healthStatus.services[serviceName] = 'UP';
    } catch (error) {
      healthStatus.services[serviceName] = 'DOWN';
    }
  }

  const allServicesUp = Object.values(healthStatus.services).every(status => status === 'UP');
  const httpStatus = allServicesUp ? 200 : 503;

  res.status(httpStatus).json(healthStatus);
});

// Proxy routes a los microservicios
app.use('/api/users/*', proxyRequest(SERVICES.users));
app.use('/api/products*', proxyRequest(SERVICES.products));
app.use('/api/suppliers*', proxyRequest(SERVICES.products));
app.use('/api/imports*', proxyRequest(SERVICES.imports));

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint no encontrado',
    message: 'Verifica la documentación de la API'
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 Gateway corriendo en puerto ${PORT}`);
  console.log(`📚 Documentación disponible en: http://localhost:${PORT}`);
});