import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';
import multer from 'multer';
import { nanoid } from 'nanoid';
import pkg from 'pg';
const { Pool } = pkg;

// Type definitions
interface JwtPayload {
  user_id: string;
  userId?: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface User {
  user_id: string;
  email: string;
  name: string;
  role: string;
  created_at?: string;
}

interface NotificationData {
  user_id?: string;
  type?: string;
  title?: string;
  message?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module 'socket.io' {
  interface Socket {
    user?: User;
  }
}

// Import Zod schemas
import {
  userSchema, createUserInputSchema, updateUserInputSchema, searchUserInputSchema,
  propertySchema, createPropertyInputSchema, updatePropertyInputSchema, searchPropertyInputSchema,
  propertyPhotoSchema, createPropertyPhotoInputSchema, updatePropertyPhotoInputSchema, searchPropertyPhotoInputSchema,
  propertyAvailabilitySchema, createPropertyAvailabilityInputSchema, updatePropertyAvailabilityInputSchema, searchPropertyAvailabilityInputSchema,
  bookingSchema, createBookingInputSchema, updateBookingInputSchema, searchBookingInputSchema,
  conversationSchema, createConversationInputSchema, updateConversationInputSchema, searchConversationInputSchema,
  messageSchema, createMessageInputSchema, updateMessageInputSchema, searchMessageInputSchema,
  reviewSchema, createReviewInputSchema, updateReviewInputSchema, searchReviewInputSchema,
  reviewPhotoSchema, createReviewPhotoInputSchema, updateReviewPhotoInputSchema, searchReviewPhotoInputSchema,
  adminActionSchema, createAdminActionInputSchema, updateAdminActionInputSchema, searchAdminActionInputSchema,
  notificationSchema, createNotificationInputSchema, updateNotificationInputSchema, searchNotificationInputSchema
} from './schema.ts';

dotenv.config();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const port = parseInt(process.env.PORT || '3000');

// Database setup
const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432, JWT_SECRET = 'your-secret-key' } = process.env;

const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { rejectUnauthorized: false } 
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false },
      }
);

// Error response utility
interface ErrorResponse {
  success: false;
  message: string;
  error_code?: string;
  details?: any;
  timestamp: string;
}

function createErrorResponse(
  message: string,
  error?: any,
  errorCode?: string
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errorCode) {
    response.error_code = errorCode;
  }

  if (error) {
    response.details = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return response;
}

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://123airbnb-but-just-for-libya.launchpulse.ai',
  'http://localhost:5173',
  'http://localhost:3000',
  'https://123airbnb-but-just-for-libya.launchpulse.ai'
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(morgan('combined'));

// Serve static files from the 'public' directory with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Create storage directory if it doesn't exist
const storagePath = path.join(__dirname, 'storage');
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storagePath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${nanoid()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/*
Authentication middleware for protected routes
Validates JWT token and attaches user information to request object
*/
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_MISSING'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const userId = decoded.user_id || decoded.userId;
    const result = await pool.query('SELECT user_id, email, name, role, created_at FROM users WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json(createErrorResponse('Invalid token', null, 'AUTH_TOKEN_INVALID'));
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
  }
};

/*
WebSocket authentication middleware
Validates JWT token in socket handshake and attaches user information
*/
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const userId = decoded.user_id || decoded.userId;
    const result = await pool.query('SELECT user_id, email, name, role FROM users WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return next(new Error('Invalid token'));
    }

    socket.user = result.rows[0];
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Authentication Routes

