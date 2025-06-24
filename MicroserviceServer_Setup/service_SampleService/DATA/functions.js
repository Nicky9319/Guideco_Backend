import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_CLASS_PATH = path.join(__dirname, 'data-class.js');

export function addNewVariable(variableName, defaultValue = null) {
    // Read the current data-class.js file
    let sourceCode = fs.readFileSync(DATA_CLASS_PATH, 'utf8');
    
    // Check if variable already exists in constructor
    const constructorPropertyRegex = new RegExp(`this\\.${variableName}\\s*=`);
    if (constructorPropertyRegex.test(sourceCode)) {
        console.log(`Variable '${variableName}' already exists in the Data class`);
        return;
    }
    
    // Check if getter method already exists
    const getterMethodRegex = new RegExp(`get_${variableName}\\(\\)`);
    if (getterMethodRegex.test(sourceCode)) {
        console.log(`Getter method 'get_${variableName}' already exists in the Data class`);
        return;
    }
    
    // Check if setter method already exists
    const setterMethodRegex = new RegExp(`set_${variableName}\\(`);
    if (setterMethodRegex.test(sourceCode)) {
        console.log(`Setter method 'set_${variableName}' already exists in the Data class`);
        return;
    }
    
    // Format the default value
    let formattedDefaultValue;
    if (defaultValue === null) {
        formattedDefaultValue = 'null';
    } else if (typeof defaultValue === 'string') {
        formattedDefaultValue = `'${defaultValue}'`;
    } else if (Array.isArray(defaultValue)) {
        formattedDefaultValue = JSON.stringify(defaultValue);
    } else {
        formattedDefaultValue = String(defaultValue);
    }
    
    // Add property to constructor with proper this. prefix
    const constructorProperty = `    this.${variableName} = ${formattedDefaultValue};`;
    
    // Handle both empty constructor and constructor with existing content
    if (sourceCode.includes('constructor() {}')) {
        // Empty constructor - replace with constructor containing the new property
        sourceCode = sourceCode.replace(
            /constructor\(\) {}/,
            `constructor() {\n${constructorProperty}\n  }`
        );
    } else {
        // Constructor with existing content - add to the end
        sourceCode = sourceCode.replace(
            /(constructor\(\)\s*{[\s\S]*?)(  })/,
            `$1\n${constructorProperty}\n$2`
        );
    }
    
    // Create getter method
    const getterMethod = `    get_${variableName}() {
        return this.${variableName};
    }`;
    
    // Create setter method
    const setterMethod = `    set_${variableName}(value) {
        this.${variableName} = value;
    }`;
    
    // Add methods before the closing brace of the class
    sourceCode = sourceCode.replace(
        /(\n})(\n\nexport default Data;)/,
        `${getterMethod}\n${setterMethod}\n$1$2`
    );
    
    // Write the modified code back to the file
    fs.writeFileSync(DATA_CLASS_PATH, sourceCode);
    
    console.log(`Added variable '${variableName}' with getter/setter methods to Data class`);
}

export function removeVariable(variableName) {
    // Read the current data-class.js file
    let sourceCode = fs.readFileSync(DATA_CLASS_PATH, 'utf8');
    
    // Check if variable exists in constructor
    const constructorPropertyRegex = new RegExp(`\\s*this\\.${variableName}\\s*=.*?;\\n?`);
    if (!constructorPropertyRegex.test(sourceCode)) {
        console.log(`Variable '${variableName}' does not exist in the Data class`);
        return;
    }
    
    // Remove property from constructor
    sourceCode = sourceCode.replace(constructorPropertyRegex, '');
    
    // Remove getter method
    const getterMethodRegex = new RegExp(`\\s*get_${variableName}\\(\\)\\s*{[\\s\\S]*?}\\n?`, 'g');
    sourceCode = sourceCode.replace(getterMethodRegex, '');
    
    // Remove setter method
    const setterMethodRegex = new RegExp(`\\s*set_${variableName}\\([^)]*\\)\\s*{[\\s\\S]*?}\\n?`, 'g');
    sourceCode = sourceCode.replace(setterMethodRegex, '');
    
    // Write the modified code back to the file
    fs.writeFileSync(DATA_CLASS_PATH, sourceCode);
    
    console.log(`Removed variable '${variableName}' and its getter/setter methods from Data class`);
}

// Example usage
removeVariable('newValue');
// removeVariable('newValue', []);
// removeVariable('taxesPaids'); // Uncomment to test removal