const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
    user: process.env.POSTGRES_USER || 'GuideCO',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'GuideCO',
    password: process.env.POSTGRES_PASSWORD || 'guideco',
    port: process.env.POSTGRES_PORT || 5432,
};

// Admin configuration for creating database if it doesn't exist
const adminConfig = {
    user: process.env.POSTGRES_USER || 'GuideCO',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: 'postgres', // Connect to default postgres database
    password: process.env.POSTGRES_PASSWORD || 'guideco',
    port: process.env.POSTGRES_PORT || 5432,
};

/**
 * Creates the database if it doesn't exist
 */
async function createDatabaseIfNotExists() {
    const adminClient = new Client(adminConfig);
    
    try {
        await adminClient.connect();
        console.log('Connected to PostgreSQL as admin');
        
        // Check if database exists
        const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
        const result = await adminClient.query(checkDbQuery, [dbConfig.database]);
        
        if (result.rows.length === 0) {
            // Database doesn't exist, create it
            console.log(`Database '${dbConfig.database}' does not exist. Creating...`);
            const createDbQuery = `CREATE DATABASE "${dbConfig.database}"`;
            await adminClient.query(createDbQuery);
            console.log(`Database '${dbConfig.database}' created successfully`);
        } else {
            console.log(`Database '${dbConfig.database}' already exists`);
        }
        
    } catch (error) {
        console.error('Error creating database:', error);
        throw error;
    } finally {
        await adminClient.end();
    }
}

/**
 * Reads and parses the SQL schema file
 */
function readSchemaFile() {
    const schemaPath = path.join(__dirname, '../postgresSchema.sql');
    
    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    console.log('Schema file loaded successfully');
    
    // More robust parsing approach
    let cleanedContent = schemaContent;
    
    // Remove single-line comments (-- comments)
    cleanedContent = cleanedContent.replace(/--.*$/gm, '');
    
    // Remove multi-line comments (/* comments */)
    cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove extra whitespace and newlines
    cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
    
    console.log('Cleaned content preview:', cleanedContent.substring(0, 200) + '...');
    
    // Split by semicolon and filter
    const statements = cleanedContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 10) // Filter out very short statements
        .filter(stmt => stmt.toUpperCase().includes('CREATE')); // Only keep CREATE statements
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Debug: Log first few characters of each statement
    statements.forEach((stmt, index) => {
        const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`Statement ${index + 1}: ${preview}...`);
    });
    
    return statements;
}

/**
 * Executes SQL statements to create tables
 */
async function executeSchemaStatements(client, statements) {
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        try {
            console.log(`Executing statement ${i + 1}/${statements.length}...`);
            
            // Add semicolon back for execution
            await client.query(statement + ';');
            
            // Extract table name from CREATE TABLE statements for logging
            const createTableMatch = statement.match(/CREATE TABLE\s+"?(\w+)"?/i);
            if (createTableMatch) {
                console.log(`✓ Table '${createTableMatch[1]}' created successfully`);
            } else if (statement.includes('CREATE EXTENSION')) {
                console.log('✓ Extension created successfully');
            }
            
        } catch (error) {
            // Check if error is about table already existing
            if (error.code === '42P07') {
                const tableMatch = statement.match(/CREATE TABLE\s+"?(\w+)"?/i);
                if (tableMatch) {
                    console.log(`⚠ Table '${tableMatch[1]}' already exists, skipping...`);
                }
            } else if (error.code === '42710') {
                console.log('⚠ Extension already exists, skipping...');
            } else {
                console.error(`Error executing statement ${i + 1}:`, error.message);
                console.error('Statement:', statement);
                throw error;
            }
        }
    }
}

/**
 * Drops all tables (use with caution)
 */
