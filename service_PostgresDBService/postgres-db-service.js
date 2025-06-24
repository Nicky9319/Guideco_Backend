import HTTP_SERVER from "./HTTP_SERVER/http-server-class.js";
import Data from "./DATA/data-class.js";
import Service from "./SERVICE/service-class.js";

import { fileURLToPath } from 'url';

// Main entry point
function startService() {
    const dataClass = new Data();

    const httpServerPort = 20000;
    const httpServerHost = "127.0.0.1";
    const httpServerPrivilegedIpAddress = ["192.168.0.1"];

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

// ES6 equivalent of require.main === module
if (import.meta.url === `file://${fileURLToPath(import.meta.url)}` && process.argv[1] === fileURLToPath(import.meta.url)) {
    startService();
}
