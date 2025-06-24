clear

sudo docker stop rabbit-server
sleep 1

sudo docker run -d --rm --name rabbit-server -p 5672:5672 -p 15672:15672 rabbitmq:3-management
sleep 10

cd ../

# Start Node.js services

node service_MainServer/mainServer.js &
node service_AuthService/authService.js &
node service_PostgresService/postgresService.js

# Add other services as needed
