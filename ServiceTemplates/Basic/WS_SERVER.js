const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

class WebSocketServer {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.httpServer = http.createServer();
    this.sio = new Server(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, this.host, () => {
        console.log(`WebSocket server running at http://${this.host}:${this.port}/`);
        resolve();
      });
      this.httpServer.on('error', (err) => {
        console.error("WebSocket server error:", err);
        reject(err);
      });
    });
  }
}

module.exports = WebSocketServer;

// MainServer class that defines all routes and endpoints
class MainServer {
    constructor(wsServerHost, wsServerPort) {
        this.wsServer = new WebSocketServer(wsServerHost, wsServerPort);
    }

    configureServerRoutes() {
        this.wsServer.sio.on('connection', (socket) => {
            console.log(`A New User with ID ${socket.id} Connected`);

            // Event: disconnect
            socket.on('disconnect', () => {
                console.log(`Client ${socket.id} disconnected`);
            });

            // Event: GET_SID
            // Using a callback to send back the socket id to the client.
            socket.on('GET_SID', (callback) => {
                if (typeof callback === 'function') {
                    callback(socket.id);
                }
            });
        });
    }

    runServer() {
        this.configureServerRoutes();
        this.wsServer.start();
    }
}

// Entry point of the application
// function main() {
//     const server = new MainServer('localhost', 6000);
//     server.runServer();
// }

// main();
