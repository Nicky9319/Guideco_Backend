const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { ASTAnalyzer } = require('./ast.js');
const babel = require('@babel/parser');
const generate = require('@babel/generator').default;

class ServiceModifier {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.testServicePath = path.join(__dirname, 'test-service.js');
        this.analyzer = null;
    }

    async getUserInput() {
        const config = {};
        
        config.host = await this.question('Enter HTTP Server Host (current: "127.0.0.1"): ') || "127.0.0.1";
        config.port = await this.question('Enter HTTP Server Port (current: 8080): ') || "8080";
        
        const ipInput = await this.question('Enter Privileged IP Addresses (comma-separated, current: "127.0.0.1"): ') || "127.0.0.1";
        config.privilegedIps = ipInput.split(',').map(ip => ip.trim());
        
        return config;
    }

    question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async modifyService() {
        try {
            console.log('Reading test-service.js file...');
            
            // Initialize AST analyzer with test service file
            this.analyzer = new ASTAnalyzer(this.testServicePath);
            this.analyzer.parseFile();
            
            console.log('Current configuration extracted from file:');
            const currentConfig = this.analyzer.getServiceConfiguration();
            console.log(JSON.stringify(currentConfig, null, 2));
            
            // Get user input for new configuration
            console.log('\nEnter new configuration values:');
            const newConfig = await this.getUserInput();
            
            console.log('\nNew configuration:');
            console.log('Host:', newConfig.host);
            console.log('Port:', newConfig.port);
            console.log('Privileged IPs:', newConfig.privilegedIps);
            
            // Modify the AST
            const startServiceAnalyzer = this.analyzer.startServiceAnalyzer;
            
            // Replace values in the partial AST
            startServiceAnalyzer.replaceHttpServerHost(newConfig.host);
            startServiceAnalyzer.replaceHttpServerPort(parseInt(newConfig.port));
            startServiceAnalyzer.replacePrivilegedIp(newConfig.privilegedIps);
            
            // Get the modified partial AST
            const modifiedPartialAst = startServiceAnalyzer.getPartialAst();
            
            // Generate new code from the complete AST
            const newCode = this.generateModifiedCode(modifiedPartialAst);
            
            // Write the modified code back to the file
            fs.writeFileSync(this.testServicePath, newCode);
            
            console.log('\nService file has been successfully modified!');
            console.log(`Updated file: ${this.testServicePath}`);
            
        } catch (error) {
            console.error('Error modifying service:', error);
        } finally {
            this.rl.close();
        }
    }

    generateModifiedCode(modifiedStartServiceAst) {
        try {
            // Read the original source code
            const originalCode = fs.readFileSync(this.testServicePath, 'utf8');
            
            // Parse the original AST
            const originalAst = babel.parse(originalCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            
            // Find and replace the startService function in the original AST
            const traverse = require('@babel/traverse').default;
            
            traverse(originalAst, {
                FunctionDeclaration(path) {
                    if (path.node.id.name === 'startService') {
                        // Replace the entire function node
                        path.replaceWith(modifiedStartServiceAst);
                    }
                }
            });
            
            // Generate code from the modified AST
            const generatedCode = generate(originalAst, {
                retainLines: false,
                compact: false,
                concise: false
            });
            
            return generatedCode.code;
        } catch (error) {
            console.error('Error generating modified code:', error);
            throw error;
        }
    }

    async displayCurrentAndNewValues() {
        console.log('\n=== Current vs New Configuration ===');
        
        const currentAnalyzer = new ASTAnalyzer(this.testServicePath);
        currentAnalyzer.parseFile();
        const currentVars = currentAnalyzer.getServiceConfiguration().variables;
        
        console.log('\nCurrent values:');
        currentVars.forEach(variable => {
            console.log(`${variable.name}: ${variable.value}`);
        });
        
        console.log('\nNew values will be applied after modification.');
    }
}

// Main execution
async function main() {
    console.log('=== Service Configuration Modifier ===\n');
    
    const modifier = new ServiceModifier();
    
    // Check if test-service.js exists
    if (!fs.existsSync(modifier.testServicePath)) {
        console.error('test-service.js not found!');
        return;
    }
    
    await modifier.displayCurrentAndNewValues();
    await modifier.modifyService();
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ServiceModifier;
