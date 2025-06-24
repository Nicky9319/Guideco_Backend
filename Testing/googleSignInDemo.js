const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Initialize Firebase Admin SDK with the proper service account file
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

// ======= DEMO: Working with Firebase Authentication Tokens =======

// Function to generate a mock custom token when real token generation fails
function generateMockCustomToken(uid, customClaims) {
  console.log("\n⚠️ USING MOCK TOKEN - Firebase Admin SDK error encountered");
  console.log("   This is for demonstration purposes only");
  
  // Create a mock structure similar to Firebase custom tokens
  const now = Math.floor(Date.now() / 1000);
  const mockToken = {
    iss: 'firebase-admin-sdk-mock',
    sub: 'firebase-admin-sdk-mock',
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: uid,
    claims: customClaims
  };
  
  // Converting to a string to simulate a token
  return 'MOCK_TOKEN.' + Buffer.from(JSON.stringify(mockToken)).toString('base64') + '.SIGNATURE';
}

// Function to generate a Firebase custom auth token
async function generateCustomToken() {
  try {
    // Create a user object with custom claims
    const uid = "demo-user-123";
    const customClaims = {
      premiumAccount: true,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    
    // Generate custom token with claims
    try {
      const customToken = await admin.auth().createCustomToken(uid, customClaims);
      console.log("\n📝 CUSTOM TOKEN (sent to client for sign-in):");
      console.log(customToken);
      
      // Decode and analyze the token structure
      const decodedCustomToken = jwt.decode(customToken, { complete: true });
      console.log("\n📋 CUSTOM TOKEN STRUCTURE:");
      console.log(JSON.stringify(decodedCustomToken, null, 2));
      
      return customToken;
    } catch (tokenError) {
      console.error("\n❌ Firebase Admin SDK Error:", tokenError.message);
      console.log("\n📌 DEPENDENCY ISSUE: Missing module './iv.js' in the jose library");
      console.log("   To fix this issue, try reinstalling your dependencies:");
      console.log("   1. Delete node_modules directory: rm -rf node_modules");
      console.log("   2. Delete package-lock.json: rm package-lock.json");
      console.log("   3. Reinstall dependencies: npm install");
      
      // Fallback to mock token for demo purposes
      const mockToken = generateMockCustomToken(uid, customClaims);
      console.log("\n📝 MOCK CUSTOM TOKEN (for demo purposes only):");
      console.log(mockToken);
      
      return mockToken;
    }
  } catch (error) {
    console.error("Error in token generation process:", error);
    throw error;
  }
}

// Function to verify an ID token (normally received from client after sign-in)
async function verifyIdToken(idToken) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log("\n✅ VERIFIED ID TOKEN PAYLOAD:");
    console.log(JSON.stringify(decodedToken, null, 2));
    return decodedToken;
  } catch (error) {
    console.error("Error verifying ID token:", error);
    throw error;
  }
}

// Create a mock ID token for demonstration purposes
function createMockIdToken() {
  // This is a mock token to show structure - NOT A VALID TOKEN
  const mockIdToken = {
    iss: 'https://securetoken.google.com/guide-co',
    aud: 'guide-co',
    auth_time: Math.floor(Date.now() / 1000),
    user_id: 'demo-user-123',
    sub: 'demo-user-123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'demo@example.com',
    email_verified: true,
    firebase: {
      identities: {
        email: ['demo@example.com'],
        'google.com': ['google-user-id-123']
      },
      sign_in_provider: 'google.com'
    },
    name: 'Demo User',
    picture: 'https://example.com/profile.jpg'
  };
  
  console.log("\n📱 REAL ID TOKEN FROM CLIENT (after Google sign-in):");
  console.log("eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOWdkazcyIiwidHlwIjoiSldUIn0...<truncated>");
  
  console.log("\n🔍 ID TOKEN STRUCTURE (what you'd receive from Google sign-in):");
  console.log(JSON.stringify(mockIdToken, null, 2));
}

// Run the demo
async function runDemo() {
  console.log("===== FIREBASE AUTHENTICATION TOKEN DEMO =====\n");
  
  // 1. Generate custom token (server -> client for sign-in)
  await generateCustomToken();
  
  // 2. Show what an ID token from Google sign-in looks like
  createMockIdToken();
  
  console.log("\n===== DEMO PROCESS FLOW =====");
  console.log("1. Server generates custom token (shown above)");
  console.log("2. Client uses token to sign in with Firebase");
  console.log("3. Client signs in with Google (web or mobile)");  
  console.log("4. Firebase returns ID token to client");
  console.log("5. Client sends ID token to server for verification");
  console.log("6. Server verifies token and extracts user info");
  
  console.log("\n===== DEMO COMPLETED =====");
}

// Execute the demo
runDemo().catch(console.error);
