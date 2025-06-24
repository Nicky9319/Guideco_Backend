const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const amqp = require('amqplib');

const path = require('path');

const serviceTemplatesPath = path.join(__dirname, '../Basic');

const MessageQueue = require(`${serviceTemplatesPath}/MESSAGE_QUEUE.js`);
const HTTPServer = require(`${serviceTemplatesPath}/HTTP_SERVER.js`);
const WebSocketServer = require(`${serviceTemplatesPath}/WS_SERVER.js`);

class Service {
    constructor(wsServerHost, wsServerPort, httpServerHost, httpServerPort) {
        this.messageQueue = new MessageQueue("amqp://guest:guest@localhost/", "/");
        this.httpServer = new HTTPServer(httpServerHost, httpServerPort);
        this.wsServer = new WebSocketServer(wsServerHost, wsServerPort);
    }

    async fun1(message) {
        let msg = message.content.toString();
        console.log("Fun1", msg);
    }

    async fun2(message) {
        let msg = message.content.toString();
        console.log("Fun2", msg);
    }

    async configureHTTPserverRoutes() {
    }

    async configureWSserverMethods() {
        this.wsServer.io.on('connection', (socket) => {
            console.log(`A New User with ID ${socket.id} Connected`);

            socket.on('disconnect', () => {
                console.log(`Client ${socket.id} disconnected`);
            });

            socket.on('GET_SID', (callback) => {
                if (typeof callback === 'function') {
                    callback(socket.id);
                }
            });
        });
    }

    async startService() {
        await this.messageQueue.InitializeConnection();
        await this.messageQueue.AddQueueAndMapToCallback("queue1", this.fun1.bind(this));
        await this.messageQueue.AddQueueAndMapToCallback("queue2", this.fun2.bind(this));
        await this.messageQueue.BoundQueueToExchange();
        await this.messageQueue.StartListeningToQueue();

        await this.configureWSserverMethods();
        await this.wsServer.start(); 

        await this.configureHTTPserverRoutes();
        await this.httpServer.run_app(); 
    }
}

// =========================
// Entry Point
// =========================
async function start_service() {
    const service = new Service('127.0.0.1', 6000, '127.0.0.1', 8000);
    await service.startService();
}

// Start the service
start_service().catch(err => console.error("Service start failed:", err));
