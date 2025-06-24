const fs = require('fs');
const path = require('path');
const babel = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class DataClassAnalyzer {
    constructor(ast, sourceCode) {
        this.ast = ast;
        this.sourceCode = sourceCode;
    }

    analyze() {
        const dataClassInfo = {
            className: null,
            constructor: null,
            methods: [],
            properties: [],
            codeSnippet: null
        };

        const self = this;
        traverse(this.ast, {
            ClassDeclaration(path) {
                if (path.node.id.name === 'Data') {
                    dataClassInfo.className = path.node.id.name;
                    
                    // Extract code snippet
                    const start = path.node.start;
                    const end = path.node.end;
                    dataClassInfo.codeSnippet = self.sourceCode.slice(start, end);
                    
                    path.traverse({
                        ClassMethod(methodPath) {
                            const method = {
                                name: methodPath.node.key.name,
                                kind: methodPath.node.kind,
                                params: methodPath.node.params.map(param => param.name),
                                isAsync: methodPath.node.async,
                                codeSnippet: self.sourceCode.slice(methodPath.node.start, methodPath.node.end)
                            };
                            
                            if (method.kind === 'constructor') {
                                dataClassInfo.constructor = method;
                            } else {
                                dataClassInfo.methods.push(method);
                            }
                        },
                        AssignmentExpression(assignPath) {
                            if (assignPath.node.left.type === 'MemberExpression' &&
                                assignPath.node.left.object.type === 'ThisExpression') {
                                dataClassInfo.properties.push({
                                    name: assignPath.node.left.property.name,
                                    value: assignPath.node.right.value || 'dynamic',
                                    codeSnippet: self.sourceCode.slice(assignPath.node.start, assignPath.node.end)
                                });
                            }
                        }
                    });
                }
            }
        });

        return dataClassInfo;
    }

    getCodeSnippet() {
        const result = this.analyze();
        return result.codeSnippet;
    }

    getConstructorInfo() {
        const result = this.analyze();
        return result.constructor;
    }

    getMethodsInfo() {
        const result = this.analyze();
        return result.methods;
    }

    getPropertiesInfo() {
        const result = this.analyze();
        return result.properties;
    }
}

class HTTPServerClassAnalyzer {
    constructor(ast, sourceCode) {
        this.ast = ast;
        this.sourceCode = sourceCode;
    }

    analyze() {
        const httpServerInfo = {
            className: null,
            constructor: null,
            methods: [],
            properties: [],
            routes: [],
            codeSnippet: null
        };

        const self = this;
        traverse(this.ast, {
            ClassDeclaration(path) {
                if (path.node.id.name === 'HTTP_SERVER') {
                    httpServerInfo.className = path.node.id.name;
                    
                    // Extract code snippet
                    const start = path.node.start;
                    const end = path.node.end;
                    httpServerInfo.codeSnippet = self.sourceCode.slice(start, end);
                    
                    path.traverse({
                        ClassMethod(methodPath) {
                            const method = {
                                name: methodPath.node.key.name,
                                kind: methodPath.node.kind,
                                params: methodPath.node.params.map(param => param.name),
                                isAsync: methodPath.node.async,
                                codeSnippet: self.sourceCode.slice(methodPath.node.start, methodPath.node.end)
                            };
                            
                            if (method.kind === 'constructor') {
                                httpServerInfo.constructor = method;
                            } else {
                                httpServerInfo.methods.push(method);
                            }
                        },
                        AssignmentExpression(assignPath) {
                            if (assignPath.node.left.type === 'MemberExpression' &&
                                assignPath.node.left.object.type === 'ThisExpression') {
                                httpServerInfo.properties.push({
                                    name: assignPath.node.left.property.name,
                                    type: assignPath.node.right.type,
                                    codeSnippet: self.sourceCode.slice(assignPath.node.start, assignPath.node.end)
                                });
                            }
                        },
                        CallExpression(callPath) {
                            if (callPath.node.callee.type === 'MemberExpression' &&
                                ['get', 'post', 'put', 'delete', 'patch'].includes(callPath.node.callee.property.name)) {
                                const route = {
                                    method: callPath.node.callee.property.name.toUpperCase(),
                                    path: callPath.node.arguments[0]?.value || 'dynamic',
                                    handler: 'function',
                                    codeSnippet: self.sourceCode.slice(callPath.node.start, callPath.node.end)
                                };
                                httpServerInfo.routes.push(route);
                            }
                        }
                    });
                }
            }
        });

        return httpServerInfo;
    }

