import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

import institutionsRoutes from './routes/institutions.js';
import contactsRoutes from './routes/contacts.routes.js';
import servicesRoutes from './routes/services.routes.js';
import photosRoutes from './routes/photos.routes.js';

dotenv.config();
const app = express();

// Middleware globaux
app.use(express.json());
app.use(cors());
app.use(helmet());

// Routes

app.use('/api/v1/institutions', institutionsRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/photos', photosRoutes);

// Route par défaut
// Route liste des endpoints pour UX
app.get('/', (req, res) => {
  res.json({
    message: 'Liste des endpoints disponibles',
    endpoints: {
      institutions: {
        getAll: '/api/v1/institutions',
        getFull: '/api/v1/institutions/full',
        getById: '/api/v1/institutions/:id',
        create: '/api/v1/institutions [POST]',
        update: '/api/v1/institutions/:id [PUT]',
        delete: '/api/v1/institutions/:id [DELETE]',
      },
      contacts: {
        getAll: '/api/v1/contacts',
        create: '/api/v1/contacts [POST]',
        delete: '/api/v1/contacts/:id [DELETE]',
      },
      services: {
        getAll: '/api/v1/services',
        create: '/api/v1/services [POST]',
        delete: '/api/v1/services/:id [DELETE]',
      },
      photos: {
        getAll: '/api/v1/photos',
        create: '/api/v1/photos [POST]',
        delete: '/api/v1/photos/:id [DELETE]',
      },
    },
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});


export { app };
