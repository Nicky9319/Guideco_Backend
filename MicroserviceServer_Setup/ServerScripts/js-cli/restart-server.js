const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function stopDockerCompose() {
    const scriptDir = __dirname;
    const projectRoot = path.dirname(path.dirname(scriptDir));
    const composeFileYml = path.join(projectRoot, "docker-compose.yml");
    const composeFileYaml = path.join(projectRoot, "docker-compose.yaml");
    if (fs.existsSync(composeFileYml) || fs.existsSync(composeFileYaml)) {
        try {
            execSync('sudo docker-compose down', { cwd: projectRoot, stdio: 'inherit' });
        } catch (err) {
            console.error("Error running docker-compose down:", err.message);
        }
    } else {
        console.log(`docker-compose.yml or docker-compose.yaml not found in ${projectRoot}. Skipping docker-compose down.`);
    }
}

function runDockerCompose() {
    const scriptDir = __dirname;
    const projectRoot = path.dirname(path.dirname(scriptDir));
    const composeFileYml = path.join(projectRoot, "docker-compose.yml");
    const composeFileYaml = path.join(projectRoot, "docker-compose.yaml");
    if (fs.existsSync(composeFileYml) || fs.existsSync(composeFileYaml)) {
        try {
            execSync('sudo docker-compose up -d', { cwd: projectRoot, stdio: 'inherit' });
        } catch (err) {
            console.error("Error running docker-compose up:", err.message);
        }
    } else {
        console.log(`docker-compose.yml or docker-compose.yaml not found in ${projectRoot}. Skipping docker-compose up.`);
    }
}

function stopServices() {
    console.log("Stopping services...");
    const scriptDir = __dirname;
    const stopServerPath = path.join(scriptDir, "stop-server.js");
    if (fs.existsSync(stopServerPath)) {
        try {
            execSync(`node ${stopServerPath}`, { stdio: 'inherit' });
        } catch (err) {
            console.error("Error running stop-server.js:", err.message);
        }
    }
}

function startServices() {
    console.log("Starting services...");
    const scriptDir = __dirname;
    const startServerPath = path.join(scriptDir, "start-server.js");
    if (fs.existsSync(startServerPath)) {
        try {
            execSync(`node ${startServerPath}`, { stdio: 'inherit' });
        } catch (err) {
            console.error("Error running start-server.js:", err.message);
        }
    }
}

function main() {
    stopDockerCompose();
    stopServices();
    runDockerCompose();
    startServices();
}

if (require.main === module) {
    main();
}
