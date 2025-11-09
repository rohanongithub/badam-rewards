const { Pool } = require('pg');

// Handle both DATABASE_URL (from Render) and individual connection parameters
let poolConfig;

if (process.env.DATABASE_URL) {
  // Render provides DATABASE_URL as a connection string
  // For local development connecting to Render, we need SSL
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render.com') || process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
  };
} else {
  // Local development with individual parameters
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'badam_rewards',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
  };
}

const pool = new Pool(poolConfig);

// Initialize database tables
async function initDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255),
        password VARCHAR(255),
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255),
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT username_or_google CHECK (
          (username IS NOT NULL AND password IS NOT NULL) OR 
          google_id IS NOT NULL
        )
      )
    `);

    // Migrate existing table: Add new columns if they don't exist
    try {
      // Check if google_id column exists
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='google_id'
      `);
      
      if (columnCheck.rows.length === 0) {
        console.log('Migrating users table: Adding Google OAuth columns...');
        
        // Make username and password nullable (if they were NOT NULL)
        await pool.query(`
          ALTER TABLE users 
          ALTER COLUMN username DROP NOT NULL,
          ALTER COLUMN password DROP NOT NULL
        `).catch(() => {
          // Ignore if already nullable or constraint doesn't exist
        });
        
        // Add new columns (check if they exist first)
        const allColumns = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users'
        `);
        const existingColumns = allColumns.rows.map(row => row.column_name);
        
        if (!existingColumns.includes('google_id')) {
          await pool.query(`ALTER TABLE users ADD COLUMN google_id VARCHAR(255)`);
        }
        if (!existingColumns.includes('email')) {
          await pool.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
        }
        if (!existingColumns.includes('avatar_url')) {
          await pool.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)`);
        }
        
        // Add unique constraint on google_id
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL
        `).catch(() => {
          // Ignore if constraint already exists
        });
        
        // Drop old constraint if it exists and add new one
        await pool.query(`
          ALTER TABLE users DROP CONSTRAINT IF EXISTS username_or_google
        `).catch(() => {});
        
        await pool.query(`
          ALTER TABLE users ADD CONSTRAINT username_or_google CHECK (
            (username IS NOT NULL AND password IS NOT NULL) OR 
            google_id IS NOT NULL
          )
        `);
        
        console.log('Migration completed successfully');
      }
    } catch (migrationError) {
      console.error('Migration error (continuing anyway):', migrationError.message);
    }

    // Add indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL
    `).catch(() => {
      // Ignore if index creation fails
    });
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL
    `).catch(() => {
      // Ignore if index creation fails
    });

    // Create badam_counts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS badam_counts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

module.exports = { pool, initDatabase };