async function dropAllTables(client) {
    console.log('Dropping all existing tables...');
    
    const dropStatements = [
        'DROP TABLE IF EXISTS "COACH_USER_LAST_INTERACTION" CASCADE',
        'DROP TABLE IF EXISTS "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" CASCADE',
        'DROP TABLE IF EXISTS "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" CASCADE',
        'DROP TABLE IF EXISTS "CHAT_INTERACTION" CASCADE',
        'DROP TABLE IF EXISTS "PAYMENT" CASCADE',
        'DROP TABLE IF EXISTS "DEVICES" CASCADE',
        'DROP TABLE IF EXISTS "USER_PROFILE" CASCADE',
        'DROP TABLE IF EXISTS "COACHES" CASCADE',
    ];
    
    for (const statement of dropStatements) {
        try {
            await client.query(statement);
            const tableMatch = statement.match(/DROP TABLE IF EXISTS "(\w+)"/);
            if (tableMatch) {
                console.log(`✓ Table '${tableMatch[1]}' dropped`);
            }
        } catch (error) {
            console.error(`Error dropping table:`, error.message);
        }
    }
}

/**
 * Verifies that all tables were created successfully
 */
async function verifyTables(client) {
    console.log('\nVerifying table creation...');
    
    const expectedTables = [
        'COACHES',
        'USER_PROFILE',
        'DEVICES',
        'PAYMENT',
        'CHAT_INTERACTION',
        'ACTIVE_DEVICE_ACCOUNT_MAPPING_USER',
        'ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH',
        'COACH_USER_LAST_INTERACTION'
    ];
    
    const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `;
    
    const result = await client.query(query);
    const existingTables = result.rows.map(row => row.table_name);
    
    console.log('\nExisting tables:');
    existingTables.forEach(table => {
        console.log(`  ✓ ${table}`);
    });
    
    const missingTables = expectedTables.filter(table => 
        !existingTables.includes(table)
    );
    
    if (missingTables.length > 0) {
        console.log('\nMissing tables:');
        missingTables.forEach(table => {
            console.log(`  ✗ ${table}`);
        });
        return false;
    }
    
    console.log('\n✓ All expected tables created successfully!');
    return true;
}

/**
 * Main function to create the database and tables
 */
async function createDatabase(options = {}) {
    const { dropExisting = false, verifyOnly = false } = options;
    
    try {
        // Step 1: Create database if it doesn't exist
        if (!verifyOnly) {
            await createDatabaseIfNotExists();
        }
        
        // Step 2: Connect to the target database
        const client = new Client(dbConfig);
        await client.connect();
        console.log(`Connected to database '${dbConfig.database}'`);
        
        if (verifyOnly) {
            // Just verify tables exist
            await verifyTables(client);
        } else {
            // Step 3: Optionally drop existing tables
            if (dropExisting) {
                await dropAllTables(client);
            }
            
            // Step 4: Read schema file
            const statements = readSchemaFile();
            
            // Step 5: Execute schema statements
            await executeSchemaStatements(client, statements);
            
            // Step 6: Verify tables were created
            await verifyTables(client);
        }
        
        await client.end();
        console.log('\nDatabase setup completed successfully!');
        
    } catch (error) {
        console.error('Error setting up database:', error);
        process.exit(1);
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    if (args.includes('--drop')) {
        options.dropExisting = true;
        console.log('⚠ WARNING: This will drop all existing tables!');
    }
    
    if (args.includes('--verify')) {
        options.verifyOnly = true;
        console.log('Running in verify-only mode...');
    }
    
    if (args.includes('--debug')) {
        options.debug = true;
        console.log('Running in debug mode...');
    }
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: node create-postgres-db.js [options]

Options:
  --drop     Drop all existing tables before creating new ones
  --verify   Only verify that tables exist, don't create anything
  --debug    Show debug information during execution
  --help     Show this help message

Examples:
  node create-postgres-db.js                 # Create database and tables
  node create-postgres-db.js --drop          # Drop and recreate all tables
  node create-postgres-db.js --verify        # Just check if tables exist
  node create-postgres-db.js --debug         # Show debug information
        `);
        process.exit(0);
    }
    
    createDatabase(options);
}

module.exports = {
    createDatabase,
    dbConfig,
    adminConfig
};