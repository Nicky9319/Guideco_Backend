import HTTP_SERVER from "./HTTP_SERVER/http-server-class.js";
import Data from "./DATA/data-class.js";
import Service from "./SERVICE/service-class.js";

import { fileURLToPath } from 'url';

// Main entry point
function startService() {
    console.log("Starting PostgreSQL DB Service...");
    const dataClass = new Data();

    const httpServerPort = 20000;
    const httpServerHost = "127.0.0.1";
    const httpServerPrivilegedIpAddress = ["127.0.0.1"];

    const httpServer = new HTTP_SERVER(
        httpServerHost,
        httpServerPort,
        httpServerPrivilegedIpAddress,
        dataClass,
        true
    );

    const service = new Service(httpServer);
    service.startService();
}

// Start the service when this file is run directly or through PM2
// PM2 uses ProcessContainerFork.js as argv[1], so we check for that too
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1].includes('ProcessContainerFork.js');

if (isMainModule) {
    console.log("Starting service...");
    startService();
} else {
    console.log("Module imported, not starting service");
}

