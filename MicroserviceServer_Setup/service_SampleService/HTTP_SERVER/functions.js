import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';

/**
 * Service name configuration - modify this value as needed
 * @type {string}
 */
const SERVICE_NAME = 'sample';

/**
 * Adds a new API route to the HTTP server class file
 * @param {string} remainingUrl - Remaining part of the URL after service name
 * @param {string} method - HTTP method (get, post, put, delete, etc.)
 */
export function addApiRoute(remainingUrl, method = 'get') {
    const filePath = path.join(process.cwd(), 'service_SampleService', 'HTTP_SERVER', 'http-server-class.js');
    
    try {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Construct URL following the convention /api/{ServiceName}/{RemainingUrl}
        const cleanRemainingUrl = remainingUrl.startsWith('/') ? remainingUrl.slice(1) : remainingUrl;
        const apiUrl = `/api/${SERVICE_NAME}/${cleanRemainingUrl}`.replace(/\/+/g, '/').replace(/\/$/, '') || `/api/${SERVICE_NAME}/`;
        
        // Create the new API route code
        const newApiCode = `
        // ${apiUrl} endpoint
        this.app.${method.toLowerCase()}('${apiUrl}', (req, res) => {
            console.log("API Called");
            res.json({ message: "API Response" });
        });`;
        
        // Find the location to insert the new API (before "// Add new APIs here if needed")
        const insertMarker = '// Add new APIs here if needed';
        const insertIndex = fileContent.indexOf(insertMarker);
        
        if (insertIndex !== -1) {
            // Insert the new API code before the marker
            fileContent = fileContent.slice(0, insertIndex) + newApiCode + '\n\n        ' + fileContent.slice(insertIndex);
            
            // Write back to file
            fs.writeFileSync(filePath, fileContent, 'utf8');
            console.log(`API route added: ${method.toUpperCase()} ${apiUrl}`);
        } else {
            throw new Error('Could not find insertion point in the file');
        }
    } catch (error) {
        console.error('Error adding API route:', error.message);
        throw error;
    }
}

/**
 * Removes an existing API route from the HTTP server class file using AST parsing
 * @param {string} url - URL of the route to remove (e.g., '/api/sample/')
 */
export function removeApiRoute(url) {
    const filePath = path.join(process.cwd(), 'service_SampleService', 'HTTP_SERVER', 'http-server-class.js');
    
    try {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Parse the file into an AST
        const ast = parse(fileContent, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
        });
        
        let routeFound = false;
        let commentToRemove = null;
        
        // Traverse the AST to find and remove the API route
        traverse.default(ast, {
            CallExpression(path) {
                // Look for this.app.method() calls
                if (
                    path.node.callee &&
                    path.node.callee.type === 'MemberExpression' &&
                    path.node.callee.object &&
                    path.node.callee.object.type === 'MemberExpression' &&
                    path.node.callee.object.object &&
                    path.node.callee.object.object.type === 'ThisExpression' &&
                    path.node.callee.object.property &&
                    path.node.callee.object.property.name === 'app' &&
                    path.node.arguments &&
                    path.node.arguments.length >= 2 &&
                    path.node.arguments[0].type === 'StringLiteral' &&
                    path.node.arguments[0].value === url
                ) {
                    // Find the comment above this route
                    const leadingComments = path.node.leadingComments;
                    if (leadingComments && leadingComments.length > 0) {
                        const lastComment = leadingComments[leadingComments.length - 1];
                        if (lastComment.value.includes(`${url} endpoint`)) {
                            commentToRemove = lastComment;
                        }
                    }
                    
                    // Remove the entire expression statement
                    if (path.parent.type === 'ExpressionStatement') {
                        path.parentPath.remove();
                        routeFound = true;
                    }
                }
            }
        });
        
        if (routeFound) {
            // Generate code from the modified AST
            const output = generate.default(ast, {
                retainLines: true,
                comments: true
            });
            
            let modifiedCode = output.code;
            
            // Remove the comment manually if it wasn't removed by AST
            if (commentToRemove) {
                const commentPattern = new RegExp(
                    `\\s*// ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} endpoint\\s*\\n`,
                    'g'
                );
                modifiedCode = modifiedCode.replace(commentPattern, '\n');
            }
            
            // Clean up extra blank lines
            modifiedCode = modifiedCode.replace(/\n{3,}/g, '\n\n');
            
            // Write back to file
            fs.writeFileSync(filePath, modifiedCode, 'utf8');
            console.log(`API route removed: ${url}`);
        } else {
            console.warn(`API route not found: ${url}`);
        }
    } catch (error) {
        console.error('Error removing API route:', error.message);
        
        // Fallback to simple regex-based removal if AST parsing fails
        try {
            let fileContent = fs.readFileSync(filePath, 'utf8');
            const lines = fileContent.split('\n');
            const newLines = [];
            let skipLines = false;
            let braceCount = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Check if this line starts the API route we want to remove
                if (line.includes(`// ${url} endpoint`)) {
                    skipLines = true;
                    continue;
                }
                
                if (skipLines) {
                    // Count braces to know when the function ends
                    for (const char of line) {
                        if (char === '{') braceCount++;
                        if (char === '}') braceCount--;
                    }
                    
                    // If we've closed all braces and found the ending });
                    if (braceCount === 0 && line.includes('});')) {
                        skipLines = false;
                        continue;
                    }
                    continue;
                }
                
                newLines.push(line);
            }
            
            const modifiedContent = newLines.join('\n');
            fs.writeFileSync(filePath, modifiedContent, 'utf8');
            console.log(`API route removed (fallback method): ${url}`);
        } catch (fallbackError) {
            console.error('Fallback removal also failed:', fallbackError.message);
            throw error;
        }
    }
}

