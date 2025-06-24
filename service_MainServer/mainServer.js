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
    }

    // async fun1(message) {
    //     const msg = message.content.toString();
    //     console.log("Fun1", msg);
    // }


    // Configure the API route for the HTTP server.
    async ConfigureHTTPRoutes() {
        this.httpServer.app.use(express.json());

        this.httpServer.app.post("/Auth/Google", async (req, res) => {
            console.log("Google Authentication");

            try {
                const serviceName = "AUTH_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                // const { ID_TOKEN } = req.body;
                // if (!ID_TOKEN) {
                //     return res.status(400).json({ 
                //         ERROR: "BAD_REQUEST", 
                //         MESSAGE: "ID_TOKEN field is required in request body",
                //         ERROR_CODE: "MISSING_TOKEN"
                //     });
                // }

                const response = await axios.post(`http://${serviceURL[serviceName]}/Auth/Google`, req.body, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 200) {
                    res.json(response.data);
                }
            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from authentication service",
                        ERROR_CODE: "AUTH_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });

        this.httpServer.app.get("/Auth/CheckDeviceMapping", async (req, res) => {
            console.log("Main Server: Check Device Mapping");

            try {
                const serviceName = "AUTH_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                // Extract parameters with capital letter naming convention
                const { DEVICE_ID, EMAIL } = req.query;

                // Validate required fields
                if (!DEVICE_ID || !EMAIL) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "DEVICE_ID and EMAIL parameters are required",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to Auth Service with correctly formatted parameters
                const response = await axios.get(`http://${serviceURL[serviceName]}/Auth/CheckDeviceMapping`, {
                    params: {
                        deviceId: DEVICE_ID,  // Auth service expects lowercase
                        email: EMAIL
                    }
                });

                // Forward successful response
                return res.status(response.status).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from authentication service",
                        ERROR_CODE: "AUTH_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });



        this.httpServer.app.post("/Device/RegisterNewDevice", async (req, res) => {
            console.log("Main Server: Register New Device");

            try {
                const serviceName = "POSTGRES_DB_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { DEVICE_ID, FCM_TOKEN } = req.body;

                // Validate required fields
                if (!DEVICE_ID || !FCM_TOKEN) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "DEVICE_ID and FCM_TOKEN fields are required in request body",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to PostgreSQL DB Service
                const response = await axios.post(`http://${serviceURL[serviceName]}/Device/Register`, {
                    DEVICE_ID: DEVICE_ID,
                    FCM_TOKEN: FCM_TOKEN
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Return successful response with standardized format
                return res.status(200).json({
                    STATUS: "SUCCESS",
                    MESSAGE: "Device registered successfully",
                    DEVICE_ID: DEVICE_ID,
                    ...response.data
                });

            } catch (error) {
                // Handle various error cases
                if (error.response) {
                    // Return response from PostgreSQL service with standardized format
                    const { status, data } = error.response;
                    return res.status(status).json({
                        ERROR: "DATABASE_ERROR",
                        MESSAGE: data.error || "Error processing device registration",
                        ERROR_CODE: "DB_SERVICE_ERROR",
                        DETAILS: data.details || null
                    });
                } else if (error.request) {
                    // Request made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from database service",
                        ERROR_CODE: "DB_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });


        this.httpServer.app.get("/Coach/GetPaginatedCoachesList", async (req, res) => {
            console.log("Main Server: Get All Coaches");

            try {
                const serviceName = "COACHES_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                // Extract query parameters
                const { USER_EMAIL, LIMIT, TIMESTAMP } = req.query;
                
                // Check for required USER_EMAIL parameter
                if (!USER_EMAIL) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "USER_EMAIL parameter is required",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to Coaches Service with query parameters
                const response = await axios.get(`http://${serviceURL[serviceName]}/Coaches/GetPaginatedCoachList`, {
                    params: {
                        USER_EMAIL: USER_EMAIL,
                        LIMIT: LIMIT,
                        TIMESTAMP: TIMESTAMP
                    }
                });

                // Forward successful response
                return res.status(200).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from coaches service",
                        ERROR_CODE: "COACH_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });
        
        this.httpServer.app.post("/Coach/RegisterNewCoach", async (req, res) => {
            console.log("Main Server: Register New Coach");

            try {
                const serviceName = "COACHES_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { NAME, EMAIL, PASSWORD } = req.body;

                // Validate required fields
                if (!NAME || !EMAIL || !PASSWORD) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "NAME, EMAIL, and PASSWORD fields are required in request body",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to Coaches Service
                const response = await axios.post(`http://${serviceURL[serviceName]}/Coach/RegisterCoach`, {
                    NAME: NAME,
                    EMAIL: EMAIL,
                    PASSWORD: PASSWORD
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Forward successful response
                return res.status(response.status).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from coaches service",
                        ERROR_CODE: "COACH_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });

        this.httpServer.app.get("/Coach/GetCoachInfo", async (req, res) => {
            console.log("Main Server: Get Coach Information");

            try {
                const serviceName = "COACHES_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { EMAIL } = req.query;

                // Validate required fields
                if (!EMAIL) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "EMAIL parameter is required",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to Coaches Service
                const response = await axios.get(`http://${serviceURL[serviceName]}/Coach/GetCoachInfo`, {
                    params: {
                        EMAIL: EMAIL
                    }
                });

                // Forward successful response
                return res.status(response.status).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from coaches service",
                        ERROR_CODE: "COACH_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });
        
        this.httpServer.app.put("/Coach/UpdateCoachInfo", async (req, res) => {
            console.log("Main Server: Update Coach Information");

            try {
                const serviceName = "COACHES_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { EMAIL, NAME, PASSWORD } = req.body;

                // Validate required fields
                if (!EMAIL) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "EMAIL field is required in request body",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                if (!NAME && !PASSWORD) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "At least one field to update (NAME or PASSWORD) is required",
                        ERROR_CODE: "MISSING_UPDATE_FIELDS"
                    });
                }

                // Forward request to Coaches Service
                const response = await axios.put(`http://${serviceURL[serviceName]}/Coach/UpdateCoach`, {
                    EMAIL: EMAIL,
                    NAME: NAME,
                    PASSWORD: PASSWORD
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // Forward successful response
                return res.status(response.status).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from coaches service",
                        ERROR_CODE: "COACH_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });

        this.httpServer.app.post("/Coach/CheckCredential", async (req, res) => {
            console.log("Main Server: Check Coach Credentials");

            try {
                const serviceName = "COACHES_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { EMAIL, PASSWORD } = req.body;

                // Validate required fields
                if (!EMAIL || !PASSWORD) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "EMAIL and PASSWORD fields are required in request body",
                        ERROR_CODE: "MISSING_PARAMETERS",
                        STATUS: "NOT_REGISTERED"
                    });
                }

                // Forward request to Coaches Service
                const response = await axios.post(`http://${serviceURL[serviceName]}/Coach/CheckCredential`, {
                    EMAIL: EMAIL,
                    PASSWORD: PASSWORD
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                // For successful authentication, convert STATUS=SUCCESS to STATUS=REGISTERED
                if (response.data && response.data.STATUS === "SUCCESS") {
                    return res.status(200).json({
                        STATUS: "REGISTERED",
                        MESSAGE: "Coach credentials verified successfully"
                    });
                } else {
                    // Forward any other status responses
                    return res.status(200).json({
                        STATUS: "NOT_REGISTERED",
                        MESSAGE: "Invalid credentials provided"
                    });
                }

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    const { status, data } = error.response;
                    
                    // Handle specific error cases
                    if (status === 404 && data.ERROR === "COACH_NOT_FOUND") {
                        return res.status(200).json({
                            STATUS: "NOT_REGISTERED",
                            MESSAGE: "No coach found with the specified email"
                        });
                    } else if (status === 401 || data.ERROR === "INVALID_CREDENTIALS") {
                        return res.status(200).json({
                            STATUS: "NOT_REGISTERED",
                            MESSAGE: "Invalid password provided"
                        });
                    } else if (data.ERROR === "INVALID_EMAIL" || data.ERROR === "INVALID_PASSWORD") {
                        return res.status(400).json({
                            ERROR: data.ERROR,
                            MESSAGE: data.MESSAGE || "Invalid input data format",
                            STATUS: "NOT_REGISTERED"
                        });
                    } else {
                        // Return other error responses from the coach service
                        return res.status(status).json({
                            ERROR: data.ERROR || "COACH_SERVICE_ERROR",
                            MESSAGE: data.MESSAGE || "Error processing request",
                            STATUS: "NOT_REGISTERED"
                        });
                    }
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from coaches service",
                        ERROR_CODE: "COACH_SERVICE_UNREACHABLE",
                        STATUS: "NOT_REGISTERED"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR",
                        STATUS: "NOT_REGISTERED"
                    });
                }
            }
        });


        this.httpServer.app.get("/Chat/GetAllMessages", async (req, res) => {
            console.log("Main Server: Get All Chat Messages");

            try {
                const serviceName = "CHAT_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { USER_EMAIL, COACH_EMAIL } = req.query;

                // Validate required fields
                if (!USER_EMAIL || !COACH_EMAIL) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "USER_EMAIL and COACH_EMAIL parameters are required",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to Chat Service
                const response = await axios.get(`http://${serviceURL[serviceName]}/Chat/GetAllMessages`, {
                    params: {
                        USER_EMAIL: USER_EMAIL,
                        COACH_EMAIL: COACH_EMAIL
                    }
                });

                // Forward successful response
                return res.status(200).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from chat service",
                        ERROR_CODE: "CHAT_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });

        this.httpServer.app.get("/Chat/GetPaginatedMessages", async (req, res) => {
            console.log("Main Server: Get Paginated Chat Messages");

            try {
                const serviceName = "CHAT_SERVICE";
                const serviceURL = JSON.parse(fs.readFileSync(path.join(__dirname, '../ServiceURLMapping.json'), 'utf8'));

                const { USER_EMAIL, COACH_EMAIL, LIMIT, TIMESTAMP } = req.query;

                // Validate required fields
                if (!USER_EMAIL || !COACH_EMAIL) {
                    return res.status(400).json({
                        ERROR: "BAD_REQUEST",
                        MESSAGE: "USER_EMAIL and COACH_EMAIL parameters are required",
                        ERROR_CODE: "MISSING_PARAMETERS"
                    });
                }

                // Forward request to Chat Service with optional pagination parameters
                const response = await axios.get(`http://${serviceURL[serviceName]}/Chat/GetPaginatedMessages`, {
                    params: {
                        USER_EMAIL: USER_EMAIL,
                        COACH_EMAIL: COACH_EMAIL,
                        LIMIT: LIMIT || 50, // Default limit if not provided
                        TIMESTAMP: TIMESTAMP // Optional timestamp for pagination
                    }
                });

                // Forward successful response
                return res.status(200).json(response.data);

            } catch (error) {
                // Check if the error has a response object (Axios HTTP error)
                if (error.response) {
                    // Return the original status code and error data
                    const { status, data } = error.response;
                    return res.status(status).json(data);
                } else if (error.request) {
                    // Request was made but no response received
                    return res.status(503).json({
                        ERROR: "SERVICE_UNAVAILABLE",
                        MESSAGE: "No response received from chat service",
                        ERROR_CODE: "CHAT_SERVICE_UNREACHABLE"
                    });
                } else {
                    // Something else caused the error
                    return res.status(500).json({
                        ERROR: "INTERNAL_SERVER_ERROR",
                        MESSAGE: error.message || "An unexpected error occurred while processing your request",
                        ERROR_CODE: "MAIN_SERVER_ERROR"
                    });
                }
            }
        });

    }

    async startService() {
        await this.messageQueue.InitializeConnection();
        // await this.messageQueue.AddQueueAndMapToCallback("queue1", this.fun1.bind(this));
        await this.messageQueue.StartListeningToQueue();

        await this.ConfigureHTTPRoutes();
        await this.httpServer.run_app();
    }
}

async function start_service() {
    const service = new Service('127.0.0.1', 5000);
    await service.startService();
}

start_service().catch(error => {
    console.error("Error starting service:", error);
});
