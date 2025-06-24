import express from 'express';
import cors from 'cors';

import dotenv from 'dotenv';
dotenv.config();

class HTTP_SERVER {
  constructor(httpServerHost, httpServerPort, httpServerPrivilegedIpAddress = ["127.0.0.1"], dataClassInstance = null, enableCors = true) {
    this.app = express();
    this.host = httpServerHost;
    this.port = httpServerPort;
    this.privilegedIpAddress = httpServerPrivilegedIpAddress;
    this.dataClass = dataClassInstance;
    this.corsEnabled = false;

    // Add JSON parsing middleware
    this.app.use(express.json());

    // Conditionally add CORS middleware
    if (enableCors) {
      this.app.use(cors({
        origin: '*',
        credentials: true,
        methods: '*',
        allowedHeaders: '*'
      }));
      this.corsEnabled = true;
    }
  }

  configureRoutes() {
    // User Management Routes
    this.app.get("/User/Check", async (req, res) => {
      const { NUMBER } = req.query;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const user = await this.dataClass.getUserByNumber(NUMBER);

        if (user) {
          return res.json({ exists: true, user });
        } else {
          return res.json({ exists: false });
        }
      } catch (error) {
        console.error("Error checking user:", error);
        return res.status(500).json({ error: "Database error", details: error.message });
      }
    });