    getCodeSnippet() {
        const result = this.analyze();
        return result.codeSnippet;
    }

    getRoutesInfo() {
        const result = this.analyze();
        return result.routes;
    }

    getServerConfiguration() {
        const result = this.analyze();
        return {
            constructor: result.constructor,
            properties: result.properties
        };
    }

    getServerMethods() {
        const result = this.analyze();
        return result.methods;
    }
}

class ServiceClassAnalyzer {
    constructor(ast, sourceCode) {
        this.ast = ast;
        this.sourceCode = sourceCode;
    }

    analyze() {
        const serviceInfo = {
            className: null,
            constructor: null,
            methods: [],
            properties: [],
            dependencies: [],
            codeSnippet: null
        };

        const self = this;
        traverse(this.ast, {
            ClassDeclaration(path) {
                if (path.node.id.name === 'Service') {
                    serviceInfo.className = path.node.id.name;
                    
                    // Extract code snippet
                    const start = path.node.start;
                    const end = path.node.end;
                    serviceInfo.codeSnippet = self.sourceCode.slice(start, end);
                    
                    path.traverse({
                        ClassMethod(methodPath) {
                            const method = {
                                name: methodPath.node.key.name,
                                kind: methodPath.node.kind,
                                params: methodPath.node.params.map(param => param.name),
                                isAsync: methodPath.node.async,
                                codeSnippet: self.sourceCode.slice(methodPath.node.start, methodPath.node.end)
                            };
                            
                            if (method.kind === 'constructor') {
                                serviceInfo.constructor = method;
                            } else {
                                serviceInfo.methods.push(method);
                            }
                        },
                        AssignmentExpression(assignPath) {
                            if (assignPath.node.left.type === 'MemberExpression' &&
                                assignPath.node.left.object.type === 'ThisExpression') {
                                serviceInfo.properties.push({
                                    name: assignPath.node.left.property.name,
                                    type: assignPath.node.right.type,
                                    codeSnippet: self.sourceCode.slice(assignPath.node.start, assignPath.node.end)
                                });
                            }
                        }
                    });
                }
            }
        });

        return serviceInfo;
    }

    getCodeSnippet() {
        const result = this.analyze();
        return result.codeSnippet;
    }

    getServiceDependencies() {
        const result = this.analyze();
        return result.constructor?.params || [];
    }

    getServiceMethods() {
        const result = this.analyze();
        return result.methods;
    }

    getServiceProperties() {
        const result = this.analyze();
        return result.properties;
    }
}

class StartServiceFunctionAnalyzer {
    constructor(ast, sourceCode) {
        this.ast = ast;
        this.sourceCode = sourceCode;
        this.partialAst = null;
        this.extractPartialAst();
    }

    extractPartialAst() {
        const self = this;
        traverse(this.ast, {
            FunctionDeclaration(path) {
                if (path.node.id.name === 'startService') {
                    self.partialAst = path.node;
                }
            }
        });
    }

