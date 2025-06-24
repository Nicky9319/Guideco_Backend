const { execSync } = require('child_process');

function listWorkingPorts() {
    try {
        const result = execSync("lsof -i -P -n", { encoding: 'utf8' });
        const lines = result.split('\n');
        const ports = new Set();
        
        lines.slice(1).forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length > 8 && parts[8].includes(':')) {
                const port = parts[8].split(':').pop();
                if (/^\d+$/.test(port)) {
                    ports.add(parseInt(port));
                }
            }
        });
        
        return Array.from(ports).sort((a, b) => a - b);
    } catch (error) {
        console.log(`Error listing ports: ${error.message}`);
        return [];
    }
}

const workingPorts = listWorkingPorts();
console.log("Working Ports: ", workingPorts);
