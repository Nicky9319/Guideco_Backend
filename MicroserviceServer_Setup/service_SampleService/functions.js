import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Helper function to update services.json file
 * @param {string} serviceName - Name of the service to update
 * @param {string} key - Key to update in the service object
 * @param {any} value - New value to set
 */
function updateServicesJson(serviceName, key, value) {
    const servicesJsonPath = path.join(__dirname, '../services.json');
    const servicesData = JSON.parse(fs.readFileSync(servicesJsonPath, 'utf8'));
    
    // Find the service by name and update the specified key
    const serviceIndex = servicesData.findIndex(service => service.ServiceName === serviceName);
    if (serviceIndex !== -1) {
        servicesData[serviceIndex][key] = value;
        fs.writeFileSync(servicesJsonPath, JSON.stringify(servicesData, null, 4), 'utf8');
    }
}

/**
 * Reads sample-service.js, replaces the HTTP host, and returns modified content
 * @param {string} newHost - The new host to replace in the service
 * @returns {string} Modified service code with new host
 */
export function replaceHostInService(newHost) {
    const serviceFilePath = path.join(__dirname, 'sample-service.js');
    const serviceContent = fs.readFileSync(serviceFilePath, 'utf8');
    
    // Replace the httpServerHost line with the new host
    const modifiedContent = serviceContent.replace(
        /const httpServerHost = "[^"]*";/,
        `const httpServerHost = "${newHost}";`
    );
    
    // Write the modified content back to the file
    fs.writeFileSync(serviceFilePath, modifiedContent, 'utf8');
    
    // Update services.json
    updateServicesJson('Sample', 'ServiceHttpHost', newHost);
    
    return modifiedContent;
}

/**
 * Reads sample-service.js, replaces the HTTP port, and returns modified content
 * @param {number} newPort - The new port to replace in the service
 * @returns {string} Modified service code with new port
 */
export function replacePortInService(newPort) {
    const serviceFilePath = path.join(__dirname, 'sample-service.js');
    const serviceContent = fs.readFileSync(serviceFilePath, 'utf8');
    
    // Replace the httpServerPort line with the new port
    const modifiedContent = serviceContent.replace(
        /const httpServerPort = \d+;/,
        `const httpServerPort = ${newPort};`
    );
    
    // Write the modified content back to the file
    fs.writeFileSync(serviceFilePath, modifiedContent, 'utf8');
    
    // Update services.json
    updateServicesJson('Sample', 'ServiceHttpPort', newPort);
    
    return modifiedContent;
}

/**
 * Reads sample-service.js, replaces the privileged IP addresses, and returns modified content
 * @param {string[]} newIpList - Array of IP addresses to replace in the service
 * @returns {string} Modified service code with new privileged IP addresses
 */
export function replacePrivilegedIpsInService(newIpList) {
    const serviceFilePath = path.join(__dirname, 'sample-service.js');
    const serviceContent = fs.readFileSync(serviceFilePath, 'utf8');
    
    // Convert array to string format for replacementk
    const ipArrayString = `["${newIpList.join('", "')}"]`;
    
    // Replace the httpServerPrivilegedIpAddress line with the new IPs
    const modifiedContent = serviceContent.replace(
        /const httpServerPrivilegedIpAddress = \[.*?\];/,
        `const httpServerPrivilegedIpAddress = ${ipArrayString};`
    );
    
    // Write the modified content back to the file
    fs.writeFileSync(serviceFilePath, modifiedContent, 'utf8');
    
    // Update services.json
    updateServicesJson('Sample', 'ServiceHttpPriviledgedIpAddress', newIpList);
    
    return modifiedContent;
}

/**
 * Reads sample-service.js, replaces the CORS setting, and returns modified content
 * @param {boolean} enableCors - Boolean value to set CORS enabled or disabled
 * @returns {string} Modified service code with new CORS setting
 */
export function replaceCorsInService(enableCors) {
    const serviceFilePath = path.join(__dirname, 'sample-service.js');
    const serviceContent = fs.readFileSync(serviceFilePath, 'utf8');
    
    // Replace the enableCors line with the new value
    const modifiedContent = serviceContent.replace(
        /enableCors = (true|false)/,
        `enableCors = ${enableCors}`
    );
    
    // Write the modified content back to the file
    fs.writeFileSync(serviceFilePath, modifiedContent, 'utf8');
    
    return modifiedContent;
}

// Example usage for host replacement
replaceHostInService('127.0.0.1');
console.log('Host replaced successfully!');

// Example usage for port replacement
replacePortInService(9090);
console.log('Port replaced successfully!');

// Example usage for privileged IPs replacement
replacePrivilegedIpsInService(['192.168.0.1']);
console.log('Privileged IPs replaced successfully!');

// Example usage for CORS replacement
replaceCorsInService(true);
console.log('CORS setting replaced successfully!');