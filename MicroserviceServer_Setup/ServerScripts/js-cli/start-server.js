const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function runDockerCompose() {
    const scriptDir = path.dirname(path.resolve(__filename));
    const projectRoot = path.dirname(path.dirname(scriptDir));
    const composeFileYml = path.join(projectRoot, "docker-compose.yml");
    const composeFileYaml = path.join(projectRoot, "docker-compose.yaml");
    
    if (fs.existsSync(composeFileYml) || fs.existsSync(composeFileYaml)) {
        execSync("sudo docker-compose up -d", { cwd: projectRoot, stdio: 'inherit' });
    } else {
        console.log(`docker-compose.yml or docker-compose.yaml not found in ${projectRoot}. Skipping docker-compose up.`);
    }
}

function checkEnvFile() {
    const scriptDir = path.dirname(path.resolve(__filename));
    const projectRoot = path.dirname(path.dirname(scriptDir));
    const envPath = path.join(projectRoot, ".env");
    
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("#") && !trimmedLine.includes("=")) {
                console.log(`WARNING: .env file syntax error at line ${index + 1}: ${trimmedLine}`);
            }
        });
    }
}

function loadEnvVars(envPath) {
    const envVars = {};
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
                return;
            }
            const [key, ...valueParts] = trimmedLine.split("=");
            const value = valueParts.join("=");
            envVars[key.trim()] = value.trim();
        });
    }
    return envVars;
}

function startServicesFromServicesJson() {
    const scriptDir = path.dirname(path.resolve(__filename));
    const projectRoot = path.dirname(path.dirname(scriptDir));
    const servicesJsonPath = path.join(projectRoot, "services.json");
    const envPath = path.join(projectRoot, ".env");

    if (!fs.existsSync(servicesJsonPath)) {
        console.log(`${servicesJsonPath} not found.`);
        return;
    }

    const envVars = { ...process.env, ...loadEnvVars(envPath) };

    try {
        const services = JSON.parse(fs.readFileSync(servicesJsonPath, 'utf8'));
        
        services.forEach(service => {
            const folder = service.ServiceFolderName;
            const filename = service.ServiceFileName;
            if (!folder || !filename) {
                return;
            }
            
            // Convert .py extension to .js
            const jsFilename = filename.replace(/\.py$/, '.js');
            const servicePath = path.join(projectRoot, folder, jsFilename);
            
            if (!fs.existsSync(servicePath)) {
                console.log(`Service file ${servicePath} not found. Skipping.`);
                return;
            }
            
            const cmd = 'node';
            const args = [path.join(folder, jsFilename)];
            console.log(`Starting: ${cmd} ${args.join(' ')}`);
            
            try {
                spawn(cmd, args, {
                    cwd: projectRoot,
                    env: envVars,
                    detached: true,
                    stdio: 'ignore'
                }).unref();
            } catch (error) {
                console.log(`ERROR: ${error.message}. Check if the Node.js and service files exist.`);
            }
        });
    } catch (error) {
        console.log(`Error reading ${servicesJsonPath}: ${error.message}`);
    }
}

if (require.main === module) {
    checkEnvFile();
    runDockerCompose();
    startServicesFromServicesJson();
}
