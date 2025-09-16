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
// GET institutions avec filtres avancés
// =====================
// GET institutions avec filtres avancés et recherche flexible
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
      conditions.push(`category_id = (SELECT id FROM institution_category WHERE code = $${params.length+1})`);
      params.push(category);
    }

    if (subtype) {
      conditions.push(`subtype_id = (SELECT id FROM institution_subtype WHERE code = $${params.length+1})`);
      params.push(subtype);
    }

    if (region) {
      conditions.push(`region_id = (SELECT id FROM region WHERE code = $${params.length+1})`);
      params.push(region);
    }

    if (district) {
      conditions.push(`district_id = (SELECT id FROM district WHERE code = $${params.length+1})`);
      params.push(district);
    }

    if (commune) {
      conditions.push(`commune_id = (SELECT id FROM commune WHERE code = $${params.length+1})`);
      params.push(commune);
    }

    if (street) {
      conditions.push(`street_id = (SELECT id FROM street WHERE name = $${params.length+1})`);
      params.push(street);
    }

    if (name) {
      conditions.push(`LOWER(name) LIKE $${params.length+1}`);
      params.push(`%${name.toLowerCase()}%`);
    }

    if (status) {
      conditions.push(`status = $${params.length+1}`);
      params.push(status);
    }

    if (min_capacity) {
      conditions.push(`capacity >= $${params.length+1}`);
      params.push(min_capacity);
    }

    if (max_capacity) {
      conditions.push(`capacity <= $${params.length+1}`);
      params.push(max_capacity);
    }

    let query = 'SELECT * FROM institution';
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ` ORDER BY ${sort} LIMIT $${params.length+1} OFFSET $${params.length+2}`;
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
    const instResult = await pool.query('SELECT * FROM institution WHERE id=$1', [id]);
    if (!instResult.rows.length) return res.status(404).json({ error: 'Institution not found' });

    const [contacts, staff, utilities, services, photos, opening_hours, fees, ratios] = await Promise.all([
      pool.query('SELECT * FROM contact WHERE institution_id=$1', [id]),
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
      pool.query('SELECT * FROM opening_hour WHERE institution_id=$1', [id]),
      pool.query('SELECT * FROM education_fee WHERE institution_id=$1', [id]),
      pool.query('SELECT * FROM institution_ratio WHERE institution_id=$1', [id])
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
        website, status, building_condition, created_at
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
    const query = `UPDATE institution SET ${setQuery}, updated_at=NOW() WHERE id=$${fields.length+1} RETURNING *`;
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
// Routes modulaires pour relations
// =====================
const relations = [
  { name:'contacts', table:'contact', fields:['contact_type_id','value'] },
  { name:'staff', table:'institution_staff', fields:['staff_type_id','quantity'] },
  { name:'utilities', table:'institution_utility', fields:['utility_type_id','availability'] },
  { name:'services', table:'service', fields:['service_code','name','description'] },
  { name:'photos', table:'photo', fields:['url','caption','credit'] },
  { name:'opening_hours', table:'opening_hour', fields:['day_of_week','open_time','close_time'] },
  { name:'education_fees', table:'education_fee', fields:['level','amount','currency','description'] },
  { name:'ratios', table:'institution_ratio', fields:['ratio_type','value','year'] }
];

relations.forEach(r=>{
  router.get(`/:id/${r.name}`, validateUUID, async (req,res)=>{
    const {id}=req.params;
    const q = await pool.query(`SELECT * FROM ${r.table} WHERE institution_id=$1`,[id]);
    res.json(q.rows);
  });
  router.post(`/:id/${r.name}`, validateUUID, async (req,res)=>{
    const {id}=req.params;
    const values = r.fields.map(f=>req.body[f]);
    if(values.some(v=>v===undefined)) return res.status(400).json({ error:`Missing fields for ${r.name}` });
    const q = await pool.query(
      `INSERT INTO ${r.table} (id,institution_id,${r.fields.join(',')}) VALUES ($1,$2,${r.fields.map((_,i)=>`$${i+3}`).join(',')}) RETURNING *`,
      [uuidv4(),id,...values]
    );
    res.status(201).json(q.rows[0]);
  });
});

export default router;
