/home/Avatar/bin/python3.12 StopServer.py

clear

sudo docker stop rabbit-server
sleep 2

sudo docker run -d --rm --name rabbit-server -p 5672:5672 -p 15672:15672 rabbitmq:3-management
sleep 10


cd ../
pwd

node service_MainServer/mainServer.js &
node service_AuthService/authService.js &
node service_PostgresService/postgresService.js

# Mention the Environment you want to start along with the Services
# Example: /home/Avatar/Avatar_Env/bin/python3.12 service_MainServer/mainServer.py &
#          /home/Avatar/Avatar_Env/bin/python3.12 service_LogService/loggingService.py 
