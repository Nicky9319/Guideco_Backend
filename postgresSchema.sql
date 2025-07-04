-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Coaches Table
CREATE TABLE "COACHES" (
    "ID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "NUMBER" VARCHAR(100) NOT NULL,
    "CREATED_AT" TIMESTAMP NOT NULL,
    "UPDATED_AT" TIMESTAMP
);

-- User Profile Table
CREATE TABLE "USER_PROFILE" (
    "ID" UUID UNIQUE KEY DEFAULT uuid_generate_v4(),
    "NUMBER" VARCHAR(255) NOT NULL PRIMARY KEY,
    "WALLET_BALANCE" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "CREATED_AT" TIMESTAMP NOT NULL,
    "UPDATED_AT" TIMESTAMP
);

-- Devices Table
CREATE TABLE "DEVICES" (
    "ID" UUID PRIMARY KEY DEFAULT,
    "FCM_TOKEN" VARCHAR(255) NOT NULL,
);

-- Payment Table
CREATE TABLE "PAYMENT" (
    "ID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "USER_ID" UUID NOT NULL REFERENCES "USER_PROFILE"("ID") ON DELETE CASCADE,
    "AMOUNT" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "TIMESTAMP" TIMESTAMP NOT NULL,
);

-- Chat Interaction Table
CREATE TABLE "CHAT_INTERACTION" (
    "ID" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "TYPE" VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    "USER_ID" UUID NOT NULL REFERENCES "USER_PROFILE"("ID") ON DELETE CASCADE,
    "COACH_ID" UUID NOT NULL REFERENCES "COACHES"("ID") ON DELETE CASCADE,
    "MESSAGE" TEXT NOT NULL,
    "SENDER" VARCHAR(10) NOT NULL CHECK ("SENDER" IN ('USER', 'COACH')), 
    "CREATED_AT" TIMESTAMP NOT NULL,
    "UPDATED_AT" TIMESTAMP,
    "FLAG" VARCHAR(20) NOT NULL CHECK ("FLAG" IN ('RECEIVED', 'DELIVERED', 'READ'))
);

-- Active Devices Account Mapping User
CREATE TABLE "ACTIVE_DEVICE_ACCOUNT_MAPPING_USER" (
    "DEVICE_ID" UUID NOT NULL REFERENCES "DEVICES"("ID") ON DELETE CASCADE,
    "USER_ID" UUID NOT NULL REFERENCES "USER_PROFILE"("ID") ON DELETE CASCADE,
    PRIMARY KEY ("DEVICE_ID", "USER_ID")
)

-- Active Devices Account Mapping Coach
CREATE TABLE "ACTIVE_DEVICE_ACCOUNT_MAPPING_COACH" (
    "DEVICE_ID" UUID NOT NULL REFERENCES "DEVICES"("ID") ON DELETE CASCADE,
    "COACH_ID" UUID NOT NULL REFERENCES "COACHES"("ID") ON DELETE CASCADE,
    PRIMARY KEY ("DEVICE_ID", "COACH_ID")
)

-- Coach User Last Interaction
CREATE TABLE "COACH_USER_LAST_INTERACTION" (
    "USER_ID" UUID NOT NULL REFERENCES "USER_PROFILE"("ID") ON DELETE CASCADE,
    "COACH_ID" UUID NOT NULL REFERENCES "COACHES"("ID") ON DELETE CASCADE,
    "TYPE" VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    "MESSAGE" TEXT NOT NULL, 
    "TIMESTAMP" TIMESTAMP NOT NULL,
    "FLAG" VARCHAR(20) NOT NULL CHECK ("FLAG" IN ('RECEIVED', 'DELIVERED', 'READ')),
    "SENDER" VARCHAR(10) NOT NULL CHECK ("SENDER" IN ('USER', 'COACH')),
    PRIMARY KEY ("USER_ID", "COACH_ID")
)
