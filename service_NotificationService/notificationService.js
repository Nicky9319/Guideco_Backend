const express = require('express');
const http = require('http');
const amqp = require('amqplib');

const path = require('path');

const serviceTemplatesPath = path.join(__dirname, '../Basic');

const MessageQueue = require(`${serviceTemplatesPath}/MESSAGE_QUEUE.js`);
const HTTPServer = require(`${serviceTemplatesPath}/HTTP_SERVER.js`);


class Service {
    constructor(httpServerHost, httpServerPort) {
        this.messageQueue = new MessageQueue("amqp://guest:guest@localhost/", "NOTIFICATION_SERVICE_EXCHANGE");
        this.httpServer = new HTTPServer(httpServerHost, httpServerPort);
    }



    async handleChatServiceMessage(message) {
        const msg = message.content.toString();
        console.log("Chat Service Message:", msg);
    }

    async listenToChatServiceMessages(message) {
        const msg = message.content.toString();
        console.log("Chat Service", msg);
    }

    // Configure the API route for the HTTP server.
    async ConfigureAPIRoutes() {
        this.httpServer.app.get("/", async (req, res) => {
            console.log("Running Through Someone Else");
            res.json({ message: "Hello World" });
        });
    }

    async startService() {
        await this.messageQueue.InitializeConnection();
        await this.messageQueue.AddQueueAndMapToCallback("NSE_CHAT_SERVICE", this.fun1.bind(this));
        await this.messageQueue.StartListeningToQueue();

        await this.ConfigureAPIRoutes();
        await this.httpServer.run_app();
    }
}

async function start_service() {
    const service = new Service('127.0.0.1', 16000);
    await service.startService();
}

start_service().catch(error => {
    console.error("Error starting service:", error);
});
