const express = require('express');
const http = require('http');
const amqp = require('amqplib');
const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const serviceTemplatesPath = path.join(__dirname, '../ServiceTemplates/Basic');

const MessageQueue = require(`${serviceTemplatesPath}/MESSAGE_QUEUE.js`);
const HTTPServer = require(`${serviceTemplatesPath}/HTTP_SERVER.js`);


class Service {
    constructor(httpServerHost, httpServerPort) {
        this.messageQueue = new MessageQueue("amqp://guest:guest@localhost/", "/");
        this.httpServer = new HTTPServer(httpServerHost, httpServerPort);
        this.initFirebase();
        this.loadServiceURLs();
    }

    loadServiceURLs() {
        try {
            const servicesPath = path.join(__dirname, '../ServiceURLMapping.json');
            console.log("Loading service URLs from:", servicesPath);
            this.serviceURLs = JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
            console.log("Service URLs loaded successfully:", Object.keys(this.serviceURLs));
        } catch (error) {
            console.error("Failed to load service URLs:", error);
            const defaultServiceURLsPath = path.join(__dirname, '../ServiceURLMapping.json');
            console.log(defaultServiceURLsPath)
            if (fs.existsSync(defaultServiceURLsPath)) {
                this.serviceURLs = JSON.parse(fs.readFileSync(defaultServiceURLsPath, 'utf8'));
            } else {
                this.serviceURLs = {
                    "POSTGRES_DATABASE_SERVICE": "127.0.0.1:20000"
                };
            }
            console.log("Using default service URLs:", this.serviceURLs);
        }
    }

    initFirebase() {
        try {
            const serviceAccountPath = path.join(__dirname, 'guide-co-firebase-account-setup.json');
            console.log("Loading Firebase credentials from:", serviceAccountPath);
            const serviceAccount = require(serviceAccountPath);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });

