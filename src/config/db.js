import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Ajout de paramètres de configuration pour la production
  max: 20, // Maximum de connections dans le pool
  idleTimeoutMillis: 30000, // Ferme les connexions inactives après 30s
  connectionTimeoutMillis: 2000, // Timeout de connexion de 2s
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Gestion des événements du pool
pool.on('connect', (client) => {
  console.log('New client connected to database');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// Test de connexion au démarrage
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

export default pool;