    analyze() {
        const startServiceInfo = {
            name: null,
            params: [],
            isAsync: false,
            variables: [],
            functionCalls: [],
            instantiations: [],
            codeSnippet: null
        };

        const self = this;
        traverse(this.ast, {
            FunctionDeclaration(path) {
                if (path.node.id.name === 'startService') {
                    startServiceInfo.name = path.node.id.name;
                    startServiceInfo.params = path.node.params.map(param => param.name);
                    startServiceInfo.isAsync = path.node.async;
                    
                    // Extract code snippet
                    const start = path.node.start;
                    const end = path.node.end;
                    startServiceInfo.codeSnippet = self.sourceCode.slice(start, end);
                    
                    path.traverse({
                        VariableDeclarator(varPath) {
                            startServiceInfo.variables.push({
                                name: varPath.node.id.name,
                                type: varPath.node.init?.type || 'unknown',
                                value: varPath.node.init?.value || 'dynamic',
                                codeSnippet: self.sourceCode.slice(varPath.node.start, varPath.node.end)
                            });
                        },
                        NewExpression(newPath) {
                            startServiceInfo.instantiations.push({
                                className: newPath.node.callee.name,
                                arguments: newPath.node.arguments.length,
                                codeSnippet: self.sourceCode.slice(newPath.node.start, newPath.node.end)
                            });
                        },
                        CallExpression(callPath) {
                            const callInfo = {
                                codeSnippet: self.sourceCode.slice(callPath.node.start, callPath.node.end)
                            };
                            
                            if (callPath.node.callee.type === 'Identifier') {
                                Object.assign(callInfo, {
                                    name: callPath.node.callee.name,
                                    arguments: callPath.node.arguments.length
                                });
                            } else if (callPath.node.callee.type === 'MemberExpression') {
                                Object.assign(callInfo, {
                                    object: callPath.node.callee.object.name,
                                    method: callPath.node.callee.property.name,
                                    arguments: callPath.node.arguments.length
                                });
                            }
                            
                            startServiceInfo.functionCalls.push(callInfo);
                        }
                    });
                }
            }
        });

        return startServiceInfo;
    }

    replaceHttpServerHost(newHost) {
        if (!this.partialAst) return null;

        traverse(this.partialAst, {
            VariableDeclarator(path) {
                if (path.node.id.name === 'httpServerHost') {
                    path.node.init.value = newHost;
                    path.node.init.raw = `"${newHost}"`;
                }
            }
        }, null, this.partialAst);

        return this.partialAst;
    }

    replaceHttpServerPort(newPort) {
        if (!this.partialAst) return null;

        traverse(this.partialAst, {
            VariableDeclarator(path) {
                if (path.node.id.name === 'httpServerPort') {
                    path.node.init.value = newPort;
                    path.node.init.raw = newPort.toString();
                }
            }
        }, null, this.partialAst);

        return this.partialAst;
    }

    replacePrivilegedIp(newIpList) {
        if (!this.partialAst) return null;

        traverse(this.partialAst, {
            VariableDeclarator(path) {
                if (path.node.id.name === 'httpServerPrivilegedIpAddress') {
                    // Create new array elements
                    const newElements = newIpList.map(ip => ({
                        type: 'StringLiteral',
                        value: ip,
                        raw: `"${ip}"`
                    }));

                    // Replace the array expression
                    path.node.init.elements = newElements;
                }
            }
        }, null, this.partialAst);

        return this.partialAst;
    }

    updatePartialAst(newPartialAst) {
        this.partialAst = newPartialAst;
        return this.partialAst;
    }

    getPartialAst() {
        return this.partialAst;
    }

    getCodeSnippet() {
        const result = this.analyze();
        return result.codeSnippet;
    }

    getServiceConfiguration() {
        const result = this.analyze();
        return {
            variables: result.variables,
            instantiations: result.instantiations
        };
    }

    getServiceFlow() {
        const result = this.analyze();
        return result.functionCalls;
    }
}

class ASTAnalyzer {
    constructor(filePath) {
        this.filePath = filePath;
        this.ast = null;
        this.sourceCode = null;
        this.dataAnalyzer = null;
        this.httpServerAnalyzer = null;
        this.serviceAnalyzer = null;
        this.startServiceAnalyzer = null;
    }