            console.log("Firebase Admin SDK initialized successfully");
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            throw new Error(`Firebase initialization failed: ${error.message}`);
        }
    }

    async verifyFirebaseToken(idToken) {
        try {
            console.log("Verifying Firebase ID token...");
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            console.log("✅ Firebase token verification successful");
            return {
                isValid: true,
                decodedToken
            };
        } catch (error) {
            console.error("❌ Firebase token verification failed:", error.message);
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    async checkUserExists(email) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Checking if user exists: ${email} (calling ${dbServiceURL})`);
            const response = await axios.get(`http://${dbServiceURL}/User/Check`, {
                params: { EMAIL: email }
            });
            console.log("User check response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error checking if user exists:", error);
            throw new Error(`Failed to check user: ${error.message}`);
        }
    }

    async createUser(userData) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Creating new user: ${userData.EMAIL} (calling ${dbServiceURL})`);
            const response = await axios.post(`http://${dbServiceURL}/User/Create`, {
                EMAIL: userData.EMAIL,
                NAME: userData.USERNAME || userData.EMAIL.split('@')[0]
            });
            console.log("User creation response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error creating user:", error);
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }

    async mapDeviceToUser(deviceId, email) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Mapping device ${deviceId} to user ${email} (calling ${dbServiceURL})`);
            const response = await axios.post(`http://${dbServiceURL}/Device/Map/User`, {
                DEVICE_ID: deviceId,
                EMAIL: email
            });
            console.log("Device mapping response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error mapping device to user:", error);
            throw new Error(`Failed to map device: ${error.message}`);
        }
    }

    async mapDeviceToCoach(deviceId, email) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Mapping device ${deviceId} to coach ${email} (calling ${dbServiceURL})`);
            const response = await axios.post(`http://${dbServiceURL}/Device/Map/Coach`, {
                DEVICE_ID: deviceId,
                EMAIL: email
            });
            console.log("Device mapping response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error mapping device to coach:", error);
            throw new Error(`Failed to map device: ${error.message}`);
        }
    }

    async removeDeviceMapping(deviceId, email, accountType = 'USER') {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            const endpoint = accountType.toUpperCase() === 'COACH' ? 
                'Device/Map/Coach' : 'Device/Map/User';
                
            console.log(`Removing mapping for device ${deviceId} from ${accountType} ${email} (calling ${dbServiceURL})`);
            const response = await axios.delete(`http://${dbServiceURL}/${endpoint}`, {
                data: {
                    DEVICE_ID: deviceId,
                    EMAIL: email
                }
            });
            console.log("Device unmapping response:", response.data);
            return response.data;
        } catch (error) {
            // If mapping doesn't exist, this is not a critical error
            if (error.response && error.response.status === 404) {
                console.log("No existing device mapping found to remove");
                return { message: "No existing mapping found" };
            }
            console.error("Error removing device mapping:", error);
            throw new Error(`Failed to remove device mapping: ${error.message}`);
        }
    }

    async registerDeviceToken(deviceId, fcmToken) {
        try {
            if (!deviceId || !fcmToken) {
                throw new Error("Device ID and FCM token are required");
            }

            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Registering device token for ${deviceId} (calling ${dbServiceURL})`);
            const response = await axios.post(`http://${dbServiceURL}/Device/Register`, {
                DEVICE_ID: deviceId,
                FCM_TOKEN: fcmToken
            });
            console.log("Device registration response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error registering device token:", error);
            throw new Error(`Failed to register device token: ${error.message}`);
        }
    }

    async removeAllDeviceMappingsForDevice(deviceId) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Removing all existing mappings for device ${deviceId} (calling ${dbServiceURL})`);
            const response = await axios.delete(`http://${dbServiceURL}/Device/Map/RemoveAll`, {
                data: {
                    DEVICE_ID: deviceId
                }
            });
            console.log("Device all mappings removal response:", response.data);
            return response.data;
        } catch (error) {
            // If mapping doesn't exist, this is not a critical error
            if (error.response && error.response.status === 404) {
                console.log("No existing device mappings found to remove");
                return { message: "No existing mappings found" };
            }
            console.error("Error removing all device mappings:", error);
            throw new Error(`Failed to remove all device mappings: ${error.message}`);
        }
    }

    async handleUserDeviceMapping(email, deviceId) {
        try {
            console.log(`Starting user device mapping process for email: ${email}, device: ${deviceId}`);

            // Remove an Existng Mapping for the Device to User Id by Providing Email
            const removeMappingResult = await this.removeDeviceMapping(deviceId, email);
            console.log(`Existing user mapping removed: ${JSON.stringify(removeMappingResult)}`);
            
            // Create a mapping for the current user without removing existing ones
            const mappingResult = await this.mapDeviceToUser(deviceId, email);
            console.log(`User mapping created: ${JSON.stringify(mappingResult)}`);
            
            return {
                success: true,
                message: "Device successfully mapped to user account"
            };
        } catch (error) {
            console.error(`Error in handleUserDeviceMapping: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async handleCoachDeviceMapping(email, deviceId) {
        try {
            console.log(`Starting coach device mapping process for email: ${email}, device: ${deviceId}`);
            
            // Create a mapping for the current coach without removing existing ones
            const mappingResult = await this.mapDeviceToCoach(deviceId, email);
            console.log(`Coach mapping created: ${JSON.stringify(mappingResult)}`);
            
            return {
                success: true,
                message: "Device successfully mapped to coach account"
            };
        } catch (error) {
            console.error(`Error in handleCoachDeviceMapping: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async checkDeviceUserMapping(deviceId, email) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Checking if device ${deviceId} is mapped to user ${email} (calling ${dbServiceURL})`);
            const response = await axios.get(`http://${dbServiceURL}/Device/CheckMapping/User`, {
                params: { 
                    DEVICE_ID: deviceId,
                    EMAIL: email
                }
            });
            console.log("User device mapping check response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error checking user device mapping:", error);
            throw new Error(`Failed to check user device mapping: ${error.message}`);
        }
    }

    async checkDeviceCoachMapping(deviceId, email) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Checking if device ${deviceId} is mapped to coach ${email} (calling ${dbServiceURL})`);
            const response = await axios.get(`http://${dbServiceURL}/Device/CheckMapping/Coach`, {
                params: { 
                    DEVICE_ID: deviceId,
                    EMAIL: email
                }
            });
            console.log("Coach device mapping check response:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error checking coach device mapping:", error);
            throw new Error(`Failed to check coach device mapping: ${error.message}`);
        }
    }

    // Legacy method for backward compatibility
    async checkDeviceMapping(deviceId, email, accountType = 'USER') {
        if (accountType.toUpperCase() === 'COACH') {
            return this.checkDeviceCoachMapping(deviceId, email);
        } else {
            return this.checkDeviceUserMapping(deviceId, email);
        }
    }

    async checkIsCoach(email) {
        try {
            const dbServiceURL = this.serviceURLs["POSTGRES_DATABASE_SERVICE"];
            console.log(`Checking if ${email} is a coach (calling ${dbServiceURL})`);
            const response = await axios.get(`http://${dbServiceURL}/Coach/Info`, {
                params: { EMAIL: email }
            });
            console.log("Coach check response:", response.data);
            // If the request was successful and returned a coach, the email belongs to a coach
            return { isCoach: !!response.data.coach };
        } catch (error) {
            // If we get a 404, the email doesn't belong to a coach
            if (error.response && error.response.status === 404) {
                return { isCoach: false };
            }
            console.error("Error checking if email is for a coach:", error);
            throw new Error(`Failed to check if email is for a coach: ${error.message}`);
        }
    }

    // Configure the API route for the HTTP server.
    async ConfigureAPIRoutes() {
        this.httpServer.app.use(express.json());

        this.httpServer.app.post("/Auth/Google", async (req, res) => {
            console.log("Google Authentication endpoint called");
            try {
                const { ID_TOKEN, DEVICE_ID, FCM_TOKEN } = req.body;

                // Validate required fields
                if (!ID_TOKEN) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "ID_TOKEN field is required"
                    });
                }

                if (!DEVICE_ID) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "DEVICE_ID field is required"
                    });
                }

                // Step 1: Verify the Firebase token
                const tokenVerification = await this.verifyFirebaseToken(ID_TOKEN);

                if (!tokenVerification.isValid) {
                    return res.status(401).json({
                        SUCCESS: false,
                        ERROR: "INVALID_TOKEN",
                        MESSAGE: "Firebase token validation failed",
                        DETAILS: tokenVerification.error
                    });
                }

                const { decodedToken } = tokenVerification;
                const email = decodedToken.email;

                if (!email) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "MISSING_EMAIL",
                        MESSAGE: "Firebase token does not contain an email"
                    });
                }

                // Step 2: Check if the user is a coach
                let isCoach = false;
                try {
                    const coachCheck = await this.checkIsCoach(email);
                    isCoach = coachCheck.isCoach;
                    console.log(`Email ${email} is${isCoach ? '' : ' not'} a coach`);
                } catch (error) {
                    console.error("Error checking if user is coach:", error);
                    // Continue as regular user if coach check fails
                }

                // Step 3: Check if the user exists in the database
                let userExists;
                try {
                    userExists = await this.checkUserExists(email);
                } catch (error) {
                    return res.status(500).json({
                        SUCCESS: false,
                        ERROR: "DATABASE_ERROR",
                        MESSAGE: "Failed to check if user exists",
                        DETAILS: error.message
                    });
                }

                // Step 4: Create user if they don't exist
                if (!userExists.exists && !isCoach) {
                    try {
                        const userData = {
                            EMAIL: email,
                            USERNAME: decodedToken.name || email.split('@')[0]
                        };
                        const userCreation = await this.createUser(userData);
                        console.log("Created new user:", userCreation);
                    } catch (error) {
                        return res.status(500).json({
                            SUCCESS: false,
                            ERROR: "USER_CREATION_FAILED",
                            MESSAGE: "Failed to create new user account",
                            DETAILS: error.message
                        });
                    }
                }



                // Step 5: Handle device mapping with improved error reporting
                let mappingResult = { success: true };
                try {
                    console.log(`Handling device mapping for ${isCoach ? 'coach' : 'user'} ${email} and device ${DEVICE_ID}`);
                    
                    // Use separate endpoints based on account type without prior removal
                    if (isCoach) {
                        mappingResult = await this.handleCoachDeviceMapping(email, DEVICE_ID);
                    } else {
                        console.log("Handling user device mapping");
                        mappingResult = await this.handleUserDeviceMapping(email, DEVICE_ID);
                    }
                    
                    if (!mappingResult.success) {
                        console.warn("Device mapping completed with issues:", mappingResult);
                    } else {
                        console.log("Device mapping successful:", mappingResult);
                    }
                } catch (error) {
                    console.error("Failed to update device mapping:", error);
                    mappingResult = {
                        success: false,
                        error: error.message || "Unknown error during device mapping"
                    };
                    // Continue despite mapping failure - this is non-critical
                }

                // Step 6: Register FCM token if provided
                let deviceRegistration = { success: false };
                try {
                    if (FCM_TOKEN) {
                        console.log(`Registering FCM token for device ${DEVICE_ID}`);
                        const registrationResult = await this.registerDeviceToken(DEVICE_ID, FCM_TOKEN);
                        deviceRegistration = {
                            success: true,
                            message: "FCM token registered successfully"
                        };
                    } else {
                        deviceRegistration = {
                            success: false,
                            message: "No FCM token provided"
                        };
                    }
                } catch (error) {
                    console.error("Failed to register device token:", error);
                    deviceRegistration = {
                        success: false,
                        error: error.message || "Unknown error during device token registration"
                    };
                    // Continue despite registration failure - this is non-critical
                }

                // Step 7: Return successful response with mapping info
                return res.status(200).json({
                    SUCCESS: true,
                    MESSAGE: "Authentication successful",
                    USER: {
                        EMAIL: email,
                        IS_NEW_USER: !userExists.exists && !isCoach,
                        IS_COACH: isCoach
                    },
                    DEVICE_MAPPING: {
                        SUCCESS: mappingResult.success,
                        MESSAGE: mappingResult.message || mappingResult.error || "Device mapping status unknown"
                    },
                    DEVICE_REGISTRATION: {
                        SUCCESS: deviceRegistration.success,
                        MESSAGE: deviceRegistration.message || deviceRegistration.error || (FCM_TOKEN ? "FCM token registered" : "No FCM token provided")
                    }
                });
            } catch (error) {
                console.error("Unexpected error in Google Auth endpoint:", error);
                return res.status(500).json({
                    SUCCESS: false,
                    ERROR: "INTERNAL_SERVER_ERROR",
                    MESSAGE: "An unexpected error occurred during authentication",
                    DETAILS: error.message
                });
            }
        });

        this.httpServer.app.get("/Auth/CheckUserDeviceMapping", async (req, res) => {
            console.log("CheckUserDeviceMapping endpoint called");
            try {
                // Extract parameters from query string
                const { DEVICE_ID, EMAIL } = req.query;

                // Validate required fields
                if (!DEVICE_ID) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "DEVICE_ID parameter is required"
                    });
                }

                if (!EMAIL) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "EMAIL parameter is required"
                    });
                }

                // Check if the device is mapped to the user
                try {
                    const mappingResult = await this.checkDeviceUserMapping(DEVICE_ID, EMAIL);
                    
                    return res.status(200).json({
                        SUCCESS: true,
                        IS_MAPPED: mappingResult.isMapped || false,
                        ACCOUNT_TYPE: "USER",
                        MESSAGE: mappingResult.isMapped 
                            ? "Device is mapped to the specified user"
                            : "Device is not mapped to the specified user"
                    });
                } catch (error) {
                    return res.status(500).json({
                        SUCCESS: false,
                        ERROR: "DATABASE_ERROR",
                        MESSAGE: "Failed to check device mapping",
                        DETAILS: error.message
                    });
                }
            } catch (error) {
                console.error("Unexpected error in CheckUserDeviceMapping endpoint:", error);
                return res.status(500).json({
                    SUCCESS: false,
                    ERROR: "INTERNAL_SERVER_ERROR",
                    MESSAGE: "An unexpected error occurred while checking device mapping",
                    DETAILS: error.message
                });
            }
        });

        this.httpServer.app.get("/Auth/CheckCoachDeviceMapping", async (req, res) => {
            console.log("CheckCoachDeviceMapping endpoint called");
            try {
                // Extract parameters from query string
                const { DEVICE_ID, EMAIL } = req.query;

                // Validate required fields
                if (!DEVICE_ID) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "DEVICE_ID parameter is required"
                    });
                }

                if (!EMAIL) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "EMAIL parameter is required"
                    });
                }

                // Check if the device is mapped to the coach
                try {
                    const mappingResult = await this.checkDeviceCoachMapping(DEVICE_ID, EMAIL);
                    
                    return res.status(200).json({
                        SUCCESS: true,
                        IS_MAPPED: mappingResult.isMapped || false,
                        ACCOUNT_TYPE: "COACH",
                        MESSAGE: mappingResult.isMapped 
                            ? "Device is mapped to the specified coach"
                            : "Device is not mapped to the specified coach"
                    });
                } catch (error) {
                    return res.status(500).json({
                        SUCCESS: false,
                        ERROR: "DATABASE_ERROR",
                        MESSAGE: "Failed to check device mapping",
                        DETAILS: error.message
                    });
                }
            } catch (error) {
                console.error("Unexpected error in CheckCoachDeviceMapping endpoint:", error);
                return res.status(500).json({
                    SUCCESS: false,
                    ERROR: "INTERNAL_SERVER_ERROR",
                    MESSAGE: "An unexpected error occurred while checking device mapping",
                    DETAILS: error.message
                });
            }
        });

        // Backward compatibility endpoint
        this.httpServer.app.get("/Auth/CheckDeviceMapping", async (req, res) => {
            console.log("CheckDeviceMapping endpoint called (deprecated)");
            try {
                // Extract parameters from query string
                const { DEVICE_ID, EMAIL, ACCOUNT_TYPE = 'USER' } = req.query;

                // Validate required fields
                if (!DEVICE_ID) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "DEVICE_ID parameter is required"
                    });
                }

                if (!EMAIL) {
                    return res.status(400).json({
                        SUCCESS: false,
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "EMAIL parameter is required"
                    });
                }

                // Route to the appropriate method based on account type
                if (ACCOUNT_TYPE.toUpperCase() === 'COACH') {
                    return this.httpServer.app._router.handle(req, res, () => {
                        req.url = '/Auth/CheckCoachDeviceMapping';
                        this.httpServer.app._router.handle(req, res);
                    });
                } else {
                    return this.httpServer.app._router.handle(req, res, () => {
                        req.url = '/Auth/CheckUserDeviceMapping';
                        this.httpServer.app._router.handle(req, res);
                    });
                }
            } catch (error) {
                console.error("Unexpected error in CheckDeviceMapping endpoint:", error);
                return res.status(500).json({
                    SUCCESS: false,
                    ERROR: "INTERNAL_SERVER_ERROR",
                    MESSAGE: "An unexpected error occurred while checking device mapping",
                    DETAILS: error.message
                });
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
    console.log("Starting Auth Service...");
    const service = new Service('127.0.0.1', 10000);
    await service.startService();
}

start_service().catch(error => {
    console.error("Error starting service:", error);
});
