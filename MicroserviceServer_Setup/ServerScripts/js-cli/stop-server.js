const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function stopDockerCompose() {
    const scriptDir = path.dirname(path.resolve(__filename));
    const projectRoot = path.dirname(path.dirname(scriptDir));
    const composeFileYml = path.join(projectRoot, "docker-compose.yml");
    const composeFileYaml = path.join(projectRoot, "docker-compose.yaml");
    
    if (fs.existsSync(composeFileYml) || fs.existsSync(composeFileYaml)) {
        execSync("sudo docker-compose down", { cwd: projectRoot, stdio: 'inherit' });
    } else {
        console.log(`docker-compose.yml or docker-compose.yaml not found in ${projectRoot}. Skipping docker-compose down.`);
    }
}

function findPidByPort(port) {
    try {
        const result = execSync(`lsof -i :${port}`, { encoding: 'utf8' });
        const lines = result.split('\n');
        if (lines.length > 1) {
            const pid = parseInt(lines[1].split(/\s+/)[1]);
            return pid;
        }
    } catch (error) {
        // No process found on port
    }
    return null;
}

function stopServiceOnPort(port) {
    const pid = findPidByPort(port);
    if (pid) {
        try {
            execSync(`sudo kill -9 ${pid}`);
            console.log(`${port} : Service Stopped`);
        } catch (error) {
            console.log(`${port} : Failed to stop service`);
        }
    } else {
        console.log(`${port} : No Service Found`);
    }
}

function discoverPorts() {
    const parentAddress = path.dirname(path.resolve(path.join(path.dirname(__filename), '..')));
    console.log(`Parent folder absolute address: ${parentAddress}`);

    const serviceJsonFilePath = path.join(parentAddress, "services.json");
    if (!fs.existsSync(serviceJsonFilePath)) {
        console.log(`Service JSON file not found at ${serviceJsonFilePath}`);
        return [];
    }

    try {
        const servicesData = JSON.parse(fs.readFileSync(serviceJsonFilePath, 'utf8'));
        const httpPorts = servicesData
            .filter(service => service.ServiceHttpPort !== null && service.ServiceHttpPort !== undefined)
            .map(service => service.ServiceHttpPort);
        const wsPorts = servicesData
            .filter(service => service.ServiceWsPort !== null && service.ServiceWsPort !== undefined)
            .map(service => service.ServiceWsPort);
        return [...httpPorts, ...wsPorts];
    } catch (error) {
        console.log(`Error reading services.json: ${error.message}`);
        return [];
    }
}

function stopServer() {
    stopDockerCompose();
    const portList = discoverPorts();
    console.log(portList);

    portList.forEach(port => {
        stopServiceOnPort(port);
    });
}

stopServer();
