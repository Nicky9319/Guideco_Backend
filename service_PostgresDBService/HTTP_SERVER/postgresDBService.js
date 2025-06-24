const express = require('express');
const http = require('http');
const amqp = require('amqplib');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const bcrypt = require('bcrypt'); // Add this line to include bcrypt

const serviceTemplatesPath = path.join(__dirname, '../ServiceTemplates/Basic');

const MessageQueue = require(`${serviceTemplatesPath}/MESSAGE_QUEUE.js`);
const HTTPServer = require(`${serviceTemplatesPath}/HTTP_SERVER.js`);

class Service {
    constructor(httpServerHost, httpServerPort) {
        this.messageQueue = new MessageQueue("amqp://guest:guest@localhost/", "/");
        this.httpServer = new HTTPServer(httpServerHost, httpServerPort);
        this.initPostgresPool();
    }

    /**
     * Initializes the PostgreSQL connection pool with configuration parameters
     * Uses environment variables if available, otherwise defaults
     */
    initPostgresPool() {
        // Initialize PostgreSQL connection pool
        this.pool = new Pool({
            user: process.env.POSTGRES_USER || 'GuideCO',
            host: process.env.POSTGRES_HOST || 'localhost',
            database: process.env.POSTGRES_DB || 'GuideCO',
            password: process.env.POSTGRES_PASSWORD || 'guideco',
            port: process.env.POSTGRES_PORT || 5432,
        });

        // Test the connection
        this.pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('PostgreSQL connection error:', err);
            } else {
                console.log('PostgreSQL connected successfully');
            }
        });
    }

    // User related functions -------------------------------------------------------------------------------------------------------
    /**
     * Retrieves a user by their number
     * @param {string} number - Number of the user to find
     * @returns {Object|null} User object if found, null otherwise
     */
    async getUserByNumber(number) {
        const result = await this.pool.query(
            'SELECT * FROM "USER_PROFILE" WHERE "NUMBER" = $1',
            [number]
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Creates a new user with the provided number
     * @param {string} number - Number for the new user
     * @returns {Object} The newly created user object
     */
    async createUser(number) {
        const userId = uuidv4();
        const now = new Date();

        const result = await this.pool.query(
            'INSERT INTO "USER_PROFILE" ("ID", "NUMBER", "WALLET_BALANCE", "CREATED_AT") VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, number, 0, now]
        );

        return result.rows[0];
    }

    /**
     * Gets the wallet balance for a user by number
     * @param {string} number - Number of the user
     * @returns {number|null} Wallet balance if user exists, null otherwise
     */
    async getUserWalletBalance(number) {
        const result = await this.pool.query(
            'SELECT "WALLET_BALANCE" FROM "USER_PROFILE" WHERE "NUMBER" = $1',
            [number]
        );

        return result.rows.length > 0 ? result.rows[0].WALLET_BALANCE : null;
    }

    /**
     * Updates a user's wallet balance
     * @param {string} number - Number of the user
     * @param {number} amount - New wallet balance amount
     * @returns {Object|null} Updated user object if successful, null if user not found
     */
    async updateUserWalletBalance(number, amount) {
        const now = new Date();
        const result = await this.pool.query(
            'UPDATE "USER_PROFILE" SET "WALLET_BALANCE" = $1, "UPDATED_AT" = $2 WHERE "NUMBER" = $3 RETURNING *',
            [amount, now, number]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    // Device related functions -------------------------------------------------------------------------------------------------------
    /**
     * Sanitizes a device ID string to ensure it's valid for the database
     * @param {string} deviceId - The device ID to sanitize
     * @returns {string} Sanitized device ID
     */
    sanitizeDeviceId(deviceId) {
        if (!deviceId) return deviceId;
        
        // Remove any spaces, tabs, or newlines
        return deviceId.replace(/\s+/g, '').trim();
    }

    /**
     * Retrieves a device by its ID
     * @param {string} deviceId - ID of the device to retrieve
     * @returns {Object|null} Device object if found, null otherwise
     */
    async getDeviceById(deviceId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        const result = await this.pool.query(
            'SELECT * FROM "DEVICES" WHERE "ID" = $1',
            [sanitizedDeviceId]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Registers a new device or updates an existing one's FCM token
     * @param {string} deviceId - ID of the device
     * @param {string} fcmToken - Firebase Cloud Messaging token for the device
     * @returns {Object} Object containing device data and whether it previously existed
     */
    async registerOrUpdateDevice(deviceId, fcmToken) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        const existingDevice = await this.getDeviceById(sanitizedDeviceId);

        if (existingDevice) {
            // Update existing device
            const updateResult = await this.pool.query(
                'UPDATE "DEVICES" SET "FCM_TOKEN" = $1 WHERE "ID" = $2 RETURNING *',
                [fcmToken, sanitizedDeviceId]
            );
            return {
                device: updateResult.rows[0],
                exists: true
            };
        } else {
            // Insert new device
            const insertResult = await this.pool.query(
                'INSERT INTO "DEVICES" ("ID", "FCM_TOKEN") VALUES ($1, $2) RETURNING *',
                [sanitizedDeviceId, fcmToken]
            );
            return {
                device: insertResult.rows[0],
                exists: false
            };
        }
    }

    /**
     * Checks if a device-user mapping exists
     * @param {string} deviceId - ID of the device
     * @param {string} userId - ID of the user
     * @returns {boolean} True if mapping exists, false otherwise
     */
    async checkDeviceUserMapping(deviceId, userId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        const result = await this.pool.query(
            'SELECT * FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" WHERE "DEVICE_ID" = $1 AND "USER_ID" = $2',
            [sanitizedDeviceId, userId]
        );

        return result.rows.length > 0;
    }

    /**
     * Creates a new device-user mapping
     * @param {string} deviceId - ID of the device
     * @param {string} userId - ID of the user
     */
    async createDeviceUserMapping(deviceId, userId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        await this.pool.query(
            'INSERT INTO "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" ("DEVICE_ID", "USER_ID") VALUES ($1, $2)',
            [sanitizedDeviceId, userId]
        );
    }

    /**
     * Removes a device-user mapping
     * @param {string} deviceId - ID of the device
     * @param {string} userId - ID of the user
     * @returns {boolean} True if mapping was removed, false if not found
     */
    async removeDeviceUserMapping(deviceId, userId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        const result = await this.pool.query(
            'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" WHERE "DEVICE_ID" = $1 AND "USER_ID" = $2 RETURNING *',
            [sanitizedDeviceId, userId]
        );

        return result.rowCount > 0;
    }

    /**
     * Removes all device mappings for a specific user
     * @param {string} userId - ID of the user
     * @returns {Object} Result containing number of mappings removed and status
     */
    async removeAllDevicesForUser(userId) {
        try {
            console.log('Executing query: DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" WHERE "USER_ID" = $1 RETURNING *', [userId]);
            const result = await this.pool.query(
                'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" WHERE "USER_ID" = $1 RETURNING *',
                [userId]
            );
            console.log('Query result:', result);

            return {
                success: true,
                mappingsRemoved: result.rowCount,
                message: result.rowCount > 0 
                    ? `Successfully removed ${result.rowCount} device mappings` 
                    : "No device mappings found for this user"
            };
        } catch (error) {
            console.error("Error removing device mappings for user:", error);
            throw error;
        }
    }

    /**
     * Removes all device mappings for a specific coach
     * @param {string} coachId - ID of the coach
     * @returns {Object} Result containing number of mappings removed and status
     */
    async removeAllDevicesForCoach(coachId) {
        try {
            const result = await this.pool.query(
                'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" WHERE "COACH_ID" = $1 RETURNING *',
                [coachId]
            );

            return {
                success: true,
                mappingsRemoved: result.rowCount,
                message: result.rowCount > 0 
                    ? `Successfully removed ${result.rowCount} device mappings` 
                    : "No device mappings found for this coach"
            };
        } catch (error) {
            console.error("Error removing device mappings for coach:", error);
            throw error;
        }
    }

    /**
     * Checks if a device-coach mapping exists
     * @param {string} deviceId - ID of the device
     * @param {string} coachId - ID of the coach
     * @returns {boolean} True if mapping exists, false otherwise
     */
    async checkDeviceCoachMapping(deviceId, coachId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        const result = await this.pool.query(
            'SELECT * FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" WHERE "DEVICE_ID" = $1 AND "COACH_ID" = $2',
            [sanitizedDeviceId, coachId]
        );

        return result.rows.length > 0;
    }

    /**
     * Creates a new device-coach mapping
     * @param {string} deviceId - ID of the device
     * @param {string} coachId - ID of the coach
     */
    async createDeviceCoachMapping(deviceId, coachId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        await this.pool.query(
            'INSERT INTO "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" ("DEVICE_ID", "COACH_ID") VALUES ($1, $2)',
            [sanitizedDeviceId, coachId]
        );
    }

    /**
     * Removes a device-coach mapping
     * @param {string} deviceId - ID of the device
     * @param {string} coachId - ID of the coach
     * @returns {boolean} True if mapping was removed, false if not found
     */
    async removeDeviceCoachMapping(deviceId, coachId) {
        const sanitizedDeviceId = this.sanitizeDeviceId(deviceId);
        
        const result = await this.pool.query(
            'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" WHERE "DEVICE_ID" = $1 AND "COACH_ID" = $2 RETURNING *',
            [sanitizedDeviceId, coachId]
        );

        return result.rowCount > 0;
    }


    // Coach related functions -------------------------------------------------------------------------------------------------------
    
    /**
     * Retrieves a coach by their number
     * @param {string} coachNumber - Number of the coach to find
     * @returns {Object|null} Coach object if found, null otherwise
     */
    async getCoachByNumber(coachNumber) {
        const result = await this.pool.query(
            'SELECT * FROM "COACHES" WHERE "NUMBER" = $1',
            [coachNumber]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Creates a new coach with the provided number
     * @param {string} coachNumber - Number for the new coach
     * @returns {Object} The newly created coach object
     */
    async createCoach(coachNumber) {
        const coachId = uuidv4();
        const now = new Date();

        const result = await this.pool.query(
            'INSERT INTO "COACHES" ("ID", "NUMBER", "CREATED_AT") VALUES ($1, $2, $3) RETURNING *',
            [coachId, coachNumber, now]
        );

        return result.rows[0];
    }

    /**
     * Retrieves all coaches ordered by number
     * @returns {Array} Array of coach objects
     */
    async getAllCoaches() {
        const result = await this.pool.query(
            'SELECT * FROM "COACHES" ORDER BY "NUMBER"'
        );

        return result.rows;
    }

    /**
     * Retrieves coaches with their last interaction with a specific user
     * @param {string} userId - ID of the user
     * @param {number} limit - Maximum number of coaches to return
     * @param {string|null} timestamp - Optional timestamp to filter results
     * @returns {Array} Array of coach objects with last interaction data
     */
    async getCoachesWithLastInteraction(userId, limit = 10, timestamp = null) {
        let query = `
            SELECT c.*, 
                   culi."LAST_INTERACTION",
                   culi."MESSAGE",
                   culi."TYPE",
                   culi."FLAG",
                   culi."SENDER"
            FROM "COACHES" c 
            LEFT JOIN "COACH_USER_LAST_INTERACTION" culi ON c."ID" = culi."COACH_ID" AND culi."USER_ID" = $1
        `;

        const queryParams = [userId];
        let paramCount = 2;

        if (timestamp) {
            query += ` WHERE COALESCE(culi."LAST_INTERACTION", '1970-01-01'::timestamp) < $${paramCount}`;
            queryParams.push(new Date(timestamp));
            paramCount++;
        }

        query += ` ORDER BY culi."LAST_INTERACTION" DESC NULLS LAST, c."NUMBER" LIMIT $${paramCount}`;
        queryParams.push(parseInt(limit) || 10);

        const result = await this.pool.query(query, queryParams);
        return result.rows;
    }

    /**
     * Retrieves last interactions between a user and specified coaches
     * @param {string} userId - ID of the user
     * @param {Array} coachIds - Array of coach IDs to check
     * @returns {Array} Array of interactions with specified coaches
     */
    async getLastInteractionsByCoachIds(userId, coachIds) {
        const result = await this.pool.query(
            `SELECT 
                c."ID" AS "COACH_ID", 
                c."NUMBER" AS "COACH_NUMBER",
                culi."TYPE",
                culi."MESSAGE",
                culi."TIMESTAMP",
                culi."FLAG",
                culi."SENDER"
             FROM "COACHES" c
             LEFT JOIN "COACH_USER_LAST_INTERACTION" culi 
                ON c."ID" = culi."COACH_ID" 
                AND culi."USER_ID" = $1
             WHERE c."ID" = ANY($2)`,
            [userId, coachIds]
        );

        return result.rows;
    }



    // Helper functions -------------------------------------------------------------------------------------------------------

    /**
     * Formats coach data with last interaction information in a consistent structure
     * @param {Object} coach - Coach object with last interaction data
     * @returns {Object} Formatted coach information
     */
    formatCoachWithLastInteraction(coach) {
        const coachInfo = {
            COACH_ID: coach.ID,
            COACH_NUMBER: coach.NUMBER,
            CREATED_AT: coach.CREATED_AT,
            UPDATED_AT: coach.UPDATED_AT
        };

        if (coach.LAST_INTERACTION) {
            coachInfo.LAST_INTERACTION = {
                TIMESTAMP: coach.LAST_INTERACTION,
                MESSAGE: coach.MESSAGE,
                TYPE: coach.TYPE,
                FLAG: coach.FLAG,
                SENDER: coach.SENDER
            };
        }

        return coachInfo;
    }

    /**
     * Retrieves all chat messages between a user and a coach
     * @param {string} userId - ID of the user
     * @param {string} coachId - ID of the coach
     * @returns {Array} Array of chat message objects
     */
    async getChatMessages(userId, coachId) {
        const result = await this.pool.query(
            `SELECT 
                "SENDER",
                "MESSAGE",
                "CREATED_AT" AS "TIMESTAMP",
                "FLAG",
                "TYPE"
             FROM "CHAT_INTERACTION"
             WHERE "USER_ID" = $1 AND "COACH_ID" = $2
             ORDER BY "CREATED_AT" ASC`,
            [userId, coachId]
        );

        return result.rows;
    }

    /**
     * Retrieves paginated chat messages between a user and a coach
     * @param {string} userId - ID of the user
     * @param {string} coachId - ID of the coach
     * @param {number} limit - Maximum number of messages to return
     * @param {string|null} timestamp - Optional timestamp to filter messages before this time
     * @returns {Array} Array of message objects
     */
    async getPaginatedChatMessages(userId, coachId, limit = 10, timestamp = null) {
        let query = `
            SELECT 
                "SENDER",
                "MESSAGE",
                "CREATED_AT" AS "TIMESTAMP",
                "FLAG",
                "TYPE",
                "ID"
            FROM "CHAT_INTERACTION"
            WHERE "USER_ID" = $1 AND "COACH_ID" = $2
        `;

        const queryParams = [userId, coachId];
        let paramCount = 3;

        if (timestamp) {
            query += ` AND "CREATED_AT" < $${paramCount}`;
            queryParams.push(new Date(timestamp));
            paramCount++;
        }

        query += ` ORDER BY "CREATED_AT" DESC LIMIT $${paramCount}`;
        queryParams.push(parseInt(limit) || 10);

        const result = await this.pool.query(query, queryParams);
        return result.rows;
    }

    /**
     * Stores a new chat message in the database
     * @param {string} userId - ID of the user
     * @param {string} coachId - ID of the coach
     * @param {string} message - Message content
     * @param {string} type - Message type (default: 'TEXT')
     * @param {string} sender - Message sender (default: 'USER')
     * @param {Date|null} timestamp - Optional timestamp for the message
     * @returns {Object} The stored message
     */
    async storeMessageInDB(userId, coachId, message, type = 'TEXT', sender = 'USER', timestamp = null) {
        const messageId = uuidv4();
        const now = timestamp ? new Date(timestamp) : new Date();
        
        // Set initial message flag
        const flag = 'RECEIVED';
        
        const result = await this.pool.query(
            'INSERT INTO "CHAT_INTERACTION" ("ID", "USER_ID", "COACH_ID", "MESSAGE", "TYPE", "SENDER", "CREATED_AT", "FLAG") ' +
            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [messageId, userId, coachId, message, type, sender, now, flag]
        );
        
        // Also update the last interaction record
        await this.updateLastInteraction(userId, coachId, message, type, sender, now, flag);
        
        return result.rows[0];
    }
    
    /**
     * Updates or creates a record in the last interaction table between a user and coach
     * @param {string} userId - ID of the user
     * @param {string} coachId - ID of the coach
     * @param {string} message - Message content
     * @param {string} type - Message type
     * @param {string} sender - Message sender
     * @param {Date} timestamp - Timestamp for the message
     * @param {string} flag - Message status flag
     */
    async updateLastInteraction(userId, coachId, message, type, sender, timestamp, flag) {
        try {
            // First check if a record already exists
            const existingRecord = await this.pool.query(
                'SELECT * FROM "COACH_USER_LAST_INTERACTION" WHERE "USER_ID" = $1 AND "COACH_ID" = $2',
                [userId, coachId]
            );
            
            if (existingRecord.rows.length > 0) {
                // Update existing record
                await this.pool.query(
                    'UPDATE "COACH_USER_LAST_INTERACTION" ' +
                    'SET "TYPE" = $1, "MESSAGE" = $2, "TIMESTAMP" = $3, "FLAG" = $4, "SENDER" = $5 ' +
                    'WHERE "USER_ID" = $6 AND "COACH_ID" = $7',
                    [type, message, timestamp, flag, sender, userId, coachId]
                );
            } else {
                // Insert new record
                await this.pool.query(
                    'INSERT INTO "COACH_USER_LAST_INTERACTION" ' +
                    '("USER_ID", "COACH_ID", "TYPE", "MESSAGE", "TIMESTAMP", "FLAG", "SENDER") ' +
                    'VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [userId, coachId, type, message, timestamp, flag, sender]
                );
            }
        } catch (error) {
            console.error("Error updating last interaction:", error);
            // We don't want to fail the entire message insertion if this fails
            // So we just log the error and continue
        }
    }

    /**
     * Configures and sets up all API routes for the HTTP server
     */
    async ConfigureAPIRoutes() {
        this.httpServer.app.use(express.json());

        // Check if user exists by number
        this.httpServer.app.get("/User/Check", async (req, res) => {
            const { NUMBER } = req.query;

            if (!NUMBER) {
                return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
                const user = await this.getUserByNumber(NUMBER);

                if (user) {
                    // User exists
                    return res.json({ exists: true, user });
                } else {
                    // User doesn't exist
                    return res.json({ exists: false });
                }
            } catch (error) {
                console.error("Error checking user:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Create new user
        this.httpServer.app.post("/User/Create", async (req, res) => {
            const { NUMBER } = req.body;

            if (!NUMBER) {
            return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
            // First check if user already exists
            const existingUser = await this.getUserByNumber(NUMBER);

            if (existingUser) {
                return res.status(409).json({
                error: "User already exists",
                user: existingUser
                });
            }

            const newUser = await this.createUser(NUMBER);

            return res.status(201).json({
                message: "User created successfully",
                user: newUser
            });
            } catch (error) {
            console.error("Error creating user:", error);
            return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Get user wallet balance
        this.httpServer.app.get("/User/Wallet", async (req, res) => {
            const { NUMBER } = req.query;

            if (!NUMBER) {
                return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
                const balance = await this.getUserWalletBalance(NUMBER);

                if (balance !== null) {
                    return res.json({ balance });
                } else {
                    return res.status(404).json({ error: "User not found" });
                }
            } catch (error) {
                console.error("Error fetching wallet balance:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Update wallet balance
        this.httpServer.app.put("/User/Wallet", async (req, res) => {
            const { NUMBER, AMOUNT } = req.body;

            if (!NUMBER || AMOUNT === undefined) {
                return res.status(400).json({ error: "NUMBER and AMOUNT are required" });
            }

            try {
                const updatedUser = await this.updateUserWalletBalance(NUMBER, AMOUNT);

                if (updatedUser) {
                    return res.json({
                        message: "Wallet balance updated successfully",
                        user: updatedUser
                    });
                } else {
                    return res.status(404).json({ error: "User not found" });
                }
            } catch (error) {
                console.error("Error updating wallet balance:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        
        // Register device FCM token
        this.httpServer.app.post("/Device/Register", async (req, res) => {
            const { DEVICE_ID, FCM_TOKEN } = req.body;

            if (!DEVICE_ID || !FCM_TOKEN) {
                return res.status(400).json({ error: "DEVICE_ID and FCM_TOKEN are required" });
            }

            try {
                const result = await this.registerOrUpdateDevice(DEVICE_ID, FCM_TOKEN);

                if (result.exists) {
                    return res.status(200).json({
                        message: "Device token updated successfully",
                        device: result.device,
                        exists: true
                    });
                } else {
                    return res.status(201).json({
                        message: "Device registered successfully",
                        device: result.device,
                        exists: false
                    });
                }
            } catch (error) {
                console.error("Error registering device:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Map device to user account
        this.httpServer.app.post("/Device/Map/User", async (req, res) => {
            const { DEVICE_ID, NUMBER } = req.body;

            if (!DEVICE_ID || !NUMBER) {
                return res.status(400).json({ error: "DEVICE_ID and NUMBER are required" });
            }

            try {
                const user = await this.getUserByNumber(NUMBER);

                if (!user) {
                    return res.status(404).json({ error: "User not found" });
                }

                const userId = user.ID;
                const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                
                // Create the new mapping without removing existing mappings
                const mappingExists = await this.checkDeviceUserMapping(sanitizedDeviceId, userId);

                if (!mappingExists) {
                    await this.createDeviceUserMapping(sanitizedDeviceId, userId);
                    return res.status(201).json({
                        success: true,
                        message: "Device mapped to user account successfully"
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "Device already mapped to this user account"
                    });
                }
            } catch (error) {
                console.error("Error mapping device to user:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Map device to coach account
        this.httpServer.app.post("/Device/Map/Coach", async (req, res) => {
            const { DEVICE_ID, NUMBER } = req.body;

            if (!DEVICE_ID || !NUMBER) {
                return res.status(400).json({ error: "DEVICE_ID and NUMBER are required" });
            }

            try {
                const coach = await this.getCoachByNumber(NUMBER);

                if (!coach) {
                    return res.status(404).json({ error: "Coach not found" });
                }

                const coachId = coach.ID;
                const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                
                // Create the new mapping without removing existing mappings
                const mappingExists = await this.checkDeviceCoachMapping(sanitizedDeviceId, coachId);

                if (!mappingExists) {
                    await this.createDeviceCoachMapping(sanitizedDeviceId, coachId);
                    return res.status(201).json({
                        success: true,
                        message: "Device mapped to coach account successfully"
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: "Device already mapped to this coach account"
                    });
                }
            } catch (error) {
                console.error("Error mapping device to coach:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Delete device to user account mapping - updated to only require NUMBER
        this.httpServer.app.delete("/Device/Map/User", async (req, res) => {
            const { NUMBER } = req.body;

            if (!NUMBER) {
                return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
                const user = await this.getUserByNumber(NUMBER);

                if (!user) {
                    return res.status(404).json({ error: "User not found" });
                }

                const userId = user.ID;
                const result = await this.removeAllDevicesForUser(userId);

                return res.status(200).json({
                    success: true,
                    message: result.message,
                    mappingsRemoved: result.mappingsRemoved
                });
            } catch (error) {
                console.error("Error deleting device mappings:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Delete device to coach account mapping - updated to only require NUMBER
        this.httpServer.app.delete("/Device/Map/Coach", async (req, res) => {
            const { NUMBER } = req.body;

            if (!NUMBER) {
                return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
                const coach = await this.getCoachByNumber(NUMBER);

                if (!coach) {
                    return res.status(404).json({ error: "Coach not found" });
                }

                const coachId = coach.ID;
                const result = await this.removeAllDevicesForCoach(coachId);

                return res.status(200).json({
                    success: true,
                    message: result.message,
                    mappingsRemoved: result.mappingsRemoved
                });
            } catch (error) {
                console.error("Error deleting device mappings:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });


        // Check device mapping for user
        this.httpServer.app.get("/Device/CheckMapping/User", async (req, res) => {
            const { DEVICE_ID, NUMBER } = req.query;

            if (!DEVICE_ID || !NUMBER) {
                return res.status(400).json({ 
                    success: false,
                    error: "DEVICE_ID and NUMBER are required" 
                });
            }

            try {
                const user = await this.getUserByNumber(NUMBER);
                
                if (!user) {
                    return res.status(404).json({ 
                        success: false,
                        error: "User not found" 
                    });
                }
                
                const userId = user.ID;
                const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                const isMapped = await this.checkDeviceUserMapping(sanitizedDeviceId, userId);
                
                return res.status(200).json({
                    success: true,
                    isMapped,
                    deviceId: DEVICE_ID,
                    number: NUMBER,
                    accountType: "USER"
                });
            } catch (error) {
                console.error("Error checking user device mapping:", error);
                return res.status(500).json({ 
                    success: false,
                    error: "Database error", 
                    details: error.message 
                });
            }
        });

        // Check device mapping for coach
        this.httpServer.app.get("/Device/CheckMapping/Coach", async (req, res) => {
            const { DEVICE_ID, NUMBER } = req.query;

            if (!DEVICE_ID || !NUMBER) {
                return res.status(400).json({ 
                    success: false,
                    error: "DEVICE_ID and NUMBER are required" 
                });
            }

            try {
                const coach = await this.getCoachByNumber(NUMBER);
                
                if (!coach) {
                    return res.status(404).json({ 
                        success: false,
                        error: "Coach not found" 
                    });
                }
                
                const coachId = coach.ID;
                const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                const isMapped = await this.checkDeviceCoachMapping(sanitizedDeviceId, coachId);
                
                return res.status(200).json({
                    success: true,
                    isMapped,
                    deviceId: DEVICE_ID,
                    number: NUMBER,
                    accountType: "COACH"
                });
            } catch (error) {
                console.error("Error checking coach device mapping:", error);
                return res.status(500).json({ 
                    success: false,
                    error: "Database error", 
                    details: error.message 
                });
            }
        });

        // Backward compatibility for device mapping check (deprecated)
        this.httpServer.app.get("/Device/CheckMapping", async (req, res) => {
            const { DEVICE_ID, NUMBER, ACCOUNT_TYPE = "USER" } = req.query;

            if (!DEVICE_ID || !NUMBER) {
                return res.status(400).json({ 
                    success: false,
                    error: "DEVICE_ID and NUMBER are required" 
                });
            }

            try {
                if (ACCOUNT_TYPE.toUpperCase() === "COACH") {
                    // Forward to coach endpoint
                    const coach = await this.getCoachByNumber(NUMBER);
                    
                    if (!coach) {
                        return res.status(404).json({ 
                            success: false,
                            error: "Coach not found" 
                        });
                    }
                    
                    const coachId = coach.ID;
                    const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                    const isMapped = await this.checkDeviceCoachMapping(sanitizedDeviceId, coachId);
                    
                    return res.status(200).json({
                        success: true,
                        isMapped,
                        deviceId: DEVICE_ID,
                        number: NUMBER,
                        accountType: "COACH"
                    });
                } else {
                    // Forward to user endpoint
                    const user = await this.getUserByNumber(NUMBER);
                    
                    if (!user) {
                        return res.status(404).json({ 
                            success: false,
                            error: "User not found" 
                        });
                    }
                    
                    const userId = user.ID;
                    const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                    const isMapped = await this.checkDeviceUserMapping(sanitizedDeviceId, userId);
                    
                    return res.status(200).json({
                        success: true,
                        isMapped,
                        deviceId: DEVICE_ID,
                        number: NUMBER,
                        accountType: "USER"
                    });
                }
            } catch (error) {
                console.error("Error checking device mapping:", error);
                return res.status(500).json({ 
                    success: false,
                    error: "Database error", 
                    details: error.message 
                });
            }
        });

        // Register new coach
        this.httpServer.app.post("/Coach/Register", async (req, res) => {
            const { NUMBER } = req.body;

            if (!NUMBER) {
                return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
                const existingCoach = await this.getCoachByNumber(NUMBER);

                if (existingCoach) {
                    return res.status(409).json({
                        error: "Coach already exists",
                        coach: existingCoach
                    });
                }

                const newCoach = await this.createCoach(NUMBER);

                return res.status(201).json({
                    message: "Coach registered successfully",
                    coach: newCoach
                });
            } catch (error) {
                console.error("Error registering coach:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Get coach information
        this.httpServer.app.get("/Coach/Info", async (req, res) => {
            const { NUMBER } = req.query;

            if (!NUMBER) {
                return res.status(400).json({ error: "NUMBER is required" });
            }

            try {
                const coach = await this.getCoachByNumber(NUMBER);

                if (coach) {
                    return res.json({ coach });
                } else {
                    return res.status(404).json({ error: "Coach not found" });
                }
            } catch (error) {
                console.error("Error retrieving coach:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Get all coaches list
        this.httpServer.app.get("/Coach/GetAllCoachesList", async (req, res) => {
            try {
                const coaches = await this.getAllCoaches();

                return res.json({ coaches });
            } catch (error) {
                console.error("Error retrieving coaches:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Get coach list with last interaction
        this.httpServer.app.get("/Coach/GetPaginatedCoachList", async (req, res) => {
            const { USER_NUMBER, LIMIT = 10, TIMESTAMP } = req.query;

            if (!USER_NUMBER) {
                return res.status(400).json({ error: "USER_NUMBER is required" });
            }

            try {
                const user = await this.getUserByNumber(USER_NUMBER);

                if (!user) {
                    return res.status(404).json({ error: "User not found" });
                }

                const userId = user.ID;
                const coaches = await this.getCoachesWithLastInteraction(userId, LIMIT, TIMESTAMP);

                // Format response with comprehensive coach information
                const formattedCoaches = coaches.map(coach => this.formatCoachWithLastInteraction(coach));

                return res.json({
                    COACHES: formattedCoaches,
                    COUNT: formattedCoaches.length
                });
            } catch (error) {
                console.error("Error retrieving coach list:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        // Get last interactions with specified coaches
        this.httpServer.app.get("/Coach/LastInteractionInformation", async (req, res) => {
            try {
                const { USER_NUMBER, COACH_IDS } = req.body;

                // Validate required parameters
                if (!USER_NUMBER) {
                    return res.status(400).json({ error: "USER_NUMBER is required" });
                }

                if (!COACH_IDS || !Array.isArray(COACH_IDS) || COACH_IDS.length === 0) {
                    return res.status(400).json({ error: "COACH_IDS must be a non-empty array" });
                }

                const user = await this.getUserByNumber(USER_NUMBER);

                if (!user) {
                    return res.status(404).json({ error: "User not found" });
                }

                const userId = user.ID;
                const interactions = await this.getLastInteractionsByCoachIds(userId, COACH_IDS);

                // Format the response data
                const interactionData = {};
                interactions.forEach(row => {
                    interactionData[row.COACH_ID] = {
                        COACH_ID: row.COACH_ID,
                        LAST_INTERACTION: row.MESSAGE ? {
                            TYPE: row.TYPE,
                            MESSAGE: row.MESSAGE,
                            TIMESTAMP: row.TIMESTAMP,
                            FLAG: row.FLAG,
                            SENDER: row.SENDER
                        } : null
                    };
                });

                // Check if any requested coach IDs were not found
                const foundCoachIds = interactions.map(row => row.COACH_ID);
                const missingCoachIds = COACH_IDS.filter(id => !foundCoachIds.includes(id));

                if (missingCoachIds.length > 0) {
                    return res.status(200).json({
                        INTERACTIONS: interactionData,
                        MISSING_COACH_IDS: missingCoachIds,
                        MESSAGE: "Some coach IDs were not found"
                    });
                }

                return res.json({
                    INTERACTIONS: interactionData
                });
            } catch (error) {
                console.error("Error retrieving last interaction information:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

        this.httpServer.app.post("/Chat/GetAllMessages", async (req, res) => {
            const { USER_NUMBER, COACH_ID } = req.query;

            if (!USER_NUMBER || !COACH_ID) {
                return res.status(400).json({ 
                    ERROR: "USER_NUMBER and COACH_ID are required" 
                });
            }

            try {
                // Get user by number to obtain user ID
                const user = await this.getUserByNumber(USER_NUMBER);
                
                if (!user) {
                    return res.status(404).json({ 
                        ERROR: "User not found" 
                    });
                }

                // Check if coach exists
                const coach = await this.pool.query(
                    'SELECT * FROM "COACHES" WHERE "ID" = $1',
                    [COACH_ID]
                );

                if (coach.rows.length === 0) {
                    return res.status(404).json({ 
                        ERROR: "Coach not found" 
                    });
                }

                // Get all chat messages between the user and coach
                const messages = await this.getChatMessages(user.ID, COACH_ID);
                
                return res.status(200).json({
                    MESSAGES: messages,
                    COUNT: messages.length,
                    USER_ID: user.ID,
                    COACH_ID: COACH_ID
                });
            } catch (error) {
                console.error("Error retrieving chat messages:", error);
                return res.status(500).json({ 
                    ERROR: "Database error", 
                    DETAILS: error.message 
                });
            }
        });

        this.httpServer.app.get("/Chat/GetPaginatedMessages", async (req, res) => {
            const { USER_NUMBER, COACH_ID, TIMESTAMP, LIMIT = 10 } = req.query;

            if (!USER_NUMBER || !COACH_ID) {
                return res.status(400).json({ 
                    ERROR: "USER_NUMBER and COACH_ID are required" 
                });
            }

            try {
                // Get user by number to obtain user ID
                const user = await this.getUserByNumber(USER_NUMBER);
                
                if (!user) {
                    return res.status(404).json({ 
                        ERROR: "User not found" 
                    });
                }

                // Check if coach exists
                const coach = await this.pool.query(
                    'SELECT * FROM "COACHES" WHERE "ID" = $1',
                    [COACH_ID]
                );

                if (coach.rows.length === 0) {
                    return res.status(404).json({ 
                        ERROR: "Coach not found" 
                    });
                }

                // Validate limit parameter
                const parsedLimit = parseInt(LIMIT) || 10;
                if (parsedLimit <= 0) {
                    return res.status(400).json({
                        ERROR: "LIMIT must be a positive number"
                    });
                }

                // Validate timestamp if provided
                if (TIMESTAMP && isNaN(Date.parse(TIMESTAMP))) {
                    return res.status(400).json({
                        ERROR: "Invalid TIMESTAMP format"
                    });
                }

                // Get paginated chat messages
                const messages = await this.getPaginatedChatMessages(
                    user.ID, 
                    COACH_ID, 
                    parsedLimit, 
                    TIMESTAMP
                );
                
                // Check if there might be more messages
                const hasMore = messages.length >= parsedLimit;

                // Get the oldest timestamp for next page query
                const oldestTimestamp = messages.length > 0 ? 
                    messages[messages.length - 1].TIMESTAMP : null;
                
                return res.status(200).json({
                    MESSAGES: messages,
                    COUNT: messages.length,
                    USER_ID: user.ID,
                    COACH_ID: COACH_ID,
                    HAS_MORE: hasMore,
                    NEXT_TIMESTAMP: oldestTimestamp
                });
            } catch (error) {
                console.error("Error retrieving paginated messages:", error);
                return res.status(500).json({ 
                    ERROR: "Database error", 
                    DETAILS: error.message 
                });
            }
        });

        this.httpServer.app.post("/Chat/StoreMessage", async (req, res) => {
            const { USER_ID, COACH_ID, MESSAGE, TYPE = 'TEXT', SENDER = 'USER', TIMESTAMP } = req.body;
            
            // Validate required fields
            if (!USER_ID || !COACH_ID || !MESSAGE) {
                return res.status(400).json({
                    error: "Missing required fields",
                    details: "USER_ID, COACH_ID, and MESSAGE are required"
                });
            }
            
            // Validate sender value
            if (SENDER !== 'USER' && SENDER !== 'COACH') {
                return res.status(400).json({
                    error: "Invalid SENDER value",
                    details: "SENDER must be either 'USER' or 'COACH'"
                });
            }
            
            try {
                // Check if user exists
                const userResult = await this.pool.query(
                    'SELECT * FROM "USER_PROFILE" WHERE "ID" = $1',
                    [USER_ID]
                );
                
                if (userResult.rows.length === 0) {
                    return res.status(404).json({
                        ERROR: "User not found",
                        DETAILS: "The specified USER_ID does not exist"
                    });
                }
                
                // Check if coach exists
                const coachResult = await this.pool.query(
                    'SELECT * FROM "COACHES" WHERE "ID" = $1',
                    [COACH_ID]
                );
                
                if (coachResult.rows.length === 0) {
                    return res.status(404).json({
                        ERROR: "Coach not found",
                        DETAILS: "The specified COACH_ID does not exist"
                    });
                }
                
                // Store the message
                const storedMessage = await this.storeMessageInDB(
                    USER_ID, 
                    COACH_ID, 
                    MESSAGE, 
                    TYPE, 
                    SENDER, 
                    TIMESTAMP
                );
                
                return res.status(201).json({
                    MESSAGE: "Message stored successfully",
                    STATUS: "SUCCESS",
                    MESSAGE_ID: storedMessage.ID,
                });
            } catch (error) {
                console.error("Error storing message:", error);
                return res.status(500).json({
                    ERROR: "Database error",
                    STATUS: "FAILED",
                    DETAILS: error.message
                });
            }
        });

        // Remove all mappings for a specific device
        this.httpServer.app.delete("/Device/Map/RemoveAll", async (req, res) => {
            const { DEVICE_ID } = req.body;

            if (!DEVICE_ID) {
                return res.status(400).json({ error: "DEVICE_ID is required" });
            }

            try {
                const sanitizedDeviceId = this.sanitizeDeviceId(DEVICE_ID);
                
                // First, remove any device-user mappings
                const userMappingsResult = await this.pool.query(
                    'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" WHERE "DEVICE_ID" = $1 RETURNING *',
                    [sanitizedDeviceId]
                );
                
                // Then, remove any device-coach mappings
                const coachMappingsResult = await this.pool.query(
                    'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" WHERE "DEVICE_ID" = $1 RETURNING *',
                    [sanitizedDeviceId]
                );

                const totalRemoved = userMappingsResult.rowCount + coachMappingsResult.rowCount;
                
                if (totalRemoved === 0) {
                    return res.status(200).json({
                        success: true,
                        message: "No existing mappings found for this device",
                        userMappingsRemoved: 0,
                        coachMappingsRemoved: 0
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "All device mappings removed successfully",
                    userMappingsRemoved: userMappingsResult.rowCount,
                    coachMappingsRemoved: coachMappingsResult.rowCount
                });
            } catch (error) {
                console.error("Error removing all device mappings:", error);
                return res.status(500).json({ error: "Database error", details: error.message });
            }
        });

    }

    /**
     * Initializes and starts the service, including message queue and HTTP server
     */
    async startService() {
        await this.messageQueue.InitializeConnection();
        // await this.messageQueue.AddQueueAndMapToCallback("queue1", this.fun1.bind(this));
        await this.messageQueue.StartListeningToQueue();

        await this.ConfigureAPIRoutes();
        await this.httpServer.run_app();
    }
}

/**
 * Creates and starts the service with the specified host and port
 */
async function start_service() {
    const service = new Service('127.0.0.1', 20000);
    await service.startService();
}

start_service().catch(error => {
    console.error("Error starting service:", error);
});
