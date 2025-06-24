const express = require('express');
const http = require('http');
const amqp = require('amqplib');

const path = require('path');

const serviceTemplatesPath = path.join(__dirname, '../ServiceTemplates/Basic');

const MessageQueue = require(`${serviceTemplatesPath}/MESSAGE_QUEUE.js`);
const HTTPServer = require(`${serviceTemplatesPath}/HTTP_SERVER.js`);
const axios = require('axios');
const fs = require('fs');


class Service {
    constructor(httpServerHost, httpServerPort) {
        this.messageQueue = new MessageQueue("amqp://guest:guest@localhost/", "/");
        this.httpServer = new HTTPServer(httpServerHost, httpServerPort);
        this.postgresServiceUrl = 'http://127.0.0.1:20000';
    }

    /**
     * Fetches the coach list with last interaction data from the PostgreSQL service
     * @param {string} userEmail - Email of the user
     * @param {number} limit - Maximum number of coaches to return (optional)
     * @param {string} timestamp - Optional timestamp to filter results by
     * @returns {Promise<Object>} - Coach list data
     */
    async fetchCoachListFromDB(userEmail, limit = 10, timestamp = null) {
        try {
            const params = { 
                USER_EMAIL: userEmail,
                LIMIT: limit
            };
            
            // Only add timestamp parameter if it's provided
            if (timestamp) {
                params.TIMESTAMP = timestamp;
            }
            
            const response = await axios.get(`${this.postgresServiceUrl}/Coach/GetPaginatedCoachList`, {
                params: params
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching coach list from DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Fetches the complete list of coaches from the PostgreSQL service
     * @returns {Promise<Object>} - Complete coach list data
     */
    async fetchAllCoachesFromDB() {
        try {
            const response = await axios.get(`${this.postgresServiceUrl}/Coach/GetAllCoachesList`);
            return response.data;
        } catch (error) {
            console.error("Error fetching all coaches from DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Registers a new coach by calling the PostgreSQL service
     * @param {string} name - Name of the coach
     * @param {string} email - Email of the coach
     * @param {string} password - Password for the coach
     * @returns {Promise<Object>} - Registration result
     */
    async registerCoachWithDB(name, email, password) {
        try {
            const response = await axios.post(`${this.postgresServiceUrl}/Coach/Register`, {
                NAME: name,
                EMAIL: email,
                PASSWORD: password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error("Error registering coach with DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Fetches coach information from the PostgreSQL service
     * @param {string} email - Email of the coach
     * @returns {Promise<Object>} - Coach information data
     */
    async fetchCoachInfoFromDB(email) {
        try {
            const response = await axios.get(`${this.postgresServiceUrl}/Coach/Info`, {
                params: { EMAIL: email }
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching coach info from DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Updates coach information in the PostgreSQL service
     * @param {string} email - Email of the coach
     * @param {string} name - New name for the coach
     * @param {string} password - New password for the coach (optional)
     * @returns {Promise<Object>} - Updated coach data
     */
    async updateCoachInDB(email, name, password = null) {
        try {
            const requestData = {
                EMAIL: email,
                NAME: name
            };
            
            // Only include password in the request if it's provided
            if (password) {
                requestData.PASSWORD = password;
            }
            
            const response = await axios.put(`${this.postgresServiceUrl}/Coach/Update`, requestData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error("Error updating coach in DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Checks the credentials of a coach by calling the PostgreSQL service
     * @param {string} email - Email of the coach
     * @param {string} password - Password of the coach
     * @returns {Promise<Object>} - Credential check result
     */
    async checkCoachCredentials(email, password) {
        try {
            const response = await axios.post(`${this.postgresServiceUrl}/Coach/CheckCredential`, {
                EMAIL: email,
                PASSWORD: password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error("Error checking coach credentials:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Validates if an email has a valid format
     * @param {string} email - Email to validate
     * @returns {boolean} - True if email is valid, false otherwise
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validates if a value is a valid positive integer or can be converted to one
     * @param {any} value - Value to validate
     * @param {number} defaultValue - Default value if validation fails
     * @returns {number} - Validated integer or default value
     */
    validateLimit(value, defaultValue = 10) {
        const parsedValue = parseInt(value);
        return !isNaN(parsedValue) && parsedValue > 0 ? parsedValue : defaultValue;
    }

    /**
     * Validates if a value is a valid ISO timestamp
     * @param {string} value - Timestamp value to validate
     * @returns {string|null} - Valid timestamp or null
     */
    validateTimestamp(value) {
        if (!value) return null;
        
        // Check if it's a valid date
        const date = new Date(value);
        return !isNaN(date.getTime()) ? value : null;
    }

    /**
     * Validates if a name is valid (not empty and properly formatted)
     * @param {string} name - Name to validate
     * @returns {boolean} - True if name is valid, false otherwise
     */
    validateName(name) {
        return typeof name === 'string' && name.trim().length > 0;
    }

    /**
     * Validates if a password meets minimum requirements
     * @param {string} password - Password to validate
     * @returns {boolean} - True if password is valid, false otherwise
     */
    validatePassword(password) {
        return typeof password === 'string' && password.length >= 6;
    }

    /**
     * Formats the coach data for consistent API response
     * @param {Array} coaches - Array of coach objects
     * @returns {Array} - Formatted coach data
     */
    formatCoachResponse(coaches) {
        return coaches.map(coach => {
            const formattedCoach = {
                COACH_ID: coach.COACH_ID,
                COACH_NAME: coach.COACH_NAME,
                COACH_EMAIL: coach.COACH_EMAIL
            };

            // Add last interaction data if available
            if (coach.LAST_INTERACTION) {
                formattedCoach.LAST_INTERACTION = {
                    MESSAGE: coach.LAST_INTERACTION.MESSAGE,
                    FLAG: coach.LAST_INTERACTION.FLAG,
                    SENDER: coach.LAST_INTERACTION.SENDER,
                    TYPE: coach.LAST_INTERACTION.TYPE,
                    TIMESTAMP: coach.LAST_INTERACTION.TIMESTAMP
                };
            } else {
                formattedCoach.LAST_INTERACTION = null;
            }

            return formattedCoach;
        });
    }

    // Configure the API route for the HTTP server.
    async ConfigureAPIRoutes() {
        this.httpServer.app.use(express.json());

        this.httpServer.app.get("/Coach/GetPaginatedCoachList", async (req, res) => {
            // Extract parameters from the query parameters
            const { USER_EMAIL, LIMIT, TIMESTAMP } = req.query;
            
            // Validate required parameters
            if (!USER_EMAIL) {
                return res.status(400).json({ 
                    ERROR: "USER_EMAIL is required" 
                });
            }

            // Validate email format
            if (!this.validateEmail(USER_EMAIL)) {
                return res.status(400).json({ 
                    ERROR: "Invalid email format" 
                });
            }
            
            // Validate and parse limit parameter
            const validatedLimit = this.validateLimit(LIMIT);
            
            // Validate timestamp parameter
            const validatedTimestamp = this.validateTimestamp(TIMESTAMP);
            if (TIMESTAMP && !validatedTimestamp) {
                return res.status(400).json({
                    ERROR: "Invalid TIMESTAMP format",
                    MESSAGE: "TIMESTAMP must be a valid ISO date string"
                });
            }
            
            try {
                // Fetch coach list data from the PostgreSQL service with optional parameters
                const coachListData = await this.fetchCoachListFromDB(USER_EMAIL, validatedLimit, validatedTimestamp);
                
                if (!coachListData || !coachListData.COACHES) {
                    return res.status(500).json({
                        ERROR: "Unexpected response format from database service"
                    });
                }
                
                // Format the response
                const formattedCoaches = this.formatCoachResponse(coachListData.COACHES);
                
                // Return success response
                return res.status(200).json({
                    COACHES: formattedCoaches,
                    COUNT: formattedCoaches.length,
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    // Error response from the PostgreSQL service
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;
                    
                    if (statusCode === 404 && errorData.error === "User not found") {
                        return res.status(404).json({
                            ERROR: "USER_NOT_FOUND",
                            MESSAGE: "The specified user email does not exist"
                        });
                    }
                    
                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        DETAILS: errorData.details || errorData.message || "An error occurred in the database service"
                    });
                } else {
                    // Network or other error
                    console.error("Failed to retrieve coach list:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to retrieve coach list",
                        DETAILS: error.message
                    });
                }
            }
        });

        this.httpServer.app.post("/Coach/RegisterCoach", async (req, res) => {
            // Extract parameters from the request body
            const { NAME, EMAIL, PASSWORD } = req.body;
            
            // Validate required parameters
            if (!NAME || !EMAIL || !PASSWORD) {
                return res.status(400).json({ 
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "NAME, EMAIL, and PASSWORD are required" 
                });
            }

            // Validate email format
            if (!this.validateEmail(EMAIL)) {
                return res.status(400).json({ 
                    ERROR: "INVALID_EMAIL",
                    MESSAGE: "Invalid email format" 
                });
            }
            
            // Validate name
            if (!this.validateName(NAME)) {
                return res.status(400).json({
                    ERROR: "INVALID_NAME",
                    MESSAGE: "Name cannot be empty"
                });
            }
            
            // Validate password
            if (!this.validatePassword(PASSWORD)) {
                return res.status(400).json({
                    ERROR: "INVALID_PASSWORD",
                    MESSAGE: "Password must be at least 6 characters long"
                });
            }
            
            try {
                // Register coach with the PostgreSQL service
                const registrationResult = await this.registerCoachWithDB(NAME, EMAIL, PASSWORD);
                
                // Return success response
                return res.status(201).json({
                    STATUS: "SUCCESS",
                    MESSAGE: "Coach registered successfully",
                    COACH: {
                        COACH_ID: registrationResult.coach.ID,
                        COACH_NAME: registrationResult.coach.NAME,
                        COACH_EMAIL: registrationResult.coach.EMAIL,
                        CREATED_AT: registrationResult.coach.CREATED_AT
                    }
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;
                    
                    if (statusCode === 409) {
                        // Coach already exists
                        return res.status(409).json({
                            ERROR: "COACH_ALREADY_EXISTS",
                            MESSAGE: "A coach with this email already exists",
                            COACH: {
                                COACH_ID: errorData.coach.ID,
                                COACH_NAME: errorData.coach.NAME,
                                COACH_EMAIL: errorData.coach.EMAIL
                            }
                        });
                    }
                    
                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.message || "An error occurred in the database service",
                        DETAILS: errorData.details || null
                    });
                } else {
                    // Network or other error
                    console.error("Failed to register coach:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to register coach",
                        DETAILS: error.message
                    });
                }
            }
        });

        this.httpServer.app.get("/Coach/GetCoachInfo", async (req, res) => {
            // Extract parameters from the query parameters
            const { EMAIL } = req.query;
            
            // Validate required parameters
            if (!EMAIL) {
                return res.status(400).json({ 
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "EMAIL parameter is required" 
                });
            }

            // Validate email format
            if (!this.validateEmail(EMAIL)) {
                return res.status(400).json({ 
                    ERROR: "INVALID_EMAIL",
                    MESSAGE: "Invalid email format" 
                });
            }
            
            try {
                // Fetch coach information from the PostgreSQL service
                const coachData = await this.fetchCoachInfoFromDB(EMAIL);
                
                if (!coachData || !coachData.coach) {
                    return res.status(404).json({
                        ERROR: "COACH_NOT_FOUND",
                        MESSAGE: "No coach found with the specified email"
                    });
                }
                
                // Return success response
                return res.status(200).json({
                    STATUS: "SUCCESS",
                    COACH: {
                        COACH_ID: coachData.coach.ID,
                        COACH_NAME: coachData.coach.NAME,
                        COACH_EMAIL: coachData.coach.EMAIL,
                        CREATED_AT: coachData.coach.CREATED_AT,
                        UPDATED_AT: coachData.coach.UPDATED_AT
                    }
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;
                    
                    if (statusCode === 404) {
                        return res.status(404).json({
                            ERROR: "COACH_NOT_FOUND",
                            MESSAGE: "No coach found with the specified email"
                        });
                    }
                    
                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.message || "An error occurred in the database service",
                        DETAILS: errorData.details || null
                    });
                } else {
                    // Network or other error
                    console.error("Failed to retrieve coach information:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to retrieve coach information",
                        DETAILS: error.message
                    });
                }
            }
        });
        
        this.httpServer.app.put("/Coach/UpdateCoach", async (req, res) => {
            // Extract parameters from the request body
            const { EMAIL, NAME, PASSWORD } = req.body;
            
            // Validate required parameters
            if (!EMAIL) {
                return res.status(400).json({ 
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "EMAIL parameter is required" 
                });
            }

            // Validate that at least one update field is provided
            if (!NAME && !PASSWORD) {
                return res.status(400).json({
                    ERROR: "MISSING_UPDATE_FIELDS",
                    MESSAGE: "At least one field to update (NAME or PASSWORD) must be provided"
                });
            }

            // Validate email format
            if (!this.validateEmail(EMAIL)) {
                return res.status(400).json({ 
                    ERROR: "INVALID_EMAIL",
                    MESSAGE: "Invalid email format" 
                });
            }
            
            // Validate name if provided
            if (NAME && !this.validateName(NAME)) {
                return res.status(400).json({
                    ERROR: "INVALID_NAME",
                    MESSAGE: "Name cannot be empty"
                });
            }
            
            // Validate password if provided
            if (PASSWORD && !this.validatePassword(PASSWORD)) {
                return res.status(400).json({
                    ERROR: "INVALID_PASSWORD",
                    MESSAGE: "Password must be at least 6 characters long"
                });
            }
            
            try {
                // Update coach information in the PostgreSQL service
                const updateResult = await this.updateCoachInDB(EMAIL, NAME, PASSWORD);
                
                // Return success response
                return res.status(200).json({
                    STATUS: "SUCCESS",
                    MESSAGE: "Coach information updated successfully",
                    COACH: {
                        COACH_ID: updateResult.coach.ID,
                        COACH_NAME: updateResult.coach.NAME,
                        COACH_EMAIL: updateResult.coach.EMAIL,
                        CREATED_AT: updateResult.coach.CREATED_AT,
                        UPDATED_AT: updateResult.coach.UPDATED_AT
                    }
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;
                    
                    if (statusCode === 404) {
                        return res.status(404).json({
                            ERROR: "COACH_NOT_FOUND",
                            MESSAGE: "No coach found with the specified email"
                        });
                    }
                    
                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.message || "An error occurred in the database service",
                        DETAILS: errorData.details || null
                    });
                } else {
                    // Network or other error
                    console.error("Failed to update coach information:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to update coach information",
                        DETAILS: error.message
                    });
                }
            }
        });

        this.httpServer.app.post("/Coach/CheckCredential", async (req, res) => {
            // Extract parameters from the request body
            const { EMAIL, PASSWORD } = req.body;
            
            // Validate required parameters
            if (!EMAIL || !PASSWORD) {
                return res.status(400).json({ 
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "EMAIL and PASSWORD are required" 
                });
            }

            // Validate email format
            if (!this.validateEmail(EMAIL)) {
                return res.status(400).json({ 
                    ERROR: "INVALID_EMAIL",
                    MESSAGE: "Invalid email format" 
                });
            }
            
            // Validate password
            if (!this.validatePassword(PASSWORD)) {
                return res.status(400).json({
                    ERROR: "INVALID_PASSWORD",
                    MESSAGE: "Password must be at least 6 characters long"
                });
            }
            
            try {
                // Check coach credentials with the PostgreSQL service
                const credentialCheckResult = await this.checkCoachCredentials(EMAIL, PASSWORD);
                
                // Return success response
                return res.status(200).json({
                    STATUS: credentialCheckResult.STATUS
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;
                    
                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.message || "An error occurred in the database service",
                        DETAILS: errorData.details || null
                    });
                } else {
                    // Network or other error
                    console.error("Failed to check coach credentials:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to check coach credentials",
                        DETAILS: error.message
                    });
                }
            }
        });

    }

    async startService() {
        await this.messageQueue.InitializeConnection();
        // await this.messageQueue.AddQueueAndMapToCallback("queue1", this.fun1.bind(this));
        await this.messageQueue.StartListeningToQueue();

        await this.ConfigureAPIRoutes();
        await this.httpServer.run_app();
    }
}

async function start_service() {
    const service = new Service('127.0.0.1', 18000);
    await service.startService();
}

start_service().catch(error => {
    console.error("Error starting service:", error);
});
