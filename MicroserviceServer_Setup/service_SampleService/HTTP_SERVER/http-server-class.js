import express from 'express';
import cors from 'cors';

class HTTP_SERVER {
  constructor(httpServerHost, httpServerPort, httpServerPrivilegedIpAddress = ["127.0.0.1"], dataClassInstance = null, enableCors = true) {
    this.app = express();
    this.host = httpServerHost;
    this.port = httpServerPort;
    this.privilegedIpAddress = httpServerPrivilegedIpAddress;
    this.dataClass = dataClassInstance;
    this.corsEnabled = false;

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
    // /api/sample/ endpoint

    // /api/SampleService/example endpoint
    this.app.post('/api/sample/new-example', (req, res) => {
      console.log("Example API Called");
      res.json({ message: "Example Response" });
    });

    // /api/sample/new-one endpoint
    this.app.post('/api/sample/new-one', (req, res) => {
      console.log("API Called");
      res.json({ message: "API Response" });
    });

    // Add new APIs here if needed
  }

  runApp() {
    this.app.listen(this.port, this.host, () => {
      console.log(`Server running at http://${this.host}:${this.port}/`);
    });
  }
}

export default HTTP_SERVER;