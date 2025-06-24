const express = require('express');
const cors = require('cors');

class Data {
    constructor() {
        this.value = null;
    }
    getValue() {
        return this.value;
    }
    setValue(value) {
        this.value = value;
    }
}

class HTTPServer {
    constructor(httpServerHost, httpServerPort, httpServerPrivilegedIpAddress = ["127.0.0.1"], dataClassInstance = null) {
        this.app = express();
        this.host = httpServerHost;
        this.port = httpServerPort;
        this.privilegedIpAddress = httpServerPrivilegedIpAddress;
        this.dataClass = dataClassInstance;

        // CORS middleware
        this.app.use(cors({
            origin: '*',
            credentials: true,
            methods: '*',
            allowedHeaders: '*'
        }));
    }

    configureRoutes() {
        // /api/sample/ endpoint
        this.app.get('/api/sample/', (req, res) => {
            console.log("Running Through Someone Else");
            res.json({ message: "Hello World" });
        });

        // Add new APIs here if needed
    }

    runApp() {
        this.app.listen(this.port, this.host, () => {
            console.log(`Server running at http://${this.host}:${this.port}/`);
        });
    }
}

class Service {
    constructor(httpServer = null) {
        this.httpServer = httpServer;
    }

    startService() {
        this.httpServer.configureRoutes();
        this.httpServer.runApp();
    }
}

// Main entry point
function startService() {
    const dataClass = new Data();

    const httpServerPort = 8080;
    const httpServerHost = "127.0.0.1";
    const httpServerPrivilegedIpAddress = ["127.0.0.1"];

    const httpServer = new HTTPServer(
        httpServerHost,
        httpServerPort,
        httpServerPrivilegedIpAddress,
        dataClass
    );

    const service = new Service(httpServer);
    service.startService();
}

if (require.main === module) {
    startService();
}
