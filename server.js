import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import institutionRoutes from './src/routes/institutions.js';

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Ajout d'une limite pour les gros payloads
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/institutions', institutionRoutes);
// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});


// Middleware de gestion d'erreur global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});
// Endpoint pour fournir des exemples de requêtes UX
app.get('/', (req, res) => {
  const examples = [
    { message: 'API Server is running' },
    {
      description: "Lister toutes les institutions d'éducation",
      method: "GET",
      url: "/api/v1/institutions?category=education",
      queryParams: {
        category: "education"
      }
    },
    {
      description: "Lister les écoles primaires dans la région Analamanga",
      method: "GET",
      url: "/api/v1/institutions?category=education&subtype=EPP&region=analamanga",
      queryParams: {
        category: "education",
        subtype: "EPP",
        region: "analamanga"
      }
    },
    {
      description: "Chercher toutes les institutions ouvertes avec capacité ≥ 50",
      method: "GET",
      url: "/api/v1/institutions?status=ouvert&min_capacity=50",
      queryParams: {
        status: "ouvert",
        min_capacity: 50
      }
    },
    {
      description: "Rechercher par nom partiel et commune",
      method: "GET",
      url: "/api/v1/institutions?name=lycee&commune=antsiranana",
      queryParams: {
        name: "lycee",
        commune: "antsiranana"
      }
    },
    {
      description: "Pagination et tri par année d'établissement",
      method: "GET",
      url: "/api/v1/institutions?category=sante&limit=10&offset=20&sort=established",
      queryParams: {
        category: "sante",
        limit: 10,
        offset: 20,
        sort: "established"
      }
    }
  ];

  res.json({ examples });
});

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

});
