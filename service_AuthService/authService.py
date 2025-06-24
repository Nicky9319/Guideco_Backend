import asyncio
from fastapi import FastAPI, Response, Request
import uvicorn

import asyncio
import aio_pika


import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "../ServiceTemplates/Basic"))


from HTTP_SERVER import HTTPServer
from MESSAGE_QUEUE import MessageQueue

class Service():
    def __init__(self,httpServerHost, httpServerPort):
        self.messageQueue = MessageQueue("amqp://guest:guest@localhost/","/")
        self.httpServer = HTTPServer(httpServerHost, httpServerPort)


    async def ConfigureAPIRoutes(self):
        @self.httpServer.app.post("Auth/Google")
        async def googleAuthentication(request: Request):
            pass

        @self.httpServer.app.post("Auth/Facebook")
        async def facebookAuthentication(request: Request):
            pass

        @self.httpServer.app.post("Auth/Truecaller")
        async def truecallerAuthentication(request: Request):
            pass
    

    async def startService(self):
        await self.messageQueue.InitializeConnection()
        # await self.messageQueue.AddQueueAndMapToCallback("queue1", self.fun1)
        # await self.messageQueue.AddQueueAndMapToCallback("queue2", self.fun2)
        # await self.messageQueue.StartListeningToQueue()

        await self.ConfigureAPIRoutes()
        await self.httpServer.run_app()

        
async def start_service():
    service = Service('127.0.0.1', 8000)
    await service.startService()

# if __name__ == "__main__":
#     asyncio.run(start_service())