    this.app.post("/User/Create", async (req, res) => {
      const { NUMBER } = req.body;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const existingUser = await this.dataClass.getUserByNumber(NUMBER);

        if (existingUser) {
          return res.status(409).json({
            error: "User already exists",
            user: existingUser
          });
        }

        const newUser = await this.dataClass.createUser(NUMBER);

        return res.status(201).json({
          message: "User created successfully",
          user: newUser
        });
      } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({ error: "Database error", details: error.message });
      }
    });

    this.app.get("/User/Wallet", async (req, res) => {
      const { NUMBER } = req.query;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const balance = await this.dataClass.getUserWalletBalance(NUMBER);

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

    this.app.put("/User/Wallet", async (req, res) => {
      const { NUMBER, AMOUNT } = req.body;

      if (!NUMBER || AMOUNT === undefined) {
        return res.status(400).json({ error: "NUMBER and AMOUNT are required" });
      }

      try {
        const updatedUser = await this.dataClass.updateUserWalletBalance(NUMBER, AMOUNT);

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

    // Device Management Routes
    this.app.post("/Device/Register", async (req, res) => {
      const { DEVICE_ID, FCM_TOKEN } = req.body;

      if (!DEVICE_ID || !FCM_TOKEN) {
        return res.status(400).json({ error: "DEVICE_ID and FCM_TOKEN are required" });
      }

      try {
        const result = await this.dataClass.registerOrUpdateDevice(DEVICE_ID, FCM_TOKEN);

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

    this.app.post("/Device/Map/User", async (req, res) => {
      const { DEVICE_ID, NUMBER } = req.body;

      if (!DEVICE_ID || !NUMBER) {
        return res.status(400).json({ error: "DEVICE_ID and NUMBER are required" });
      }

      try {
        const user = await this.dataClass.getUserByNumber(NUMBER);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = user.ID;
        const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
        
        const mappingExists = await this.dataClass.checkDeviceUserMapping(sanitizedDeviceId, userId);

        if (!mappingExists) {
          await this.dataClass.createDeviceUserMapping(sanitizedDeviceId, userId);
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

    this.app.post("/Device/Map/Coach", async (req, res) => {
      const { DEVICE_ID, NUMBER } = req.body;

      if (!DEVICE_ID || !NUMBER) {
        return res.status(400).json({ error: "DEVICE_ID and NUMBER are required" });
      }

      try {
        const coach = await this.dataClass.getCoachByNumber(NUMBER);

        if (!coach) {
          return res.status(404).json({ error: "Coach not found" });
        }

        const coachId = coach.ID;
        const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
        
        const mappingExists = await this.dataClass.checkDeviceCoachMapping(sanitizedDeviceId, coachId);

        if (!mappingExists) {
          await this.dataClass.createDeviceCoachMapping(sanitizedDeviceId, coachId);
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

    this.app.delete("/Device/Map/User", async (req, res) => {
      const { NUMBER } = req.body;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const user = await this.dataClass.getUserByNumber(NUMBER);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = user.ID;
        const result = await this.dataClass.removeAllDevicesForUser(userId);

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

    this.app.delete("/Device/Map/Coach", async (req, res) => {
      const { NUMBER } = req.body;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const coach = await this.dataClass.getCoachByNumber(NUMBER);

        if (!coach) {
          return res.status(404).json({ error: "Coach not found" });
        }

        const coachId = coach.ID;
        const result = await this.dataClass.removeAllDevicesForCoach(coachId);

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

    this.app.get("/Device/CheckMapping/User", async (req, res) => {
      const { DEVICE_ID, NUMBER } = req.query;

      if (!DEVICE_ID || !NUMBER) {
        return res.status(400).json({ 
          success: false,
          error: "DEVICE_ID and NUMBER are required" 
        });
      }

      try {
        const user = await this.dataClass.getUserByNumber(NUMBER);
        
        if (!user) {
          return res.status(404).json({ 
            success: false,
            error: "User not found" 
          });
        }
        
        const userId = user.ID;
        const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
        const isMapped = await this.dataClass.checkDeviceUserMapping(sanitizedDeviceId, userId);
        
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

    this.app.get("/Device/CheckMapping/Coach", async (req, res) => {
      const { DEVICE_ID, NUMBER } = req.query;

      if (!DEVICE_ID || !NUMBER) {
        return res.status(400).json({ 
          success: false,
          error: "DEVICE_ID and NUMBER are required" 
        });
      }

      try {
        const coach = await this.dataClass.getCoachByNumber(NUMBER);
        
        if (!coach) {
          return res.status(404).json({ 
            success: false,
            error: "Coach not found" 
          });
        }
        
        const coachId = coach.ID;
        const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
        const isMapped = await this.dataClass.checkDeviceCoachMapping(sanitizedDeviceId, coachId);
        
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

    this.app.get("/Device/CheckMapping", async (req, res) => {
      const { DEVICE_ID, NUMBER, ACCOUNT_TYPE = "USER" } = req.query;

      if (!DEVICE_ID || !NUMBER) {
        return res.status(400).json({ 
          success: false,
          error: "DEVICE_ID and NUMBER are required" 
        });
      }

      try {
        if (ACCOUNT_TYPE.toUpperCase() === "COACH") {
          const coach = await this.dataClass.getCoachByNumber(NUMBER);
          
          if (!coach) {
            return res.status(404).json({ 
              success: false,
              error: "Coach not found" 
            });
          }
          
          const coachId = coach.ID;
          const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
          const isMapped = await this.dataClass.checkDeviceCoachMapping(sanitizedDeviceId, coachId);
          
          return res.status(200).json({
            success: true,
            isMapped,
            deviceId: DEVICE_ID,
            number: NUMBER,
            accountType: "COACH"
          });
        } else {
          const user = await this.dataClass.getUserByNumber(NUMBER);
          
          if (!user) {
            return res.status(404).json({ 
              success: false,
              error: "User not found" 
            });
          }
          
          const userId = user.ID;
          const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
          const isMapped = await this.dataClass.checkDeviceUserMapping(sanitizedDeviceId, userId);
          
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

    this.app.delete("/Device/Map/RemoveAll", async (req, res) => {
      const { DEVICE_ID } = req.body;

      if (!DEVICE_ID) {
        return res.status(400).json({ error: "DEVICE_ID is required" });
      }

      try {
        const sanitizedDeviceId = this.dataClass.sanitizeDeviceId(DEVICE_ID);
        
        // First, remove any device-user mappings
        const userMappingsResult = await this.dataClass.pool.query(
          'DELETE FROM "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" WHERE "DEVICE_ID" = $1 RETURNING *',
          [sanitizedDeviceId]
        );
        
        // Then, remove any device-coach mappings
        const coachMappingsResult = await this.dataClass.pool.query(
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

    // Coach Management Routes
    this.app.post("/Coach/Register", async (req, res) => {
      const { NUMBER } = req.body;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const existingCoach = await this.dataClass.getCoachByNumber(NUMBER);

        if (existingCoach) {
          return res.status(409).json({
            error: "Coach already exists",
            coach: existingCoach
          });
        }

        const newCoach = await this.dataClass.createCoach(NUMBER);

        return res.status(201).json({
          message: "Coach registered successfully",
          coach: newCoach
        });
      } catch (error) {
        console.error("Error registering coach:", error);
        return res.status(500).json({ error: "Database error", details: error.message });
      }
    });

    this.app.get("/Coach/Info", async (req, res) => {
      const { NUMBER } = req.query;

      if (!NUMBER) {
        return res.status(400).json({ error: "NUMBER is required" });
      }

      try {
        const coach = await this.dataClass.getCoachByNumber(NUMBER);

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

    this.app.get("/Coach/GetAllCoachesList", async (req, res) => {
      try {
        const coaches = await this.dataClass.getAllCoaches();

        return res.json({ coaches });
      } catch (error) {
        console.error("Error retrieving coaches:", error);
        return res.status(500).json({ error: "Database error", details: error.message });
      }
    });

    this.app.get("/Coach/GetPaginatedCoachList", async (req, res) => {
      const { USER_NUMBER, LIMIT = 10, TIMESTAMP } = req.query;

      if (!USER_NUMBER) {
        return res.status(400).json({ error: "USER_NUMBER is required" });
      }

      try {
        const user = await this.dataClass.getUserByNumber(USER_NUMBER);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = user.ID;
        const coaches = await this.dataClass.getCoachesWithLastInteraction(userId, LIMIT, TIMESTAMP);

        const formattedCoaches = coaches.map(coach => this.dataClass.formatCoachWithLastInteraction(coach));

        return res.json({
          COACHES: formattedCoaches,
          COUNT: formattedCoaches.length
        });
      } catch (error) {
        console.error("Error retrieving coach list:", error);
        return res.status(500).json({ error: "Database error", details: error.message });
      }
    });

    this.app.get("/Coach/LastInteractionInformation", async (req, res) => {
      try {
        const { USER_NUMBER, COACH_IDS } = req.body;

        if (!USER_NUMBER) {
          return res.status(400).json({ error: "USER_NUMBER is required" });
        }

        if (!COACH_IDS || !Array.isArray(COACH_IDS) || COACH_IDS.length === 0) {
          return res.status(400).json({ error: "COACH_IDS must be a non-empty array" });
        }

        const user = await this.dataClass.getUserByNumber(USER_NUMBER);

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = user.ID;
        const interactions = await this.dataClass.getLastInteractionsByCoachIds(userId, COACH_IDS);

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

    // Chat Management Routes
    this.app.post("/Chat/GetAllMessages", async (req, res) => {
      const { USER_NUMBER, COACH_ID } = req.query;

      if (!USER_NUMBER || !COACH_ID) {
        return res.status(400).json({ 
          ERROR: "USER_NUMBER and COACH_ID are required" 
        });
      }

      try {
        const user = await this.dataClass.getUserByNumber(USER_NUMBER);
        
        if (!user) {
          return res.status(404).json({ 
            ERROR: "User not found" 
          });
        }

        const coach = await this.dataClass.pool.query(
          'SELECT * FROM "COACHES" WHERE "ID" = $1',
          [COACH_ID]
        );

        if (coach.rows.length === 0) {
          return res.status(404).json({ 
            ERROR: "Coach not found" 
          });
        }

        const messages = await this.dataClass.getChatMessages(user.ID, COACH_ID);
        
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

    this.app.get("/Chat/GetPaginatedMessages", async (req, res) => {
      const { USER_NUMBER, COACH_ID, TIMESTAMP, LIMIT = 10 } = req.query;

      if (!USER_NUMBER || !COACH_ID) {
        return res.status(400).json({ 
          ERROR: "USER_NUMBER and COACH_ID are required" 
        });
      }

      try {
        const user = await this.dataClass.getUserByNumber(USER_NUMBER);
        
        if (!user) {
          return res.status(404).json({ 
            ERROR: "User not found" 
          });
        }

        const coach = await this.dataClass.pool.query(
          'SELECT * FROM "COACHES" WHERE "ID" = $1',
          [COACH_ID]
        );

        if (coach.rows.length === 0) {
          return res.status(404).json({ 
            ERROR: "Coach not found" 
          });
        }

        const parsedLimit = parseInt(LIMIT) || 10;
        if (parsedLimit <= 0) {
          return res.status(400).json({
            ERROR: "LIMIT must be a positive number"
          });
        }

        if (TIMESTAMP && isNaN(Date.parse(TIMESTAMP))) {
          return res.status(400).json({
            ERROR: "Invalid TIMESTAMP format"
          });
        }

        const messages = await this.dataClass.getPaginatedChatMessages(
          user.ID, 
          COACH_ID, 
          parsedLimit, 
          TIMESTAMP
        );
        
        const hasMore = messages.length >= parsedLimit;
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

    this.app.post("/Chat/StoreMessage", async (req, res) => {
      const { USER_ID, COACH_ID, MESSAGE, TYPE = 'TEXT', SENDER = 'USER', TIMESTAMP } = req.body;
      
      if (!USER_ID || !COACH_ID || !MESSAGE) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "USER_ID, COACH_ID, and MESSAGE are required"
        });
      }
      
      if (SENDER !== 'USER' && SENDER !== 'COACH') {
        return res.status(400).json({
          error: "Invalid SENDER value",
          details: "SENDER must be either 'USER' or 'COACH'"
        });
      }
      
      try {
        const userResult = await this.dataClass.pool.query(
          'SELECT * FROM "USER_PROFILE" WHERE "ID" = $1',
          [USER_ID]
        );
        
        if (userResult.rows.length === 0) {
          return res.status(404).json({
            ERROR: "User not found",
            DETAILS: "The specified USER_ID does not exist"
          });
        }
        
        const coachResult = await this.dataClass.pool.query(
          'SELECT * FROM "COACHES" WHERE "ID" = $1',
          [COACH_ID]
        );
        
        if (coachResult.rows.length === 0) {
          return res.status(404).json({
            ERROR: "Coach not found",
            DETAILS: "The specified COACH_ID does not exist"
          });
        }
        
        const storedMessage = await this.dataClass.storeMessageInDB(
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

    
  }

  runApp() {
    this.app.listen(this.port, this.host, () => {
      console.log(`Server running at http://${this.host}:${this.port}/`);
    });
  }
}

export default HTTP_SERVER;