    parseFile() {
        try {
            this.sourceCode = fs.readFileSync(this.filePath, 'utf8');
            this.ast = babel.parse(this.sourceCode, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            
            // Initialize specialized analyzers with source code
            this.dataAnalyzer = new DataClassAnalyzer(this.ast, this.sourceCode);
            this.httpServerAnalyzer = new HTTPServerClassAnalyzer(this.ast, this.sourceCode);
            this.serviceAnalyzer = new ServiceClassAnalyzer(this.ast, this.sourceCode);
            this.startServiceAnalyzer = new StartServiceFunctionAnalyzer(this.ast, this.sourceCode);
            
            this.storeASTInFile();
            return this.ast;
        } catch (error) {
            console.error('Error parsing file:', error);
            return null;
        }
    }

    storeASTInFile() {
        const astString = JSON.stringify(this.ast, null, 2);
        const outputPath = path.join(__dirname, 'parsed_ast.txt');
        fs.writeFileSync(outputPath, astString);
        console.log(`AST stored in: ${outputPath}`);
    }

    getDataClassInfo() {
        return this.dataAnalyzer.analyze();
    }

    getHTTPServerClassInfo() {
        return this.httpServerAnalyzer.analyze();
    }

    getServiceClassInfo() {
        return this.serviceAnalyzer.analyze();
    }

    getStartServiceInfo() {
        return this.startServiceAnalyzer.analyze();
    }

    analyzeAll() {
        console.log('=== AST Analysis Results ===\n');
        
        const dataClass = this.getDataClassInfo();
        console.log('Data Class Info:', JSON.stringify(dataClass, null, 2));
        
        const httpServer = this.getHTTPServerClassInfo();
        console.log('\nHTTP_SERVER Class Info:', JSON.stringify(httpServer, null, 2));
        
        const service = this.getServiceClassInfo();
        console.log('\nService Class Info:', JSON.stringify(service, null, 2));
        
        const startService = this.getStartServiceInfo();
        console.log('\nstartService Function Info:', JSON.stringify(startService, null, 2));
        
        return {
            dataClass,
            httpServer,
            service,
            startService
        };
    }

    // Convenience methods for accessing specific analyzer functionality
    getRoutes() {
        return this.httpServerAnalyzer.getRoutesInfo();
    }

    getDataMethods() {
        return this.dataAnalyzer.getMethodsInfo();
    }

    getServiceDependencies() {
        return this.serviceAnalyzer.getServiceDependencies();
    }

    getServiceConfiguration() {
        return this.startServiceAnalyzer.getServiceConfiguration();
    }

    // New methods to get code snippets
    getDataClassCode() {
        return this.dataAnalyzer.getCodeSnippet();
    }

    getHTTPServerClassCode() {
        return this.httpServerAnalyzer.getCodeSnippet();
    }

    getServiceClassCode() {
        return this.serviceAnalyzer.getCodeSnippet();
    }

    getStartServiceCode() {
        return this.startServiceAnalyzer.getCodeSnippet();
    }

    extractAllCodeSnippets() {
        return {
            dataClass: this.getDataClassCode(),
            httpServer: this.getHTTPServerClassCode(),
            service: this.getServiceClassCode(),
            startService: this.getStartServiceCode()
        };
    }

    saveCodeSnippetsToFiles() {
        const snippets = this.extractAllCodeSnippets();
        const outputDir = path.join(__dirname, 'extracted_code');
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        fs.writeFileSync(path.join(outputDir, 'DataClass.js'), snippets.dataClass || '// Data class not found');
        fs.writeFileSync(path.join(outputDir, 'HTTPServer.js'), snippets.httpServer || '// HTTP_SERVER class not found');
        fs.writeFileSync(path.join(outputDir, 'Service.js'), snippets.service || '// Service class not found');
        fs.writeFileSync(path.join(outputDir, 'StartService.js'), snippets.startService || '// startService function not found');
        
        console.log(`Code snippets saved to: ${outputDir}`);
    }
}

module.exports = {
    ASTAnalyzer,
    DataClassAnalyzer,
    HTTPServerClassAnalyzer,
    ServiceClassAnalyzer,
    StartServiceFunctionAnalyzer
};
console.log('\nHTTP Server Code:\n', codeSnippets.httpServer);
console.log('\nService Class Code:\n', codeSnippets.service);
console.log('\nStart Service Code:\n', codeSnippets.startService);

// Save snippets to separate files
analyzer.saveCodeSnippetsToFiles();

module.exports = {
    ASTAnalyzer,
    DataClassAnalyzer,
    HTTPServerClassAnalyzer,
    ServiceClassAnalyzer,
    StartServiceFunctionAnalyzer
};