/*
User registration endpoint
Creates new user account with comprehensive validation and Libya-specific fields
Returns user object and JWT token for immediate authentication
*/
app.post('/api/auth/register', async (req, res) => {
  try {
    const validatedData = createUserInputSchema.parse(req.body);
    const { email, phone_number, password_hash, name, profile_picture_url, bio, emergency_contact_name, emergency_contact_phone, role, is_verified, verification_document_url } = validatedData;

    // Check if user exists
    const existingUser = await pool.query('SELECT user_id FROM users WHERE email = $1 OR phone_number = $2', [email, phone_number]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json(createErrorResponse('User with this email or phone number already exists', null, 'USER_ALREADY_EXISTS'));
    }

    // Generate unique user ID
    const user_id = `user_${nanoid()}`;

    // Create user (NO HASHING - store password directly for development)
    const result = await pool.query(
      `INSERT INTO users (user_id, email, phone_number, password_hash, name, profile_picture_url, bio, 
       emergency_contact_name, emergency_contact_phone, role, is_verified, verification_document_url, 
       created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING user_id, email, phone_number, name, profile_picture_url, bio, emergency_contact_name, 
       emergency_contact_phone, role, is_verified, verification_document_url, created_at, updated_at`,
      [user_id, email.toLowerCase().trim(), phone_number, password_hash, name.trim(), profile_picture_url, bio, 
       emergency_contact_name, emergency_contact_phone, role, is_verified || false, verification_document_url, 
       new Date().toISOString(), new Date().toISOString()]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Emit WebSocket event
    io.emit('user/created', user);

    res.status(201).json({
      user,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
User login endpoint
Authenticates user credentials and returns JWT token
Direct password comparison for development ease
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(createErrorResponse('Email and password are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Find user (NO HASHING - direct password comparison for development)
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
    }

    const user = result.rows[0];

    // Check password (direct comparison for development)
    if (password !== user.password_hash) {
      return res.status(400).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    const userResponse = {
      user_id: user.user_id,
      email: user.email,
      phone_number: user.phone_number,
      name: user.name,
      profile_picture_url: user.profile_picture_url,
      bio: user.bio,
      emergency_contact_name: user.emergency_contact_name,
      emergency_contact_phone: user.emergency_contact_phone,
      role: user.role,
      is_verified: user.is_verified,
      verification_document_url: user.verification_document_url,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    res.json({
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
User logout endpoint
Validates authentication token for logout confirmation
*/
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({
    message: 'Logout successful'
  });
});

/*
Token verification endpoint
Validates JWT token and returns user information
*/
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    user: req.user,
    valid: true
  });
});

// User Management Routes

/*
Get user profile endpoint
Retrieves public user profile information by user ID
*/
app.get('/api/users/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT user_id, email, phone_number, name, profile_picture_url, bio, 
       emergency_contact_name, emergency_contact_phone, role, is_verified, 
       verification_document_url, created_at, updated_at 
       FROM users WHERE user_id = $1`, 
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Update user profile endpoint
Updates user profile information with ownership validation
*/
app.patch('/api/users/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    
    // Check ownership
    if (req.user.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot update other user profiles', null, 'FORBIDDEN_ACCESS'));
    }

    const updateData = updateUserInputSchema.parse({ ...req.body, user_id });
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'user_id' && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date().toISOString());
    updateValues.push(user_id);

    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = $${paramCount + 1} 
       RETURNING user_id, email, phone_number, name, profile_picture_url, bio, 
       emergency_contact_name, emergency_contact_phone, role, is_verified, 
       verification_document_url, created_at, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    const updatedUser = result.rows[0];

    // Emit WebSocket event
    io.emit('user/updated', updatedUser);

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get user's property listings endpoint
Retrieves all properties owned by a specific user
*/
app.get('/api/users/:user_id/listings', async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM properties WHERE host_id = $1 ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get user's bookings endpoint
Retrieves all bookings associated with a user as guest or host
*/
app.get('/api/users/:user_id/bookings', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status } = req.query;
    const statusStr = status as string;

    // Check access
    if (req.user.user_id !== user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot access other user bookings', null, 'FORBIDDEN_ACCESS'));
    }

    let query = `SELECT * FROM bookings WHERE (guest_id = $1 OR host_id = $1)`;
    const queryParams = [user_id];

    if (statusStr) {
      query += ` AND status = $2`;
      queryParams.push(statusStr);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get user's reviews endpoint
Retrieves all reviews written by or received by a user
*/
app.get('/api/users/:user_id/reviews', async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM reviews WHERE reviewer_id = $1 OR host_id = $1 ORDER BY created_at DESC`,
      [user_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Property Management Routes

/*
Search properties endpoint
Advanced property search with filtering, sorting, and pagination
Supports location, date range, guest count, price range, and amenity filtering
*/
app.get('/api/properties', async (req, res) => {
  try {
    // Coerce query parameters to proper types
    const searchParams = {
      location: req.query.location as string,
      check_in: req.query.check_in as string,
      check_out: req.query.check_out as string,
      guests: req.query.guests ? parseInt(req.query.guests as string) || undefined : undefined,
      price_min: req.query.price_min ? parseFloat(req.query.price_min as string) || undefined : undefined,
      price_max: req.query.price_max ? parseFloat(req.query.price_max as string) || undefined : undefined,
      property_type: req.query.property_type as string,
      amenities: req.query.amenities as string,
      sort_by: req.query.sort_by as string,
      limit: parseInt((req.query.limit as string) || '10'),
      offset: parseInt((req.query.offset as string) || '0')
    };

    const {
      location, check_in, check_out, guests, price_min, price_max,
      property_type, amenities, sort_by, limit, offset
    } = searchParams;

    let query = `SELECT * FROM properties WHERE is_active = true`;
    const queryParams = [];
    let paramCount = 1;

    // Location filtering
    if (location) {
      query += ` AND (city ILIKE $${paramCount} OR neighborhood ILIKE $${paramCount})`;
      queryParams.push(`%${location}%`);
      paramCount++;
    }

    // Guest capacity filtering
    if (guests) {
      query += ` AND guest_capacity >= $${paramCount}`;
      queryParams.push(guests);
      paramCount++;
    }

    // Price range filtering
    if (price_min) {
      query += ` AND base_price_per_night >= $${paramCount}`;
      queryParams.push(price_min);
      paramCount++;
    }

    if (price_max) {
      query += ` AND base_price_per_night <= $${paramCount}`;
      queryParams.push(price_max);
      paramCount++;
    }

    // Property type filtering
    if (property_type) {
      query += ` AND property_type = $${paramCount}`;
      queryParams.push(property_type);
      paramCount++;
    }

    // Amenities filtering
    if (amenities) {
      query += ` AND amenities ILIKE $${paramCount}`;
      queryParams.push(`%${amenities}%`);
      paramCount++;
    }

    // Date availability filtering
    if (check_in && check_out) {
      query += ` AND property_id NOT IN (
        SELECT DISTINCT property_id FROM property_availability 
        WHERE date BETWEEN $${paramCount} AND $${paramCount + 1} 
        AND is_available = false
      )`;
      queryParams.push(check_in, check_out);
      paramCount += 2;
    }

    // Sorting
    switch (sort_by) {
      case 'price_low_to_high':
        query += ` ORDER BY base_price_per_night ASC`;
        break;
      case 'price_high_to_low':
        query += ` ORDER BY base_price_per_night DESC`;
        break;
      case 'newest':
        query += ` ORDER BY created_at DESC`;
        break;
      default:
        query += ` ORDER BY created_at DESC`;
    }

    // Pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM properties WHERE is_active = true`;
    const countResult = await pool.query(countQuery);

    res.json({
      properties: result.rows,
      total_count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Search properties error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Create property listing endpoint
Creates new property listing with host ownership validation
*/
app.post('/api/properties', authenticateToken, async (req, res) => {
  try {
    const propertyData = createPropertyInputSchema.parse({
      ...req.body,
      host_id: req.user.user_id
    });

    const property_id = `prop_${nanoid()}`;
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO properties (
        property_id, host_id, title, description, city, neighborhood, address,
        latitude, longitude, property_type, guest_capacity, bedrooms, beds, bathrooms,
        amenities, base_price_per_night, currency, has_power_backup, has_water_tank,
        house_rules, cancellation_policy, instant_book, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING *`,
      [
        property_id, propertyData.host_id, propertyData.title, propertyData.description,
        propertyData.city, propertyData.neighborhood, propertyData.address,
        propertyData.latitude, propertyData.longitude, propertyData.property_type,
        propertyData.guest_capacity, propertyData.bedrooms, propertyData.beds, propertyData.bathrooms,
        propertyData.amenities, propertyData.base_price_per_night, propertyData.currency || 'LYD',
        propertyData.has_power_backup, propertyData.has_water_tank, propertyData.house_rules,
        propertyData.cancellation_policy, propertyData.instant_book, propertyData.is_active,
        now, now
      ]
    );

    const newProperty = result.rows[0];

    // Emit WebSocket event
    io.emit('property/created', newProperty);

    res.status(201).json(newProperty);
  } catch (error) {
    console.error('Create property error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get property details endpoint
Retrieves comprehensive property information including photos and availability
*/
app.get('/api/properties/:property_id', async (req, res) => {
  try {
    const { property_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM properties WHERE property_id = $1`,
      [property_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Update property listing endpoint
Updates property details with ownership validation
*/
app.patch('/api/properties/:property_id', authenticateToken, async (req, res) => {
  try {
    const { property_id } = req.params;
    
    // Check ownership
    const ownerCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [property_id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    if (ownerCheck.rows[0].host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot update other user properties', null, 'FORBIDDEN_ACCESS'));
    }

    const updateData = updatePropertyInputSchema.parse({ ...req.body, property_id });
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'property_id' && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date().toISOString());
    updateValues.push(property_id);

    const result = await pool.query(
      `UPDATE properties SET ${updateFields.join(', ')} WHERE property_id = $${paramCount + 1} RETURNING *`,
      updateValues
    );

    const updatedProperty = result.rows[0];

    // Emit WebSocket event
    io.emit('property/updated', updatedProperty);

    res.json(updatedProperty);
  } catch (error) {
    console.error('Update property error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Delete property listing endpoint
Soft deletes property by setting is_active to false
*/
app.delete('/api/properties/:property_id', authenticateToken, async (req, res) => {
  try {
    const { property_id } = req.params;
    
    // Check ownership
    const ownerCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [property_id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    if (ownerCheck.rows[0].host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot delete other user properties', null, 'FORBIDDEN_ACCESS'));
    }

    await pool.query(
      `UPDATE properties SET is_active = false, updated_at = $1 WHERE property_id = $2`,
      [new Date().toISOString(), property_id]
    );

    // Emit WebSocket event
    io.emit('property/deleted', { property_id });

    res.status(204).send();
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Property Photos Routes

/*
Get property photos endpoint
Retrieves all photos for a property ordered by display order
*/
app.get('/api/properties/:property_id/photos', async (req, res) => {
  try {
    const { property_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM property_photos WHERE property_id = $1 ORDER BY display_order ASC`,
      [property_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get property photos error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Add property photo endpoint
Adds new photo to property with ownership validation
*/
app.post('/api/properties/:property_id/photos', authenticateToken, async (req, res) => {
  try {
    const { property_id } = req.params;
    
    // Check ownership
    const ownerCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [property_id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    if (ownerCheck.rows[0].host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot add photos to other user properties', null, 'FORBIDDEN_ACCESS'));
    }

    const photoData = createPropertyPhotoInputSchema.parse({
      ...req.body,
      property_id
    });

    const photo_id = `photo_${nanoid()}`;

    const result = await pool.query(
      `INSERT INTO property_photos (photo_id, property_id, photo_url, caption, display_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [photo_id, property_id, photoData.photo_url, photoData.caption, photoData.display_order, new Date().toISOString()]
    );

    const newPhoto = result.rows[0];

    // Emit WebSocket event
    io.emit('property_photo/created', newPhoto);

    res.status(201).json(newPhoto);
  } catch (error) {
    console.error('Add property photo error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Update property photo endpoint
Updates photo details with ownership validation
*/
app.patch('/api/properties/:property_id/photos/:photo_id', authenticateToken, async (req, res) => {
  try {
    const { property_id, photo_id } = req.params;
    
    // Check ownership through property
    const ownerCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [property_id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    if (ownerCheck.rows[0].host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot update photos of other user properties', null, 'FORBIDDEN_ACCESS'));
    }

    const updateData = updatePropertyPhotoInputSchema.parse({ ...req.body, photo_id });
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'photo_id' && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateValues.push(photo_id);

    const result = await pool.query(
      `UPDATE property_photos SET ${updateFields.join(', ')} WHERE photo_id = $${paramCount + 1} RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Photo not found', null, 'PHOTO_NOT_FOUND'));
    }

    const updatedPhoto = result.rows[0];

    // Emit WebSocket event
    io.emit('property_photo/updated', updatedPhoto);

    res.json(updatedPhoto);
  } catch (error) {
    console.error('Update property photo error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Delete property photo endpoint
Removes photo from property with ownership validation
*/
app.delete('/api/properties/:property_id/photos/:photo_id', authenticateToken, async (req, res) => {
  try {
    const { property_id, photo_id } = req.params;
    
    // Check ownership through property
    const ownerCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [property_id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    if (ownerCheck.rows[0].host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot delete photos from other user properties', null, 'FORBIDDEN_ACCESS'));
    }

    const result = await pool.query(
      `DELETE FROM property_photos WHERE photo_id = $1 RETURNING photo_id`,
      [photo_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Photo not found', null, 'PHOTO_NOT_FOUND'));
    }

    // Emit WebSocket event
    io.emit('property_photo/deleted', { photo_id });

    res.status(204).send();
  } catch (error) {
    console.error('Delete property photo error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Property Availability Routes

/*
Get property availability endpoint
Retrieves availability calendar for a property within date range
*/
app.get('/api/properties/:property_id/availability', async (req, res) => {
  try {
    const { property_id } = req.params;
    const { start_date, end_date } = req.query;
    const startDateStr = start_date as string;
    const endDateStr = end_date as string;

    let query = `SELECT * FROM property_availability WHERE property_id = $1`;
    const queryParams = [property_id];

    if (startDateStr && endDateStr) {
      query += ` AND date BETWEEN $2 AND $3`;
      queryParams.push(startDateStr, endDateStr);
    }

    query += ` ORDER BY date ASC`;

    const result = await pool.query(query, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get property availability error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Set property availability endpoint
Creates or updates availability for specific dates
*/
app.post('/api/properties/:property_id/availability', authenticateToken, async (req, res) => {
  try {
    const { property_id } = req.params;
    
    // Check ownership
    const ownerCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [property_id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    if (ownerCheck.rows[0].host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot modify availability of other user properties', null, 'FORBIDDEN_ACCESS'));
    }

    const availabilityData = createPropertyAvailabilityInputSchema.parse({
      ...req.body,
      property_id
    });

    const availability_id = `avail_${nanoid()}`;

    const result = await pool.query(
      `INSERT INTO property_availability (availability_id, property_id, date, is_available, price_override)
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (property_id, date) 
       DO UPDATE SET is_available = $4, price_override = $5
       RETURNING *`,
      [availability_id, property_id, availabilityData.date, availabilityData.is_available, availabilityData.price_override]
    );

    const newAvailability = result.rows[0];

    // Emit WebSocket event
    io.emit('property_availability/created', newAvailability);

    res.status(201).json(newAvailability);
  } catch (error) {
    console.error('Set property availability error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get property reviews endpoint
Retrieves all reviews for a specific property
*/
app.get('/api/properties/:property_id/reviews', async (req, res) => {
  try {
    const { property_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM reviews WHERE property_id = $1 ORDER BY created_at DESC`,
      [property_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get property reviews error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Booking Management Routes

/*
Search bookings endpoint
Advanced booking search with filtering and pagination
*/
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    // Coerce query parameters to proper types
    const bookingParams = {
      property_id: req.query.property_id as string,
      guest_id: req.query.guest_id as string,
      host_id: req.query.host_id as string,
      status: req.query.status as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      limit: parseInt((req.query.limit as string) || '10'),
      offset: parseInt((req.query.offset as string) || '0')
    };

    const {
      property_id, guest_id, host_id, status, start_date, end_date,
      limit, offset
    } = bookingParams;

    let query = `SELECT * FROM bookings WHERE 1=1`;
    const queryParams = [];
    let paramCount = 1;

    // Add user context filtering
    if (req.user.role !== 'admin') {
      query += ` AND (guest_id = $${paramCount} OR host_id = $${paramCount})`;
      queryParams.push(req.user.user_id);
      paramCount++;
    }

    // Apply additional filters
    if (property_id) {
      query += ` AND property_id = $${paramCount}`;
      queryParams.push(property_id);
      paramCount++;
    }

    if (guest_id) {
      query += ` AND guest_id = $${paramCount}`;
      queryParams.push(guest_id);
      paramCount++;
    }

    if (host_id) {
      query += ` AND host_id = $${paramCount}`;
      queryParams.push(host_id);
      paramCount++;
    }

    if (status) {
      query += ` AND status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }

    if (start_date && end_date) {
      query += ` AND check_in BETWEEN $${paramCount} AND $${paramCount + 1}`;
      queryParams.push(start_date, end_date);
      paramCount += 2;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit.toString(), offset.toString());

    const result = await pool.query(query, queryParams);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM bookings WHERE 1=1`;
    const countResult = await pool.query(countQuery);

    res.json({
      bookings: result.rows,
      total_count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Search bookings error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Create booking endpoint
Creates new booking request with validation
*/
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const bookingData = createBookingInputSchema.parse({
      ...req.body,
      guest_id: req.user.user_id
    });

    // Validate property exists
    const propertyCheck = await pool.query('SELECT host_id FROM properties WHERE property_id = $1', [bookingData.property_id]);
    if (propertyCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Property not found', null, 'PROPERTY_NOT_FOUND'));
    }

    const host_id = propertyCheck.rows[0].host_id;
    const booking_id = `book_${nanoid()}`;
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO bookings (
        booking_id, property_id, guest_id, host_id, check_in, check_out,
        guest_count, total_price, service_fee, special_requests, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        booking_id, bookingData.property_id, bookingData.guest_id, host_id,
        bookingData.check_in, bookingData.check_out, bookingData.guest_count,
        bookingData.total_price, bookingData.service_fee, bookingData.special_requests,
        bookingData.status || 'pending', now, now
      ]
    );

    const newBooking = result.rows[0];

    // Create conversation
    const conversation_id = `conv_${nanoid()}`;
    await pool.query(
      `INSERT INTO conversations (conversation_id, booking_id, guest_id, host_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [conversation_id, booking_id, bookingData.guest_id, host_id, now, now]
    );

    // Create notification for host
    const notification_id = `not_${nanoid()}`;
    await pool.query(
      `INSERT INTO notifications (notification_id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        notification_id, host_id, 'booking_request', 'New Booking Request',
        `You have a new booking request from ${req.user.name}`,
        'booking', booking_id, false, now
      ]
    );

    // Emit WebSocket events
    io.emit('booking/created', newBooking);
    io.to(`user_${host_id}`).emit('notification/created', {
      notification_id, user_id: host_id, type: 'booking_request',
      title: 'New Booking Request', message: `You have a new booking request from ${req.user.name}`,
      related_entity_type: 'booking', related_entity_id: booking_id,
      is_read: false, created_at: now
    });

    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Create booking error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get booking details endpoint
Retrieves specific booking information with access validation
*/
app.get('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM bookings WHERE booking_id = $1`,
      [booking_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
    }

    const booking = result.rows[0];

    // Check access
    if (req.user.role !== 'admin' && booking.guest_id !== req.user.user_id && booking.host_id !== req.user.user_id) {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot access other user bookings', null, 'FORBIDDEN_ACCESS'));
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Update booking endpoint
Updates booking status and details with proper authorization
*/
app.patch('/api/bookings/:booking_id', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    
    // Get current booking
    const bookingCheck = await pool.query('SELECT * FROM bookings WHERE booking_id = $1', [booking_id]);
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
    }

    const currentBooking = bookingCheck.rows[0];

    // Check access
    if (req.user.role !== 'admin' && currentBooking.guest_id !== req.user.user_id && currentBooking.host_id !== req.user.user_id) {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot update other user bookings', null, 'FORBIDDEN_ACCESS'));
    }

    const updateData = updateBookingInputSchema.parse({ ...req.body, booking_id });
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'booking_id' && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date().toISOString());
    updateValues.push(booking_id);

    const result = await pool.query(
      `UPDATE bookings SET ${updateFields.join(', ')} WHERE booking_id = $${paramCount + 1} RETURNING *`,
      updateValues
    );

    const updatedBooking = result.rows[0];

    // Handle status change notifications
    if (updateData.status && updateData.status !== currentBooking.status) {
      const now = new Date().toISOString();
      const notification_id = `not_${nanoid()}`;
      
      let notificationData: NotificationData = {};
      
      if (updateData.status === 'confirmed') {
        notificationData = {
          user_id: currentBooking.guest_id,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: 'Your booking has been confirmed by the host'
        };
        io.emit('booking/confirmed', updatedBooking);
      } else if (updateData.status === 'declined') {
        notificationData = {
          user_id: currentBooking.guest_id,
          type: 'booking_declined',
          title: 'Booking Declined',
          message: 'Your booking request has been declined'
        };
        io.emit('booking/declined', updatedBooking);
      } else if (updateData.status === 'cancelled') {
        const targetUserId = req.user.user_id === currentBooking.guest_id ? currentBooking.host_id : currentBooking.guest_id;
        notificationData = {
          user_id: targetUserId,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: 'A booking has been cancelled'
        };
        io.emit('booking/cancelled', updatedBooking);
      }

      if (notificationData.user_id) {
        await pool.query(
          `INSERT INTO notifications (notification_id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            notification_id, notificationData.user_id, notificationData.type, notificationData.title,
            notificationData.message, 'booking', booking_id, false, now
          ]
        );

        io.to(`user_${notificationData.user_id}`).emit('notification/created', {
          notification_id, ...notificationData, related_entity_type: 'booking',
          related_entity_id: booking_id, is_read: false, created_at: now
        });
      }
    }

    // Emit WebSocket event
    io.emit('booking/updated', updatedBooking);

    res.json(updatedBooking);
  } catch (error) {
    console.error('Update booking error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Create review for booking endpoint
Creates review after completed booking with validation
*/
app.post('/api/bookings/:booking_id/reviews', authenticateToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    
    // Get booking details
    const bookingCheck = await pool.query('SELECT * FROM bookings WHERE booking_id = $1', [booking_id]);
    if (bookingCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Booking not found', null, 'BOOKING_NOT_FOUND'));
    }

    const booking = bookingCheck.rows[0];

    // Check if user is the guest
    if (booking.guest_id !== req.user.user_id) {
      return res.status(403).json(createErrorResponse('Forbidden: Only guests can review bookings', null, 'FORBIDDEN_ACCESS'));
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json(createErrorResponse('Cannot review booking that is not completed', null, 'BOOKING_NOT_COMPLETED'));
    }

    // Check if review already exists
    const existingReview = await pool.query('SELECT review_id FROM reviews WHERE booking_id = $1', [booking_id]);
    if (existingReview.rows.length > 0) {
      return res.status(400).json(createErrorResponse('Review already exists for this booking', null, 'REVIEW_ALREADY_EXISTS'));
    }

    const reviewData = createReviewInputSchema.parse({
      ...req.body,
      booking_id,
      property_id: booking.property_id,
      reviewer_id: req.user.user_id,
      host_id: booking.host_id
    });

    const review_id = `rev_${nanoid()}`;
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO reviews (
        review_id, booking_id, property_id, reviewer_id, host_id,
        cleanliness_rating, accuracy_rating, communication_rating,
        location_rating, check_in_rating, value_rating, overall_rating,
        comment, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        review_id, booking_id, reviewData.property_id, reviewData.reviewer_id, reviewData.host_id,
        reviewData.cleanliness_rating, reviewData.accuracy_rating, reviewData.communication_rating,
        reviewData.location_rating, reviewData.check_in_rating, reviewData.value_rating,
        reviewData.overall_rating, reviewData.comment, now, now
      ]
    );

    const newReview = result.rows[0];

    // Create notification for host
    const notification_id = `not_${nanoid()}`;
    await pool.query(
      `INSERT INTO notifications (notification_id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        notification_id, booking.host_id, 'review_received', 'New Review',
        `You received a new review from ${req.user.name}`,
        'review', review_id, false, now
      ]
    );

    // Emit WebSocket events
    io.emit('review/created', newReview);
    io.to(`user_${booking.host_id}`).emit('notification/created', {
      notification_id, user_id: booking.host_id, type: 'review_received',
      title: 'New Review', message: `You received a new review from ${req.user.name}`,
      related_entity_type: 'review', related_entity_id: review_id,
      is_read: false, created_at: now
    });

    res.status(201).json(newReview);
  } catch (error) {
    console.error('Create review error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Conversation and Messaging Routes

/*
Create conversation endpoint
Creates new conversation between users
*/
app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const conversationData = createConversationInputSchema.parse({
      ...req.body,
      guest_id: req.user.user_id
    });

    // Validate booking exists and user has access
    const bookingCheck = await pool.query(
      'SELECT * FROM bookings WHERE booking_id = $1 AND (guest_id = $2 OR host_id = $2)',
      [conversationData.booking_id, req.user.user_id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Booking not found or access denied', null, 'BOOKING_NOT_FOUND'));
    }

    // Check if conversation already exists
    const existingConv = await pool.query(
      'SELECT conversation_id FROM conversations WHERE booking_id = $1',
      [conversationData.booking_id]
    );

    if (existingConv.rows.length > 0) {
      return res.json(existingConv.rows[0]);
    }

    const conversation_id = `conv_${nanoid()}`;
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO conversations (conversation_id, booking_id, guest_id, host_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [conversation_id, conversationData.booking_id, conversationData.guest_id, conversationData.host_id, now, now]
    );

    const newConversation = result.rows[0];

    // Emit WebSocket event
    io.emit('conversation/created', newConversation);

    res.status(201).json(newConversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get user conversations endpoint
Retrieves all conversations for authenticated user
*/
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    // Coerce query parameters to proper types
    const convParams = {
      limit: parseInt((req.query.limit as string) || '10'),
      offset: parseInt((req.query.offset as string) || '0')
    };

    const { limit, offset } = convParams;

    const result = await pool.query(
      `SELECT * FROM conversations 
       WHERE guest_id = $1 OR host_id = $1 
       ORDER BY updated_at DESC 
       LIMIT $2 OFFSET $3`,
       [req.user.user_id, limit, offset]    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get conversation details endpoint
Retrieves specific conversation with access validation
*/
app.get('/api/conversations/:conversation_id', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM conversations WHERE conversation_id = $1`,
      [conversation_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Conversation not found', null, 'CONVERSATION_NOT_FOUND'));
    }

    const conversation = result.rows[0];

    // Check access
    if (conversation.guest_id !== req.user.user_id && conversation.host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot access other user conversations', null, 'FORBIDDEN_ACCESS'));
    }

    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Get conversation messages endpoint
Retrieves all messages in a conversation with pagination
*/
app.get('/api/conversations/:conversation_id/messages', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    // Coerce query parameters to proper types
    const msgParams = {
      limit: parseInt((req.query.limit as string) || '20'),
      offset: parseInt((req.query.offset as string) || '0')
    };

    const { limit, offset } = msgParams;

    // Check conversation access
    const conversationResult = await pool.query(
      `SELECT * FROM conversations WHERE conversation_id = $1`,
      [conversation_id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Conversation not found', null, 'CONVERSATION_NOT_FOUND'));
    }

    const conversation = conversationResult.rows[0];

    if (conversation.guest_id !== req.user.user_id && conversation.host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot access other user conversations', null, 'FORBIDDEN_ACCESS'));
    }

    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC 
       LIMIT $2 OFFSET $3`,
       [conversation_id, limit, offset]    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Send message in conversation endpoint
Creates new message with real-time delivery
*/
app.post('/api/conversations/:conversation_id/messages', authenticateToken, async (req, res) => {
  try {
    const { conversation_id } = req.params;

    // Check conversation access
    const conversationResult = await pool.query(
      `SELECT * FROM conversations WHERE conversation_id = $1`,
      [conversation_id]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Conversation not found', null, 'CONVERSATION_NOT_FOUND'));
    }

    const conversation = conversationResult.rows[0];

    if (conversation.guest_id !== req.user.user_id && conversation.host_id !== req.user.user_id) {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot send messages in other user conversations', null, 'FORBIDDEN_ACCESS'));
    }

    const messageData = createMessageInputSchema.parse({
      ...req.body,
      conversation_id,
      sender_id: req.user.user_id
    });

    const message_id = `msg_${nanoid()}`;
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO messages (message_id, conversation_id, sender_id, content, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [message_id, conversation_id, messageData.sender_id, messageData.content, false, now]
    );

    const newMessage = result.rows[0];

    // Update conversation timestamp
    await pool.query(
      `UPDATE conversations SET updated_at = $1 WHERE conversation_id = $2`,
      [now, conversation_id]
    );

    // Emit WebSocket event to conversation participants
    io.to(`conversation_${conversation_id}`).emit('message/created', newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Update message endpoint
Updates message status (primarily for read receipts)
*/
app.patch('/api/messages/:message_id', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;
    
    // Get message and conversation details
    const messageResult = await pool.query(
      `SELECT m.*, c.guest_id, c.host_id FROM messages m 
       JOIN conversations c ON m.conversation_id = c.conversation_id 
       WHERE m.message_id = $1`,
      [message_id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Message not found', null, 'MESSAGE_NOT_FOUND'));
    }

    const messageWithConversation = messageResult.rows[0];

    // Check access
    if (messageWithConversation.guest_id !== req.user.user_id && messageWithConversation.host_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot update messages in other user conversations', null, 'FORBIDDEN_ACCESS'));
    }

    const updateData = updateMessageInputSchema.parse({ ...req.body, message_id });
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'message_id' && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateValues.push(message_id);

    const result = await pool.query(
      `UPDATE messages SET ${updateFields.join(', ')} WHERE message_id = $${paramCount + 1} RETURNING *`,
      updateValues
    );

    const updatedMessage = result.rows[0];

    // Emit WebSocket event
    io.to(`conversation_${updatedMessage.conversation_id}`).emit('message/updated', updatedMessage);

    res.json(updatedMessage);
  } catch (error) {
    console.error('Update message error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Review Management Routes

/*
Get all reviews endpoint
Retrieves reviews with filtering, sorting, and pagination
*/
app.get('/api/reviews', async (req, res) => {
  try {
    // Coerce query parameters to proper types
    const reviewParams = {
      property_id: req.query.property_id as string,
      reviewer_id: req.query.reviewer_id as string,
      host_id: req.query.host_id as string,
      sort_by: req.query.sort_by as string,
      limit: parseInt((req.query.limit as string) || '10'),
      offset: parseInt((req.query.offset as string) || '0')
    };

    const {
      property_id, reviewer_id, host_id, sort_by,
      limit, offset
    } = reviewParams;

    let query = `SELECT * FROM reviews WHERE 1=1`;
    const queryParams = [];
    let paramCount = 1;

    // Apply filters
    if (property_id) {
      query += ` AND property_id = $${paramCount}`;
      queryParams.push(property_id);
      paramCount++;
    }

    if (reviewer_id) {
      query += ` AND reviewer_id = $${paramCount}`;
      queryParams.push(reviewer_id);
      paramCount++;
    }

    if (host_id) {
      query += ` AND host_id = $${paramCount}`;
      queryParams.push(host_id);
      paramCount++;
    }

    // Sorting
    switch (sort_by) {
      case 'rating_high_to_low':
        query += ` ORDER BY overall_rating DESC`;
        break;
      case 'rating_low_to_high':
        query += ` ORDER BY overall_rating ASC`;
        break;
      case 'newest':
        query += ` ORDER BY created_at DESC`;
        break;
      case 'oldest':
        query += ` ORDER BY created_at ASC`;
        break;
      default:
        query += ` ORDER BY created_at DESC`;
    }

    // Pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM reviews WHERE 1=1`;
    const countResult = await pool.query(countQuery);

    res.json({
      reviews: result.rows,
      total_count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Notification Routes

/*
Get user notifications endpoint
Retrieves notifications for authenticated user with filtering
*/
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    // Coerce query parameters to proper types
    const notifParams = {
      is_read: req.query.is_read as string,
      limit: parseInt((req.query.limit as string) || '10'),
      offset: parseInt((req.query.offset as string) || '0')
    };

    const { is_read, limit, offset } = notifParams;

    let query = `SELECT * FROM notifications WHERE user_id = $1`;
    const queryParams = [req.user.user_id];
    let paramCount = 2;

    if (is_read !== undefined) {
      query += ` AND is_read = $${paramCount}`;
      queryParams.push((is_read === 'true').toString());
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit.toString(), offset.toString());

    const result = await pool.query(query, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
Update notification endpoint
Updates notification status (mark as read/unread)
*/
app.patch('/api/notifications/:notification_id', authenticateToken, async (req, res) => {
  try {
    const { notification_id } = req.params;
    
    // Check ownership
    const notificationCheck = await pool.query('SELECT user_id FROM notifications WHERE notification_id = $1', [notification_id]);
    if (notificationCheck.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Notification not found', null, 'NOTIFICATION_NOT_FOUND'));
    }

    if (notificationCheck.rows[0].user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json(createErrorResponse('Forbidden: Cannot update other user notifications', null, 'FORBIDDEN_ACCESS'));
    }

    const updateData = updateNotificationInputSchema.parse({ ...req.body, notification_id });
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (key !== 'notification_id' && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    updateValues.push(notification_id);

    const result = await pool.query(
      `UPDATE notifications SET ${updateFields.join(', ')} WHERE notification_id = $${paramCount + 1} RETURNING *`,
      updateValues
    );

    const updatedNotification = result.rows[0];

    // Emit WebSocket event
    io.to(`user_${updatedNotification.user_id}`).emit('notification/updated', updatedNotification);

    res.json(updatedNotification);
  } catch (error) {
    console.error('Update notification error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error.errors, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket Event Handlers

/*
WebSocket connection handler
Manages real-time communication between users
*/
io.on('connection', (socket) => {
  console.log(`User ${socket.user.user_id} connected`);

  // Join user-specific room
  socket.join(`user_${socket.user.user_id}`);

  // Join conversation rooms for user's conversations
  pool.query(
    'SELECT conversation_id FROM conversations WHERE guest_id = $1 OR host_id = $1',
    [socket.user.user_id]
  ).then(result => {
    result.rows.forEach(conversation => {
      socket.join(`conversation_${conversation.conversation_id}`);
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.user.user_id} disconnected`);
  });
});

// Catch-all route for SPA routing
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export { app, pool };

// Start the server
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port} and listening on 0.0.0.0`);
});