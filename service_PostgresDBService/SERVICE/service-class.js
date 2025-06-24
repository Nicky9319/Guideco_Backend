class Service {
    constructor(httpServer = null) {
        this.httpServer = httpServer;
    }

    startService() {
        this.httpServer.configureRoutes();
        this.httpServer.runApp();
    }
}
export default Service;