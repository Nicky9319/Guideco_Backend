const express = require('express');
const http = require('http');
const amqp = require('amqplib');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const serviceTemplatesPath = path.join(__dirname, '../ServiceTemplates/Basic');

const MessageQueue = require(`${serviceTemplatesPath}/MESSAGE_QUEUE.js`);
const HTTPServer = require(`${serviceTemplatesPath}/HTTP_SERVER.js`);
const WebSocketServer = require(`${serviceTemplatesPath}/WS_SERVER.js`);


class Service {
    constructor(wsServerHost, wsServerPort, httpServerHost, httpServerPort, apiServerHost, apiServerPort) {
        this.messageQueue = new MessageQueue("amqp://guest:guest@localhost/", "/");
        this.apiServer = new HTTPServer(apiServerHost, apiServerPort);
        this.httpServer = new HTTPServer(httpServerHost, httpServerPort);
        this.wsServer = new WebSocketServer(wsServerHost, wsServerPort);

        this.loadServiceUrls();

        this.Connectedusers = {};
        this.ConnectedCoaches = {};
    }

    /**
     * Loads service URLs from the service URLs JSON file
     */
    loadServiceUrls() {
        try {
            const serviceUrlsPath = path.join(__dirname, '../serviceURLs.json');
            if (fs.existsSync(serviceUrlsPath)) {
                const serviceUrls = JSON.parse(fs.readFileSync(serviceUrlsPath, 'utf8'));
                this.postgresServiceUrl = serviceUrls.postgresService || 'http://127.0.0.1:20000';
            } else {
                console.warn("Service URLs file not found. Using default URLs.");
                this.postgresServiceUrl = 'http://127.0.0.1:20000';
            }
        } catch (error) {
            console.error("Error loading service URLs:", error);
            this.postgresServiceUrl = 'http://127.0.0.1:20000'; // Default fallback
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
     * Validates if a value is a UUID
     * @param {string} id - ID to validate
     * @returns {boolean} - True if ID is a valid UUID, false otherwise
     */
    validateUUID(id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
    }

    /**
     * Formats a chat message for consistent API response
     * @param {Array} messages - Array of message objects
     * @returns {Array} - Formatted message data
     */
    formatChatMessages(messages) {
        return messages.map(message => ({
            SENDER: message.SENDER,
            MESSAGE: message.MESSAGE,
            TIMESTAMP: message.TIMESTAMP,
            FLAG: message.FLAG,
            TYPE: message.TYPE
        }));
    }

    /**
     * Fetches all chat messages between a user and a coach from the PostgreSQL service
     * @param {string} userEmail - Email of the user
     * @param {string} coachId - ID of the coach
     * @returns {Promise<Object>} - Chat messages data
     */
    async fetchAllMessagesFromDB(userEmail, coachId) {
        try {
            const response = await axios.get(`${this.postgresServiceUrl}/Chat/GetAllMessages`, {
                params: {
                    USER_EMAIL: userEmail,
                    COACH_ID: coachId
                }
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching chat messages from DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Fetches paginated chat messages between a user and a coach from the PostgreSQL service
     * @param {string} userEmail - Email of the user
     * @param {string} coachId - ID of the coach
     * @param {number} limit - Maximum number of messages to return (optional)
     * @param {string} timestamp - Optional timestamp to filter results by
     * @returns {Promise<Object>} - Paginated chat messages data
     */
    async fetchPaginatedMessagesFromDB(userEmail, coachId, limit = 10, timestamp = null) {
        try {
            const params = {
                USER_EMAIL: userEmail,
                COACH_ID: coachId,
                LIMIT: limit
            };

            // Only add timestamp parameter if it's provided
            if (timestamp) {
                params.TIMESTAMP = timestamp;
            }

            const response = await axios.get(`${this.postgresServiceUrl}/Chat/GetPaginatedMessages`, {
                params: params
            });
            return response.data;
        } catch (error) {
            console.error("Error fetching paginated messages from DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Stores a chat message in the database via API call to PostgreSQL service
     * @param {string} userId - ID of the user
     * @param {string} coachId - ID of the coach
     * @param {string} message - Message content
     * @param {string} type - Message type (default: 'TEXT')
     * @param {string} sender - Message sender ('USER' or 'COACH')
     * @param {string|Date|null} timestamp - Optional timestamp for the message
     * @returns {Promise<Object>} - Response from the database service
     */
    async storeMessageInDB(userId, coachId, message, type = 'TEXT', sender, timestamp = null) {
        try {
            const requestBody = {
                USER_ID: userId,
                COACH_ID: coachId,
                MESSAGE: message,
                TYPE: type,
                SENDER: sender
            };

            // Add timestamp if provided
            if (timestamp) {
                requestBody.TIMESTAMP = timestamp;
            }

            const response = await axios.post(`${this.postgresServiceUrl}/Chat/StoreMessage`, requestBody);
            return response.data;
        } catch (error) {
            console.error("Error storing message in DB:", error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Checks if a coach is connected to the WebSocket server
     * @param {string} coachId - ID of the coach
     * @returns {boolean} - True if coach is connected, false otherwise
     */
    isCoachConnected(coachId) {
        return Boolean(this.ConnectedCoaches[coachId]);
    }

    /**
     * Checks if a user is connected to the WebSocket server
     * @param {string} userId - ID of the user
     * @returns {boolean} - True if user is connected, false otherwise
     */
    isUserConnected(userId) {
        return Boolean(this.Connectedusers[userId]);
    }

    /**
     * Publishes a notification to the message queue for offline recipients
     * @param {string} recipientType - Type of recipient ('USER' or 'COACH')
     * @param {string} recipientId - ID of the recipient
     * @param {Object} messageData - Message data
     * @returns {Promise<void>}
     */
    async publishNotification(recipientType, recipientId, messageData) {
        try {
            const isUserRecipient = recipientType === 'USER';
            const notificationData = {
                NOTIFICATION_TYPE: 'NEW_MESSAGE',
                RECIPIENT_TYPE: recipientType,
                RECIPIENT_ID: recipientId,
                SENDER_ID: isUserRecipient ? messageData.COACH_ID : messageData.USER_ID,
                SENDER_TYPE: isUserRecipient ? 'COACH' : 'USER',
                MESSAGE: messageData.MESSAGE,
                MESSAGE_PREVIEW: messageData.MESSAGE.substring(0, 50) + (messageData.MESSAGE.length > 50 ? '...' : ''),
                TIMESTAMP: messageData.TIMESTAMP || new Date().toISOString(),
                MESSAGE_ID: messageData.MESSAGE_ID || messageData.ID
            };
            
            await this.messageQueue.PublishMessage('NOTIFICATION_SERVICE_EXCHANGE','NSE_CHAT_SERVICE', JSON.stringify(notificationData));
            console.log(`Notification published to message queue for ${recipientType.toLowerCase()} ${recipientId}`);
            return true;
        } catch (error) {
            console.error(`Error publishing ${recipientType.toLowerCase()} notification:`, error);
            return false;
        }
    }

    /**
     * Sends a message to a coach, or publishes a notification if coach is offline
     * @param {string} coachId - ID of the coach
     * @param {Object} messageData - Message data to send
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    async sendDirectMessageToCoach(coachId, messageData) {
        try {
            if (!this.isCoachConnected(coachId)) {
                return await this.publishNotification('COACH', coachId, messageData);
            }
            
            const socketId = this.ConnectedCoaches[coachId];
            this.wsServer.sio.to(socketId).emit('MESSAGE_FROM_USER', messageData);
            console.log(`Message sent directly to coach ${coachId} via WebSocket`);
            return true;
        } catch (error) {
            console.error(`Error sending message to coach ${coachId}:`, error);
            return false;
        }
    }

    /**
     * Sends a message to a user, or publishes a notification if user is offline
     * @param {string} userId - ID of the user
     * @param {Object} messageData - Message data to send
     * @returns {Promise<boolean>} - True if successful, false otherwise
     */
    async sendDirectMessageToUser(userId, messageData) {
        try {
            if (!this.isUserConnected(userId)) {
                return await this.publishNotification('USER', userId, messageData);
            }
            
            const socketId = this.Connectedusers[userId];
            this.wsServer.sio.to(socketId).emit('MESSAGE_FROM_COACH', messageData);
            console.log(`Message sent directly to user ${userId} via WebSocket`);
            return true;
        } catch (error) {
            console.error(`Error sending message to user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Handles sending messages to coaches and notifications for offline coaches
     * @param {string} coachId - ID of the coach
     * @param {string} userId - ID of the user sending the message
     * @param {string} message - Message content
     * @param {string} type - Message type
     * @param {Date|string} timestamp - Message timestamp
     * @param {string} messageId - ID of the stored message
     * @returns {Promise<void>}
     */
    async sendNotificationToCoach(coachId, userId, message, type = 'TEXT', timestamp = null, messageId = null) {
        try {
            // If no parameters provided, log and return
            if (!coachId || !userId || !message) {
                console.log("Incomplete message data for sendNotificationToCoach, skipping");
                return;
            }
            
            const messageData = {
                USER_ID: userId,
                COACH_ID: coachId,
                MESSAGE: message,
                TYPE: type,
                TIMESTAMP: timestamp || new Date(),
                ID: messageId,
                SENDER: 'USER'
            };
            
            // If coach is not connected, send notification
            if (!this.isCoachConnected(coachId)) {
                await this.publishNotification('COACH', coachId, messageData);
                console.log(`Coach ${coachId} is offline, notification sent`);
            } else {
                console.log(`Coach ${coachId} is online, message already sent via WebSocket`);
            }
        } catch (error) {
            console.error("Error in sendNotificationToCoach:", error);
        }
    }

    /**
     * Handles sending messages to users and notifications for offline users
     * @param {string} userId - ID of the user
     * @param {string} coachId - ID of the coach sending the message
     * @param {string} message - Message content
     * @param {string} type - Message type
     * @param {Date|string} timestamp - Message timestamp
     * @param {string} messageId - ID of the stored message
     * @returns {Promise<void>}
     */
    async sendNotificationToUser(userId, coachId, message, type = 'TEXT', timestamp = null, messageId = null) {
        try {
            // If no parameters provided, log and return
            if (!userId || !coachId || !message) {
                console.log("Incomplete message data for sendMessageToUser, skipping");
                return;
            }
            
            const messageData = {
                USER_ID: userId,
                COACH_ID: coachId,
                MESSAGE: message,
                TYPE: type,
                TIMESTAMP: timestamp || new Date(),
                ID: messageId,
                SENDER: 'COACH'
            };
            
            // If user is connected, the WebSocket event was already emitted
            // If not connected, publish to notification queue
            if (!this.isUserConnected(userId)) {
                await this.publishNotification('USER', userId, messageData);
                console.log(`User ${userId} is offline, notification sent`);
            } else {
                console.log(`User ${userId} is online, message already sent via WebSocket`);
            }
        } catch (error) {
            console.error("Error in sendMessageToUser:", error);
        }
    }

    async ConfigureAPIRoutes() {
        this.apiServer.app.use(express.json());

        this.apiServer.app.get("/Chat/GetAllMessages", async (req, res) => {
            // Extract parameters from the query parameters
            const { USER_EMAIL, COACH_ID } = req.query;

            // Validate required parameters
            if (!USER_EMAIL) {
                return res.status(400).json({
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "USER_EMAIL is required"
                });
            }

            if (!COACH_ID) {
                return res.status(400).json({
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "COACH_ID is required"
                });
            }

            // Validate email format
            if (!this.validateEmail(USER_EMAIL)) {
                return res.status(400).json({
                    ERROR: "INVALID_EMAIL",
                    MESSAGE: "Invalid email format"
                });
            }

            // Validate UUID format for COACH_ID
            if (!this.validateUUID(COACH_ID)) {
                return res.status(400).json({
                    ERROR: "INVALID_COACH_ID",
                    MESSAGE: "COACH_ID must be a valid UUID"
                });
            }

            try {
                // Fetch all messages from the PostgreSQL service
                const messagesData = await this.fetchAllMessagesFromDB(USER_EMAIL, COACH_ID);

                if (!messagesData || !messagesData.MESSAGES) {
                    return res.status(500).json({
                        ERROR: "UNEXPECTED_RESPONSE",
                        MESSAGE: "Unexpected response format from database service"
                    });
                }

                // Format the messages for consistent API response
                const formattedMessages = this.formatChatMessages(messagesData.MESSAGES);

                // Return success response
                return res.status(200).json({
                    MESSAGES: formattedMessages,
                    COUNT: formattedMessages.length,
                    USER_ID: messagesData.USER_ID,
                    COACH_ID: messagesData.COACH_ID
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    // Error response from the PostgreSQL service
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;

                    if (statusCode === 404) {
                        if (errorData.ERROR === "User not found") {
                            return res.status(404).json({
                                ERROR: "USER_NOT_FOUND",
                                MESSAGE: "The specified user email does not exist"
                            });
                        } else if (errorData.ERROR === "Coach not found") {
                            return res.status(404).json({
                                ERROR: "COACH_NOT_FOUND",
                                MESSAGE: "The specified coach ID does not exist"
                            });
                        }
                    }

                    return res.status(statusCode).json({
                        ERROR: errorData.ERROR || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.MESSAGE || "An error occurred in the database service",
                        DETAILS: errorData.DETAILS || null
                    });
                } else {
                    // Network or other error
                    console.error("Failed to retrieve chat messages:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to retrieve chat messages",
                        DETAILS: error.message
                    });
                }
            }
        });

        this.apiServer.app.get("/Chat/GetPaginatedMessages", async (req, res) => {
            // Extract parameters from the query parameters
            const { USER_EMAIL, COACH_ID, LIMIT, TIMESTAMP } = req.query;

            // Validate required parameters
            if (!USER_EMAIL) {
                return res.status(400).json({
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "USER_EMAIL is required"
                });
            }

            if (!COACH_ID) {
                return res.status(400).json({
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "COACH_ID is required"
                });
            }

            // Validate email format
            if (!this.validateEmail(USER_EMAIL)) {
                return res.status(400).json({
                    ERROR: "INVALID_EMAIL",
                    MESSAGE: "Invalid email format"
                });
            }

            // Validate UUID format for COACH_ID
            if (!this.validateUUID(COACH_ID)) {
                return res.status(400).json({
                    ERROR: "INVALID_COACH_ID",
                    MESSAGE: "COACH_ID must be a valid UUID"
                });
            }

            // Validate limit parameter
            const parsedLimit = LIMIT ? parseInt(LIMIT) : 10;
            if (isNaN(parsedLimit) || parsedLimit <= 0) {
                return res.status(400).json({
                    ERROR: "INVALID_LIMIT",
                    MESSAGE: "LIMIT must be a positive number"
                });
            }

            // Validate timestamp parameter
            if (TIMESTAMP && isNaN(Date.parse(TIMESTAMP))) {
                return res.status(400).json({
                    ERROR: "INVALID_TIMESTAMP",
                    MESSAGE: "TIMESTAMP must be a valid date string"
                });
            }

            try {
                // Fetch paginated messages from the PostgreSQL service
                const messagesData = await this.fetchPaginatedMessagesFromDB(USER_EMAIL, COACH_ID, parsedLimit, TIMESTAMP);

                if (!messagesData || !messagesData.MESSAGES) {
                    return res.status(500).json({
                        ERROR: "UNEXPECTED_RESPONSE",
                        MESSAGE: "Unexpected response format from database service"
                    });
                }

                // Format the messages for consistent API response
                const formattedMessages = this.formatChatMessages(messagesData.MESSAGES);

                // Return success response
                return res.status(200).json({
                    MESSAGES: formattedMessages,
                    COUNT: formattedMessages.length,
                    USER_ID: messagesData.USER_ID,
                    COACH_ID: messagesData.COACH_ID,
                    HAS_MORE: messagesData.HAS_MORE,
                    NEXT_TIMESTAMP: messagesData.NEXT_TIMESTAMP
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    // Error response from the PostgreSQL service
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;

                    if (statusCode === 404) {
                        if (errorData.ERROR === "User not found") {
                            return res.status(404).json({
                                ERROR: "USER_NOT_FOUND",
                                MESSAGE: "The specified user email does not exist"
                            });
                        } else if (errorData.ERROR === "Coach not found") {
                            return res.status(404).json({
                                ERROR: "COACH_NOT_FOUND",
                                MESSAGE: "The specified coach ID does not exist"
                            });
                        }
                    }

                    return res.status(statusCode).json({
                        ERROR: errorData.ERROR || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.MESSAGE || "An error occurred in the database service",
                        DETAILS: errorData.DETAILS || null
                    });
                } else {
                    // Network or other error
                    console.error("Failed to retrieve paginated messages:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to retrieve paginated messages",
                        DETAILS: error.message
                    });
                }
            }
        });

    }


    async ConfigureHTTPRoutes() {
        this.httpServer.app.use(express.json());

        this.httpServer.app.post("/User/SendMessageToCoach", async (req, res) => {
            const { USER_ID, COACH_ID, MESSAGE, SENDER, TYPE, TIMESTAMP } = req.body;

            // Validate required parameters
            if (!USER_ID || !COACH_ID || !MESSAGE) {
                return res.status(400).json({
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "USER_ID, COACH_ID, and MESSAGE are required"
                });
            }

            // Validate UUID format
            if (!this.validateUUID(USER_ID)) {
                return res.status(400).json({
                    ERROR: "INVALID_USER_ID",
                    MESSAGE: "USER_ID must be a valid UUID"
                });
            }

            if (!this.validateUUID(COACH_ID)) {
                return res.status(400).json({
                    ERROR: "INVALID_COACH_ID",
                    MESSAGE: "COACH_ID must be a valid UUID"
                });
            }

            try {
                // Store message in database
                const messageData = await this.storeMessageInDB(
                    USER_ID,
                    COACH_ID,
                    MESSAGE,
                    TYPE || 'TEXT',
                    'USER', // Always 'USER' for this endpoint
                    TIMESTAMP
                );

                // Prepare the message data object
                const msgData = {
                    USER_ID,
                    COACH_ID,
                    MESSAGE,
                    TYPE: TYPE || 'TEXT',
                    TIMESTAMP: TIMESTAMP || new Date(),
                    SENDER: 'USER',
                    MESSAGE_ID: messageData.ID
                };

                // Check if coach is connected and send direct message or notification
                if (this.isCoachConnected(COACH_ID)) {
                    // Send direct message via WebSocket
                    await this.sendDirectMessageToCoach(COACH_ID, msgData);
                } else {
                    // Send notification if coach is offline
                    await this.sendNotificationToCoach(COACH_ID, USER_ID, MESSAGE, TYPE || 'TEXT', TIMESTAMP || new Date(), messageData.ID);
                }

                return res.status(201).json({
                    SUCCESS: true,
                    MESSAGE: "MESSAGE_RECEIVED_SUCCEFULLY",
                    MESSAGE_ID: messageData.ID
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;

                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.details || "An error occurred in the database service"
                    });
                } else {
                    console.error("Failed to send message:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to send message",
                        DETAILS: error.message
                    });
                }
            }
        });

        this.httpServer.app.post("/Coach/SendMessageToUser", async (req, res) => {
            const { USER_ID, COACH_ID, MESSAGE, SENDER, TYPE } = req.body;

            // Validate required parameters
            if (!USER_ID || !COACH_ID || !MESSAGE) {
                return res.status(400).json({
                    ERROR: "MISSING_PARAMETERS",
                    MESSAGE: "USER_ID, COACH_ID, and MESSAGE are required"
                });
            }

            // Validate UUID format
            if (!this.validateUUID(USER_ID)) {
                return res.status(400).json({
                    ERROR: "INVALID_USER_ID",
                    MESSAGE: "USER_ID must be a valid UUID"
                });
            }

            if (!this.validateUUID(COACH_ID)) {
                return res.status(400).json({
                    ERROR: "INVALID_COACH_ID",
                    MESSAGE: "COACH_ID must be a valid UUID"
                });
            }

            try {
                // Store message in database
                const messageData = await this.storeMessageInDB(
                    USER_ID,
                    COACH_ID,
                    MESSAGE,
                    TYPE || 'TEXT',
                    'COACH', // Always 'COACH' for this endpoint
                    null // Use current timestamp
                );

                // Prepare the message data object
                const msgData = {
                    USER_ID,
                    COACH_ID,
                    MESSAGE,
                    TYPE: TYPE || 'TEXT',
                    TIMESTAMP: new Date(),
                    SENDER: 'COACH',
                    MESSAGE_ID: messageData.ID
                };

                // Check if user is connected and send direct message or notification
                if (this.isUserConnected(USER_ID)) {
                    // Send direct message via WebSocket
                    await this.sendDirectMessageToUser(USER_ID, msgData);
                } else {
                    // Send notification if user is offline
                    await this.sendNotificationToUser(USER_ID, COACH_ID, MESSAGE, TYPE || 'TEXT', new Date(), messageData.ID);
                }

                return res.status(201).json({
                    SUCCESS: true,
                    MESSAGE: "MESSAGE_RECEIVED_SUCCEFULLY",
                    MESSAGE_ID: messageData.ID
                });
            } catch (error) {
                // Handle specific error cases
                if (error.response) {
                    const statusCode = error.response.status || 500;
                    const errorData = error.response.data;

                    return res.status(statusCode).json({
                        ERROR: errorData.error || "DATABASE_SERVICE_ERROR",
                        MESSAGE: errorData.details || "An error occurred in the database service"
                    });
                } else {
                    console.error("Failed to send message:", error);
                    return res.status(500).json({
                        ERROR: "SERVICE_ERROR",
                        MESSAGE: "Failed to send message",
                        DETAILS: error.message
                    });
                }
            }
        });
    }

    async configureWSserverMethods() {
        this.wsServer.sio.on('connection', async (socket) => {
            console.log(`A New User with ID ${socket.id} Connected`);
            console.log(socket.handshake.auth);

            const authToken = socket.handshake.auth;


            if (authToken.PERSONA == "USER") {
                this.Connectedusers[authToken.USER_ID] = socket.id;
                console.log(this.Connectedusers)
            } else if (authToken.PERSONA == "COACH") {
                this.ConnectedCoaches[authToken.COACH_ID] = socket.id;
            } else {
                console.log("Invalid Persona");
            }



            socket.on('disconnect', () => {
                const userId = Object.keys(this.Connectedusers).find(key => this.Connectedusers[key] === socket.id);
                const coachId = Object.keys(this.ConnectedCoaches).find(key => this.ConnectedCoaches[key] === socket.id);

                if (userId) {
                    delete this.Connectedusers[userId];
                    console.log(`User with ID ${userId} disconnected`);
                } else if (coachId) {
                    delete this.ConnectedCoaches[coachId];
                    console.log(`Coach with ID ${coachId} disconnected`);
                } else {
                    console.log(`Socket with ID ${socket.id} disconnected but was not found in user or coach lists`);
                }
            });



            socket.on('SEND_MESSAGE_TO_COACH', async (data, callback) => {
                const { USER_ID, COACH_ID, MESSAGE, SENDER, TYPE, TIMESTAMP } = data;

                // Validate required parameters
                if (!USER_ID || !COACH_ID || !MESSAGE) {
                    if (callback) {
                        callback({
                            SUCCESS: false,
                            ERROR: "MISSING_PARAMETERS",
                            MESSAGE: "USER_ID, COACH_ID, and MESSAGE are required"
                        });
                    }
                    return;
                }

                try {
                    // Store message in database
                    const messageData = await this.storeMessageInDB(
                        USER_ID,
                        COACH_ID,
                        MESSAGE,
                        TYPE || 'TEXT',
                        'USER', // Always 'USER' for this event
                        TIMESTAMP || null
                    );

                    // Prepare the message data object
                    const msgData = {
                        USER_ID,
                        COACH_ID,
                        MESSAGE,
                        TYPE: TYPE || 'TEXT',
                        TIMESTAMP: TIMESTAMP || new Date(),
                        SENDER: 'USER',
                        MESSAGE_ID: messageData.ID
                    };

                    // Check if coach is connected and send direct message or notification
                    if (this.isCoachConnected(COACH_ID)) {
                        // Send direct message via WebSocket
                        await this.sendDirectMessageToCoach(COACH_ID, msgData);
                    } else {
                        // Send notification if coach is offline
                        await this.sendNotificationToCoach(COACH_ID, USER_ID, MESSAGE, TYPE || 'TEXT', TIMESTAMP || new Date(), messageData.ID);
                    }

                    // Call callback if provided
                    if (callback) {
                        callback({
                            SUCCESS: true,
                            MESSAGE: "MESSAGE_RECEIVED_SUCCEFULLY",
                            MESSAGE_ID: messageData.ID
                        });
                    }
                } catch (error) {
                    console.error("Error sending message to coach:", error);
                    if (callback) {
                        callback({
                            SUCCESS: false,
                            ERROR: "FAILED_TO_SEND",
                            MESSAGE: "Failed to send message",
                            DETAILS: error.message
                        });
                    }
                }
            });

            socket.on('SEND_MESSAGE_TO_USER', async (data, callback) => {
                const { USER_ID, COACH_ID, MESSAGE, TYPE } = data;

                // Validate required parameters
                if (!USER_ID || !COACH_ID || !MESSAGE) {
                    if (callback) {
                        callback({
                            SUCCESS: false,
                            ERROR: "MISSING_PARAMETERS",
                            MESSAGE: "USER_ID, COACH_ID, and MESSAGE are required"
                        });
                    }
                    return;
                }

                try {
                    // Store message in database
                    const messageData = await this.storeMessageInDB(
                        USER_ID,
                        COACH_ID,
                        MESSAGE,
                        TYPE || 'TEXT',
                        'COACH', // Always 'COACH' for this event
                        null // Use current timestamp
                    );

                    // Prepare the message data object
                    const msgData = {
                        USER_ID,
                        COACH_ID,
                        MESSAGE,
                        TYPE: TYPE || 'TEXT',
                        TIMESTAMP: new Date(),
                        SENDER: 'COACH',
                        MESSAGE_ID: messageData.ID
                    };

                    // Check if user is connected and send direct message or notification
                    if (this.isUserConnected(USER_ID)) {
                        // Send direct message via WebSocket
                        await this.sendDirectMessageToUser(USER_ID, msgData);
                    } else {
                        // Send notification if user is offline
                        await this.sendNotificationToUser(USER_ID, COACH_ID, MESSAGE, TYPE || 'TEXT', new Date(), messageData.ID);
                    }

                    // Call callback if provided
                    if (callback) {
                        callback({
                            SUCCESS: true,
                            MESSAGE: "MESSAGE_RECEIVED_SUCCEFULLY",
                            MESSAGE_ID: messageData.ID
                        });
                    }
                } catch (error) {
                    console.error("Error sending message to user:", error);
                    if (callback) {
                        callback({
                            SUCCESS: false,
                            ERROR: "FAILED_TO_SEND",
                            MESSAGE: "Failed to send message",
                            DETAILS: error.message
                        });
                    }
                }
            });

        });
    };


    async startService() {
        await this.messageQueue.InitializeConnection();
        // await this.messageQueue.AddQueueAndMapToCallback("queue1", this.fun1.bind(this));
        await this.messageQueue.StartListeningToQueue();

        await this.wsServer.start();  // Start WS server before configuring methods
        await this.configureWSserverMethods();

        await this.ConfigureHTTPRoutes();
        const apiServerPromise = this.apiServer.run_app();

        await this.ConfigureAPIRoutes();
        await this.httpServer.run_app();
    }
}


async function start_service() {
    const service = new Service('0.0.0.0', 8000, '0.0.0.0', 8001, '127.0.0.1', 14000);
    await service.startService();
}

start_service().catch(error => {
    console.error("Error starting service:", error);
});