/**
 * Gets a list of all API routes from the HTTP server class file
 * @returns {Array} Array of API route objects
 */
export function getAllApiRoutes() {
    const filePath = path.join(process.cwd(), 'service_SampleService', 'HTTP_SERVER', 'http-server-class.js');
    
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const routes = [];
        
        // Regex to find all API routes in the format: this.app.method('url', ...)
        const apiPattern = /this\.app\.([a-z]+)\('([^']+)'[^}]*\}/g;
        let match;
        
        while ((match = apiPattern.exec(fileContent)) !== null) {
            const method = match[1].toUpperCase();
            const url = match[2];
            
            // Extract service name and remaining URL from the path
            const urlParts = url.split('/').filter(part => part);
            let serviceName = '';
            let remainingUrl = '';
            
            if (urlParts.length >= 2 && urlParts[0] === 'api') {
                serviceName = urlParts[1];
                remainingUrl = urlParts.slice(2).join('/');
            }
            
            routes.push({
                url: url,
                method: method,
                serviceName: serviceName,
                remainingUrl: remainingUrl
            });
        }
        
        return routes;
    } catch (error) {
        console.error('Error reading API routes:', error.message);
        throw error;
    }
}

/**
 * Updates an existing API route's URL
 * @param {string} existingUrl - Current URL of the route to update
 * @param {string} newUrl - New URL to replace the existing one
 */
export function updateApiRouteUrl(existingUrl, newUrl) {
    const filePath = path.join(process.cwd(), 'service_SampleService', 'HTTP_SERVER', 'http-server-class.js');
    
    try {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Find and update the comment line
        const lines = fileContent.split('\n');
        let commentLineFound = -1;
        let routeLineFound = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Find the comment line
            if (line.includes(`// ${existingUrl} endpoint`)) {
                commentLineFound = i;
                lines[i] = line.replace(`// ${existingUrl} endpoint`, `// ${newUrl} endpoint`);
            }
            
            // Find the route line
            if (line.includes(`this.app.`) && line.includes(`('${existingUrl}'`)) {
                routeLineFound = i;
                lines[i] = line.replace(`('${existingUrl}'`, `('${newUrl}'`);
            }
        }
        
        if (commentLineFound !== -1 || routeLineFound !== -1) {
            const updatedContent = lines.join('\n');
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`API route URL updated: ${existingUrl} -> ${newUrl}`);
        } else {
            console.warn(`API route not found: ${existingUrl}`);
        }
    } catch (error) {
        console.error('Error updating API route URL:', error.message);
        throw error;
    }
}

/**
 * Updates an existing API route's HTTP method
 * @param {string} url - URL of the route to update
 * @param {string} newMethod - New HTTP method (get, post, put, delete, etc.)
 */
export function updateApiRouteMethod(url, newMethod) {
    const filePath = path.join(process.cwd(), 'service_SampleService', 'HTTP_SERVER', 'http-server-class.js');
    
    try {
        let fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Find the line containing the API route and extract the current method
        const lines = fileContent.split('\n');
        let foundLine = -1;
        let currentMethod = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for the line that contains this.app.method(url
            if (line.includes(`this.app.`) && line.includes(`('${url}'`)) {
                foundLine = i;
                // Extract current method from the line
                const methodMatch = line.match(/this\.app\.([a-z]+)\(/);
                if (methodMatch) {
                    currentMethod = methodMatch[1];
                }
                break;
            }
        }
        
        if (foundLine !== -1 && currentMethod) {
            // Replace the method in that specific line
            const oldLine = lines[foundLine];
            const newLine = oldLine.replace(
                `this.app.${currentMethod}(`,
                `this.app.${newMethod.toLowerCase()}(`
            );
            lines[foundLine] = newLine;
            
            const updatedContent = lines.join('\n');
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            console.log(`API route method updated: ${url} -> ${newMethod.toUpperCase()}`);
        } else {
            console.warn(`API route not found: ${url}`);
        }
    } catch (error) {
        console.error('Error updating API route method:', error.message);
        throw error;
    }
}

