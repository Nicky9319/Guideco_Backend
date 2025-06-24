const express = require('express');
const http = require('http');
const { Double } = require('mongodb');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);


/* 
Convert the Active Users from list to a dictionary and map the state of the user their,
so when the user is there in the waiting list then we can update its state and when the person is active and chatting we can update their state
using this we dont have to create multiple lists for active users and waiting users, we can just use the same list and update the state of the user
*/




let activeUsers = [];
let activeMentors = [];

let freeChatMentorUserMap = {};


// Serve a simple homepage
app.get('/', (req, res) => {
    res.send('WebSocket server is running.');
});

// Socket.IO connection handler
io.on('connection', (socket) => {
    // Access headers from the handshake
    const headers = socket.handshake.headers;
    // console.log('New connection:', socket.id);
    // console.log('Headers:', headers);

    // Example: categorize user by a custom header 'x-persona'
    const persona = headers['x-persona'] || 'unknown';
    console.log(`A new connection: ${socket.id}, persona: ${persona}`);

    if (persona == "user") {
        activeUsers.push(socket.id);
        console.log(`User connected: ${socket.id}`);

        socket.on('wait-free-chat', (data) => {
            console.log("Free Chat from User");
            const { username, gender, dob } = data;
            console.log(username)
            console.log(dob)
            console.log(gender)

            const waitForMentor = () => {
                if (activeMentors.length === 0) {
                    console.log("No mentors available, retrying in 3 seconds...");
                    setTimeout(waitForMentor, 3000);
                } else {
                    // Proceed when at least one mentor is available
                    console.log("Mentor available, proceeding...");

                    for (let i = 0; i < activeMentors.length; i++) {
                        const mentorId = activeMentors[i];
                        console.log(`Mentor ${mentorId} is available for User ${socket.id}`);
                        // Emit the message to the specific mentor
                        io.to(mentorId).emit('user-wait-free-chat', {
                            userId: socket.id,
                            username: username,
                        });
                    }
                };
            }
            waitForMentor();
        });


        socket.on('send-msg-to-mentor', (data) => {
            const { id, text, sender, time, mentorId } = data;
            console.log(`User ${socket.id} sent message to Mentor ${mentorId}: ${text}`);
            // Emit the message to the specific mentor
            io.to(mentorId).emit('user-msg', {
                id: id,
                text: text,
                sender: sender,
                time: time,
                userId: socket.id
            });
        });


    }
    else if (persona == "mentor") {
        activeMentors.push(socket.id);
        console.log(`Mentor connected: ${socket.id}`);

        socket.on('start-free-chat-with-user', (data) => {
            const { userId } = data;
            console.log(`Mentor ${socket.id} started free chat with User ${userId}`);
            // Emit the message to the specific user
            io.to(userId).emit('start-free-chat', {
                mentorId: socket.id
            });

            freeChatMentorUserMap[socket.id] = userId;
        });

        socket.on('send-msg-to-user', (data) => {
            const { id, text, sender, time, userId } = data;
            console.log(`Mentor ${socket.id} sent message to User ${userId}: ${text}`);
            // Emit the message to the specific user
            io.to(userId).emit('mentor-msg', {
                id: id,
                text: text,
                sender: sender,
                time: time,
                mentorId: socket.id
            });
        });

    }
    else {
        console.log(`Unknown persona connected: ${socket.id}`);
        socket.disconnect(true);
    }



    socket.on('disconnect', () => {
        console.log(`Connection closed: ${socket.id}, persona: ${persona}`);
        if (persona == "user") {
            activeUsers = activeUsers.filter(user => user !== socket.id);
        }
        else if (persona == "mentor") {
            activeMentors = activeMentors.filter(mentor => mentor !== socket.id);
            if (freeChatMentorUserMap[socket.id]) {
                const userId = freeChatMentorUserMap[socket.id];
                delete freeChatMentorUserMap[socket.id];
                io.to(userId).emit('mentor-disconnected', {
                    mentorId: socket.id
                });
            }
        }
    });
});


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces by default
server.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
});