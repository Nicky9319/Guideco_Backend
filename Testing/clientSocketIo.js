const { response } = require('express');
const io = require('socket.io-client');

// Replace with your server URL
const SERVER_URL = 'http://localhost:8000';

// Authentication data
const authData = {
    PERSONA : "USER",
    USER_ID : "2790fon3bviyuinuoqipfh93br3u"
};

// Connect to the server with authentication data
const socket = io(SERVER_URL, {
    auth : authData
});

socket.on('connect', () => {
    console.log('Connected to server');
    
    // Emit a custom event to the server after connection
    socket.emit('SEND_MESSAGE_TO_COACH', {
        MESSAGE : "Hhello",
        TYPE : "TEXT"
    },(response) => {
        console.log('Response from server:', response);
    }
    );
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

// Listen for a custom event from the server
socket.on('GET_SID', (data) => {
    console.log('Received SID :', data);
});