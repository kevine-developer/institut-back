import express from 'express';
import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Middleware pour valider UUID
function validateUUID(req, res, next) {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return res.status(400).json({ error: 'Invalid UUID' });
  next();
}

// =====================
// ROUTES POUR LES ENTITÉS DE RÉFÉRENCE
// =====================

// Institution Categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM institution_category ORDER BY label');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { code, label } = req.body;
    if (!code || !label) return res.status(400).json({ error: 'Code and label are required' });

    const id = uuidv4();
    const query = 'INSERT INTO institution_category (id, code, label) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [id, code, label]);
    res.status(201).json({ message: 'Category created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Category code already exists' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.put('/categories/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, label } = req.body;
    if (!code && !label) return res.status(400).json({ error: 'At least code or label is required' });

    const updates = {};
    if (code) updates.code = code;
    if (label) updates.label = label;

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setQuery = fields.map((f, i) => `${f}=$${i + 1}`).join(',');
    const query = `UPDATE institution_category SET ${setQuery} WHERE id=$${fields.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category updated', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Category code already exists' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.delete('/categories/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM institution_category WHERE id=$1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted', deleted_id: id });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(409).json({ error: 'Cannot delete category with existing institutions' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Institution Subtypes
router.get('/subtypes', async (req, res) => {
  try {
    const { category_id } = req.query;
    let query = `
      SELECT s.*, c.code as category_code, c.label as category_label 
      FROM institution_subtype s 
      JOIN institution_category c ON s.category_id = c.id
    `;
    const params = [];
    
    if (category_id) {
      query += ' WHERE s.category_id = $1';
      params.push(category_id);
    }
    
    query += ' ORDER BY c.label, s.label';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/subtypes', async (req, res) => {
  try {
    const { category_id, code, label } = req.body;
    if (!category_id || !code || !label) {
      return res.status(400).json({ error: 'category_id, code and label are required' });
    }

    const id = uuidv4();
    const query = 'INSERT INTO institution_subtype (id, category_id, code, label) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [id, category_id, code, label]);
    res.status(201).json({ message: 'Subtype created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Subtype code already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid category_id' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.put('/subtypes/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, code, label } = req.body;
    
    const updates = {};
    if (category_id) updates.category_id = category_id;
    if (code) updates.code = code;
    if (label) updates.label = label;
    
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setQuery = fields.map((f, i) => `${f}=$${i + 1}`).join(',');
    const query = `UPDATE institution_subtype SET ${setQuery} WHERE id=$${fields.length + 1} RETURNING *`;
    
    const result = await pool.query(query, [...values, id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Subtype not found' });
    res.json({ message: 'Subtype updated', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Subtype code already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid category_id' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.delete('/subtypes/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM institution_subtype WHERE id=$1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Subtype not found' });
    res.json({ message: 'Subtype deleted', deleted_id: id });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(409).json({ error: 'Cannot delete subtype with existing institutions' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Contact Types
router.get('/contact-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_type ORDER BY label');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/contact-types', async (req, res) => {
  try {
    const { code, label } = req.body;
    if (!code || !label) return res.status(400).json({ error: 'Code and label are required' });

    const id = uuidv4();
    const query = 'INSERT INTO contact_type (id, code, label) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [id, code, label]);
    res.status(201).json({ message: 'Contact type created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Contact type code already exists' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Staff Types
router.get('/staff-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM staff_type ORDER BY label');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/staff-types', async (req, res) => {
  try {
    const { code, label } = req.body;
    if (!code || !label) return res.status(400).json({ error: 'Code and label are required' });

    const id = uuidv4();
    const query = 'INSERT INTO staff_type (id, code, label) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [id, code, label]);
    res.status(201).json({ message: 'Staff type created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Staff type code already exists' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Utility Types
router.get('/utility-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM utility_type ORDER BY label');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/utility-types', async (req, res) => {
  try {
    const { code, label } = req.body;
    if (!code || !label) return res.status(400).json({ error: 'Code and label are required' });

    const id = uuidv4();
    const query = 'INSERT INTO utility_type (id, code, label) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [id, code, label]);
    res.status(201).json({ message: 'Utility type created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Utility type code already exists' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// =====================
// GET institutions avec filtres avancés
// =====================
router.get('/', async (req, res) => {
  try {
    const {
      category,
      subtype,
      region,
      district,
      commune,
      street,
      name,
      status,
      min_capacity,
      max_capacity,
      limit = 100,
      offset = 0,
      sort = 'name'
    } = req.query;

    const params = [];
    const conditions = [];

    if (category) {
      conditions.push(`i.category_id = (SELECT id FROM institution_category WHERE code = $${params.length+1})`);
      params.push(category);
    }
    if (subtype) {
      conditions.push(`i.subtype_id = (SELECT id FROM institution_subtype WHERE code = $${params.length+1})`);
      params.push(subtype);
    }
    if (region) {
      conditions.push(`i.region_id = (SELECT id FROM region WHERE code = $${params.length+1})`);
      params.push(region);
    }
    if (district) {
      conditions.push(`i.district_id = (SELECT id FROM district WHERE code = $${params.length+1})`);
      params.push(district);
    }
    if (commune) {
      conditions.push(`i.commune_id = (SELECT id FROM commune WHERE code = $${params.length+1})`);
      params.push(commune);
    }
    if (street) {
      conditions.push(`i.street_id = (SELECT id FROM street WHERE name = $${params.length+1})`);
      params.push(street);
    }
    if (name) {
      conditions.push(`LOWER(i.name) LIKE $${params.length+1}`);
      params.push(`%${name.toLowerCase()}%`);
    }
    if (status) {
      conditions.push(`i.status = $${params.length+1}`);
      params.push(status);
    }
    if (min_capacity) {
      conditions.push(`i.capacity >= $${params.length+1}`);
      params.push(min_capacity);
    }
    if (max_capacity) {
      conditions.push(`i.capacity <= $${params.length+1}`);
      params.push(max_capacity);
    }

    let query = `
      SELECT
        i.*,
        ic.code as category_code, ic.label as category_label,
        ist.code as subtype_code, ist.label as subtype_label,
        r.name as region_name, d.name as district_name, 
        c.name as commune_name, s.name as street_name,
        COALESCE(json_agg(DISTINCT cont.*) FILTER (WHERE cont.id IS NOT NULL), '[]') AS contacts,
        COALESCE(json_agg(DISTINCT serv.*) FILTER (WHERE serv.id IS NOT NULL), '[]') AS services,
        COALESCE(json_agg(DISTINCT f.*) FILTER (WHERE f.id IS NOT NULL), '[]') AS education_fees
      FROM institution i
      LEFT JOIN institution_category ic ON i.category_id = ic.id
      LEFT JOIN institution_subtype ist ON i.subtype_id = ist.id
      LEFT JOIN region r ON i.region_id = r.id
      LEFT JOIN district d ON i.district_id = d.id
      LEFT JOIN commune c ON i.commune_id = c.id
      LEFT JOIN street s ON i.street_id = s.id
      LEFT JOIN contact cont ON cont.institution_id = i.id
      LEFT JOIN service serv ON serv.institution_id = i.id
      LEFT JOIN education_fee f ON f.institution_id = i.id
    `;

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');

    query += ` GROUP BY i.id, ic.code, ic.label, ist.code, ist.label, r.name, d.name, c.name, s.name 
               ORDER BY ${sort} LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: result.rows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    console.error('Error fetching institutions:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// =====================
// GET institution par ID avec toutes les relations
// =====================
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const instQuery = `
      SELECT i.*, 
        ic.code as category_code, ic.label as category_label,
        ist.code as subtype_code, ist.label as subtype_label,
        r.name as region_name, d.name as district_name, 
        c.name as commune_name, s.name as street_name
      FROM institution i
      LEFT JOIN institution_category ic ON i.category_id = ic.id
      LEFT JOIN institution_subtype ist ON i.subtype_id = ist.id
      LEFT JOIN region r ON i.region_id = r.id
      LEFT JOIN district d ON i.district_id = d.id
      LEFT JOIN commune c ON i.commune_id = c.id
      LEFT JOIN street s ON i.street_id = s.id
      WHERE i.id = $1
    `;
    
    const instResult = await pool.query(instQuery, [id]);
    if (!instResult.rows.length) return res.status(404).json({ error: 'Institution not found' });

    const [contacts, staff, utilities, services, photos, opening_hours, fees, ratios] = await Promise.all([
      pool.query(`
        SELECT c.*, ct.code AS contact_type_code, ct.label AS contact_type_label 
        FROM contact c 
        JOIN contact_type ct ON c.contact_type_id = ct.id 
        WHERE c.institution_id=$1
      `, [id]),
      pool.query(`
        SELECT s.*, st.code AS staff_code, st.label AS staff_label 
        FROM institution_staff s 
        JOIN staff_type st ON s.staff_type_id = st.id 
        WHERE s.institution_id=$1
      `, [id]),
      pool.query(`
        SELECT u.*, ut.code AS utility_code, ut.label AS utility_label 
        FROM institution_utility u 
        JOIN utility_type ut ON u.utility_type_id = ut.id 
        WHERE u.institution_id=$1
      `, [id]),
      pool.query('SELECT * FROM service WHERE institution_id=$1', [id]),
      pool.query('SELECT * FROM photo WHERE institution_id=$1', [id]),
      pool.query('SELECT * FROM opening_hour WHERE institution_id=$1 ORDER BY day_of_week', [id]),
      pool.query('SELECT * FROM education_fee WHERE institution_id=$1', [id]),
      pool.query('SELECT * FROM institution_ratio WHERE institution_id=$1 ORDER BY year DESC', [id])
    ]);

    res.json({
      institution: instResult.rows[0],
      contacts: contacts.rows,
      staff: staff.rows,
      utilities: utilities.rows,
      services: services.rows,
      photos: photos.rows,
      opening_hours: opening_hours.rows,
      education_fees: fees.rows,
      ratios: ratios.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// =====================
// POST create institution
// =====================
router.post('/', async (req, res) => {
  try {
    const {
      category_id, subtype_id, name, label, description, lat, lng,
      region_id, district_id, commune_id, street_id, established,
      capacity, last_renovation, accreditation, phone_principal,
      email_principal, website, status, building_condition
    } = req.body;

    if (!name || !category_id || !subtype_id) return res.status(400).json({ error: 'Required fields missing' });
    if (lat && (lat < -90 || lat > 90)) return res.status(400).json({ error: 'Invalid latitude' });
    if (lng && (lng < -180 || lng > 180)) return res.status(400).json({ error: 'Invalid longitude' });
    if (email_principal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_principal)) return res.status(400).json({ error: 'Invalid email' });

    const id = uuidv4();
    const query = `
      INSERT INTO institution (
        id, category_id, subtype_id, name, label, description, lat, lng,
        region_id, district_id, commune_id, street_id, established, capacity,
        last_renovation, accreditation, phone_principal, email_principal,
        website, status, building_condition, last_update
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW()
      ) RETURNING *`;
    const values = [id, category_id, subtype_id, name, label, description, lat, lng, region_id, district_id, commune_id, street_id, established, capacity, last_renovation, accreditation, phone_principal, email_principal, website, status, building_condition];
    const result = await pool.query(query, values);
    res.status(201).json({ message: 'Institution created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Institution name already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid foreign key' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// =====================
// PUT update institution
// =====================
router.put('/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'category_id','subtype_id','name','label','description','lat','lng',
      'region_id','district_id','commune_id','street_id','established',
      'capacity','last_renovation','accreditation','phone_principal',
      'email_principal','website','status','building_condition'
    ];
    const updates = Object.keys(req.body).filter(k => allowedFields.includes(k)).reduce((obj,k)=>{obj[k]=req.body[k];return obj;},{});
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setQuery = fields.map((f,i)=>`${f}=$${i+1}`).join(',');
    const query = `UPDATE institution SET ${setQuery}, last_update=NOW() WHERE id=$${fields.length+1} RETURNING *`;
    const result = await pool.query(query, [...values,id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Institution not found' });
    res.json({ message: 'Updated successfully', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// =====================
// DELETE institution
// =====================
router.delete('/:id', validateUUID, async (req,res)=>{
  try{
    const {id} = req.params;
    const exists = await pool.query('SELECT id FROM institution WHERE id=$1',[id]);
    if(!exists.rows.length) return res.status(404).json({ error:'Institution not found' });

    await pool.query('BEGIN');
    try{
      const tables = ['contact','institution_staff','institution_utility','service','photo','opening_hour','education_fee','institution_ratio'];
      for(const t of tables){ await pool.query(`DELETE FROM ${t} WHERE institution_id=$1`,[id]); }
      await pool.query('DELETE FROM institution WHERE id=$1',[id]);
      await pool.query('COMMIT');
      res.json({ message:'Institution deleted', deleted_id:id });
    }catch(e){
      await pool.query('ROLLBACK');
      throw e;
    }
  }catch(err){
    console.error(err);
    res.status(500).json({ error:'Server error', details:err.message });
  }
});

// =====================
// Routes modulaires pour relations avec CRUD complet
// =====================

// Opening Hours - Routes spécialisées
router.get('/:id/opening-hours', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT oh.*, 
        CASE oh.day_of_week 
          WHEN 1 THEN 'Lundi' WHEN 2 THEN 'Mardi' WHEN 3 THEN 'Mercredi' 
          WHEN 4 THEN 'Jeudi' WHEN 5 THEN 'Vendredi' WHEN 6 THEN 'Samedi' 
          WHEN 7 THEN 'Dimanche' 
        END as day_name
      FROM opening_hour oh 
      WHERE oh.institution_id = $1 
      ORDER BY oh.day_of_week
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/:id/opening-hours', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, open_time, close_time } = req.body;
    
    if (day_of_week === undefined || day_of_week < 1 || day_of_week > 7) {
      return res.status(400).json({ error: 'day_of_week must be between 1 and 7' });
    }

    // Vérifier si l'horaire existe déjà pour ce jour
    const existing = await pool.query(
      'SELECT id FROM opening_hour WHERE institution_id = $1 AND day_of_week = $2',
      [id, day_of_week]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Opening hour already exists for this day' });
    }

    const ohId = uuidv4();
    const query = `
      INSERT INTO opening_hour (id, institution_id, day_of_week, open_time, close_time) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await pool.query(query, [ohId, id, day_of_week, open_time, close_time]);
    res.status(201).json({ message: 'Opening hour created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid institution_id' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.put('/:id/opening-hours/:ohId', validateUUID, async (req, res) => {
  try {
    const { id, ohId } = req.params;
    const { day_of_week, open_time, close_time } = req.body;
    
    const updates = {};
    if (day_of_week !== undefined) {
      if (day_of_week < 1 || day_of_week > 7) {
        return res.status(400).json({ error: 'day_of_week must be between 1 and 7' });
      }
      updates.day_of_week = day_of_week;
    }
    if (open_time !== undefined) updates.open_time = open_time;
    if (close_time !== undefined) updates.close_time = close_time;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setQuery = fields.map((f, i) => `${f}=$${i + 1}`).join(',');
    const query = `
      UPDATE opening_hour SET ${setQuery} 
      WHERE id=$${fields.length + 1} AND institution_id=$${fields.length + 2} 
      RETURNING *
    `;
    
    const result = await pool.query(query, [...values, ohId, id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Opening hour not found' });
    res.json({ message: 'Opening hour updated', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.delete('/:id/opening-hours/:ohId', validateUUID, async (req, res) => {
  try {
    const { id, ohId } = req.params;
    const result = await pool.query(
      'DELETE FROM opening_hour WHERE id=$1 AND institution_id=$2 RETURNING *',
      [ohId, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Opening hour not found' });
    res.json({ message: 'Opening hour deleted', deleted_id: ohId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Relations génériques avec CRUD complet
const relations = [
  { 
    name: 'contacts', 
    table: 'contact', 
    fields: ['contact_type_id', 'value'],
    required: ['contact_type_id', 'value']
  },
  { 
    name: 'staff', 
    table: 'institution_staff', 
    fields: ['staff_type_id', 'quantity'],
    required: ['staff_type_id', 'quantity']
  },
  { 
    name: 'utilities', 
    table: 'institution_utility',
    fields: ['utility_type_id', 'availability'],
    required: ['utility_type_id']
  },
  { 
    name: 'services', 
    table: 'service', 
    fields: ['service_code', 'name', 'description'],
    required: ['service_code', 'name']
  },
  { 
    name: 'photos', 
    table: 'photo', 
    fields: ['url', 'caption', 'credit'],
    required: ['url']
  },
  { 
    name: 'education_fees', 
    table: 'education_fee', 
    fields: ['level', 'amount', 'currency', 'description'],
    required: ['level', 'amount']
  },
  { 
    name: 'ratios', 
    table: 'institution_ratio', 
    fields: ['ratio_type', 'value', 'year'],
    required: ['ratio_type', 'value']
  }
];

relations.forEach(r => {
  // GET - Liste des éléments
  router.get(`/:id/${r.name}`, validateUUID, async (req, res) => {
    try {
      const { id } = req.params;
      let query = `SELECT * FROM ${r.table} WHERE institution_id=$1`;
      
      // Ajouter des tris spécifiques selon la relation
      if (r.name === 'ratios') {
        query += ' ORDER BY year DESC, ratio_type';
      } else if (r.name === 'education_fees') {
        query += ' ORDER BY level, amount';
      } else if (r.name === 'staff') {
        query += ' ORDER BY quantity DESC';
      }
      
      const result = await pool.query(query, [id]);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // GET - Élément spécifique
  router.get(`/:id/${r.name}/:itemId`, validateUUID, async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const result = await pool.query(
        `SELECT * FROM ${r.table} WHERE id=$1 AND institution_id=$2`,
        [itemId, id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: `${r.name.slice(0, -1)} not found` });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // POST - Créer un nouvel élément
  router.post(`/:id/${r.name}`, validateUUID, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Vérifier les champs requis
      const missingFields = r.required.filter(field => !req.body.hasOwnProperty(field));
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: `Missing required fields for ${r.name}: ${missingFields.join(', ')}` 
        });
      }

      const values = r.fields.map(f => req.body[f]);
      const itemId = uuidv4();
      
      const placeholders = r.fields.map((_, i) => `${i + 3}`).join(',');
      const query = `
        INSERT INTO ${r.table} (id, institution_id, ${r.fields.join(',')}) 
        VALUES ($1, $2, ${placeholders}) RETURNING *
      `;
      
      const result = await pool.query(query, [itemId, id, ...values]);
      res.status(201).json({ 
        message: `${r.name.slice(0, -1)} created`, 
        data: result.rows[0] 
      });
    } catch (err) {
      console.error(err);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key reference' });
      }
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Duplicate entry' });
      }
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // PUT - Mettre à jour un élément
  router.put(`/:id/${r.name}/:itemId`, validateUUID, async (req, res) => {
    try {
      const { id, itemId } = req.params;
      
      // Filtrer les champs valides
      const updates = {};
      r.fields.forEach(field => {
        if (req.body.hasOwnProperty(field)) {
          updates[field] = req.body[field];
        }
      });

      if (!Object.keys(updates).length) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setQuery = fields.map((f, i) => `${f}=${i + 1}`).join(',');
      
      const query = `
        UPDATE ${r.table} SET ${setQuery} 
        WHERE id=${fields.length + 1} AND institution_id=${fields.length + 2} 
        RETURNING *
      `;
      
      const result = await pool.query(query, [...values, itemId, id]);
      if (!result.rows.length) {
        return res.status(404).json({ error: `${r.name.slice(0, -1)} not found` });
      }
      
      res.json({ 
        message: `${r.name.slice(0, -1)} updated`, 
        data: result.rows[0] 
      });
    } catch (err) {
      console.error(err);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key reference' });
      }
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Duplicate entry' });
      }
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // DELETE - Supprimer un élément
  router.delete(`/:id/${r.name}/:itemId`, validateUUID, async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const result = await pool.query(
        `DELETE FROM ${r.table} WHERE id=$1 AND institution_id=$2 RETURNING *`,
        [itemId, id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: `${r.name.slice(0, -1)} not found` });
      }
      res.json({ 
        message: `${r.name.slice(0, -1)} deleted`, 
        deleted_id: itemId 
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });
});

// =====================
// ROUTES GÉOGRAPHIQUES
// =====================

// Regions
router.get('/geo/regions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM region ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/geo/regions', async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });

    const id = uuidv4();
    const query = 'INSERT INTO region (id, code, name) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [id, code, name]);
    res.status(201).json({ message: 'Region created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Region code already exists' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Districts
router.get('/geo/districts', async (req, res) => {
  try {
    const { region_id } = req.query;
    let query = `
      SELECT d.*, r.name as region_name 
      FROM district d 
      JOIN region r ON d.region_id = r.id
    `;
    const params = [];
    
    if (region_id) {
      query += ' WHERE d.region_id = $1';
      params.push(region_id);
    }
    
    query += ' ORDER BY r.name, d.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/geo/districts', async (req, res) => {
  try {
    const { region_id, code, name } = req.body;
    if (!region_id || !code || !name) {
      return res.status(400).json({ error: 'region_id, code and name are required' });
    }

    const id = uuidv4();
    const query = 'INSERT INTO district (id, region_id, code, name) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [id, region_id, code, name]);
    res.status(201).json({ message: 'District created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'District code already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid region_id' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Communes
router.get('/geo/communes', async (req, res) => {
  try {
    const { district_id } = req.query;
    let query = `
      SELECT c.*, d.name as district_name, r.name as region_name 
      FROM commune c 
      JOIN district d ON c.district_id = d.id
      JOIN region r ON d.region_id = r.id
    `;
    const params = [];
    
    if (district_id) {
      query += ' WHERE c.district_id = $1';
      params.push(district_id);
    }
    
    query += ' ORDER BY r.name, d.name, c.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/geo/communes', async (req, res) => {
  try {
    const { district_id, code, name } = req.body;
    if (!district_id || !code || !name) {
      return res.status(400).json({ error: 'district_id, code and name are required' });
    }

    const id = uuidv4();
    const query = 'INSERT INTO commune (id, district_id, code, name) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [id, district_id, code, name]);
    res.status(201).json({ message: 'Commune created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Commune code already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid district_id' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Streets
router.get('/geo/streets', async (req, res) => {
  try {
    const { commune_id } = req.query;
    let query = `
      SELECT s.*, c.name as commune_name, d.name as district_name, r.name as region_name 
      FROM street s 
      JOIN commune c ON s.commune_id = c.id
      JOIN district d ON c.district_id = d.id
      JOIN region r ON d.region_id = r.id
    `;
    const params = [];
    
    if (commune_id) {
      query += ' WHERE s.commune_id = $1';
      params.push(commune_id);
    }
    
    query += ' ORDER BY r.name, d.name, c.name, s.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/geo/streets', async (req, res) => {
  try {
    const { commune_id, name, postal_code } = req.body;
    if (!commune_id || !name) {
      return res.status(400).json({ error: 'commune_id and name are required' });
    }

    const id = uuidv4();
    const query = 'INSERT INTO street (id, commune_id, name, postal_code) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [id, commune_id, name, postal_code]);
    res.status(201).json({ message: 'Street created', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') return res.status(400).json({ error: 'Invalid commune_id' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// =====================
// ROUTES STATISTIQUES
// =====================

// Statistiques générales
router.get('/stats', async (req, res) => {
  try {
    const [
      totalInstitutions,
      institutionsByCategory,
      institutionsByRegion,
      institutionsByStatus,
      avgCapacity
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM institution'),
      pool.query(`
        SELECT ic.label as category, COUNT(i.id) as count 
        FROM institution_category ic 
        LEFT JOIN institution i ON ic.id = i.category_id 
        GROUP BY ic.id, ic.label 
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT r.name as region, COUNT(i.id) as count 
        FROM region r 
        LEFT JOIN institution i ON r.id = i.region_id 
        GROUP BY r.id, r.name 
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT status, COUNT(*) as count 
        FROM institution 
        GROUP BY status 
        ORDER BY count DESC
      `),
      pool.query('SELECT AVG(capacity) as avg_capacity FROM institution WHERE capacity IS NOT NULL')
    ]);

    res.json({
      total_institutions: parseInt(totalInstitutions.rows[0].total),
      by_category: institutionsByCategory.rows,
      by_region: institutionsByRegion.rows,
      by_status: institutionsByStatus.rows,
      average_capacity: parseFloat(avgCapacity.rows[0].avg_capacity) || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Recherche géospatiale (si lat/lng disponibles)
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const query = `
      SELECT i.*, ic.label as category_label,
        (6371 * acos(cos(radians($1)) * cos(radians(i.lat)) * 
         cos(radians(i.lng) - radians($2)) + sin(radians($1)) * 
         sin(radians(i.lat)))) AS distance
      FROM institution i
      JOIN institution_category ic ON i.category_id = ic.id
      WHERE i.lat IS NOT NULL AND i.lng IS NOT NULL
      HAVING distance < $3
      ORDER BY distance
      LIMIT 50
    `;
    
    const result = await pool.query(query, [parseFloat(lat), parseFloat(lng), parseFloat(radius)]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

export default router;