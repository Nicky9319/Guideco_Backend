import socketio
from aiohttp import web
import asyncio

import asyncio
from fastapi import FastAPI, Response, Request
import uvicorn

import asyncio
import aio_pika
import json
import time


import sys
import os


sys.path.append(os.path.join(os.path.dirname(__file__), "../ServiceTemplates/Basic"))


from HTTP_SERVER import HTTPServer
from MESSAGE_QUEUE import MessageQueue
from WS_SERVER import WebSocketServer


class Service:
    def __init__(self, wsServerHost, wsServerPort, httpServerHost, httpServerPort):
        self.messageQueue = MessageQueue("amqp://guest:guest@localhost/","/")
        self.httpServer = HTTPServer(httpServerHost, httpServerPort)
        self.wsServer = WebSocketServer(wsServerHost, wsServerPort)

        self.connectUserList = {}



    async def ConfigureHTTPserverRoutes(self):
        @self.httpServer.app.post("Auth/Google")
        async def googleAuthentication(request: Request):
            pass

        @self.httpServer.app.post("Auth/Facebook")
        async def facebookAuthentication(request: Request):
            pass

        @self.httpServer.app.post("Auth/Truecaller")
        async def truecallerAuthentication(request: Request):
            pass

    
    async def ConfigureWSserverMethods(self):
        @self.wsServer.sio.event
        async def connect(sid, environ , auth=None):
            if auth:
                userID = auth["USER_ID"]
            self.connectUserList[sid] = userID

        @self.wsServer.sio.event
        async def disconnect(sid):
            del self.connectUserList[sid]
        
        @self.wsServer.sio.on("SendMessage")
        async def sendMessage(sid):
            pass
    

    async def startService(self):
        await self.messageQueue.InitializeConnection()
        # await self.messageQueue.AddQueueAndMapToCallback("queue1", self.fun1)
        # await self.messageQueue.AddQueueAndMapToCallback("queue2", self.fun2)
        # await self.messageQueue.BoundQueueToExchange()
        # await self.messageQueue.StartListeningToQueue()

        await self.ConfigureWSserverMethods()
        await self.wsServer.start()

        await self.ConfigureHTTPserverRoutes()
        await self.httpServer.run_app()

async def start_service():
    service = Service('127.0.0.1',5001, '127.0.0.1', 5000)
    await service.startService()

if __name__ == "__main__":
    asyncio.run(start_service())