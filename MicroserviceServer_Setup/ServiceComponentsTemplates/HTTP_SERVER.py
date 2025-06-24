import asyncio
from fastapi import FastAPI
import uvicorn

from dotenv import load_dotenv
load_dotenv()


from fastapi.middleware.cors import CORSMiddleware


class HTTP_SERVER():
    def __init__(self, httpServerHost, httpServerPort, httpServerPrivilegedIpAddress=["127.0.0.1"], data_class_instance=None):
        self.app = FastAPI()
        self.host = httpServerHost
        self.port = httpServerPort

        self.privilegedIpAddress = httpServerPrivilegedIpAddress

        #<HTTP_SERVER_CORS_ADDITION_START>
        self.app.add_middleware(CORSMiddleware, allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"],)
        #<HTTP_SERVER_CORS_ADDITION_END>

        self.data_class = data_class_instance  # Reference to the Data class instance

    async def configure_routes(self):

        #<HTTP_SERVER_API_{/api/sample/}_START>

        #<HTTP_SERVER_ENDPOINT_{/api/sample/}_START>
        @self.app.get("/api/sample/")
        #<HTTP_SERVER_ENDPOINT_{/api/sample/}_END>

        #<HTTP_SERVER_FUNCTION_{/api/sample/}_START>
        async def get_api_sample():
            print("Running Through Someone Else")
            return {"message": "Hello World"}
        #<HTTP_SERVER_FUNCTION_{/api/sample/}_END>

        #<HTTP_SERVER_API_{/api/sample/}_END>

        #<HTTP_SERVER_NEW_API_START>
        #<HTTP_SERVER_NEW_API_END>

    async def run_app(self):
        config = uvicorn.Config(self.app, host=self.host, port=self.port)
        server = uvicorn.Server(config)
        await server.serve()

async def start_server():
    server = HTTP_SERVER('127.0.0.1', 8000,[])
    await server.RunServer()
    pass

# if __name__ == "__main__":
#     import asyncio
#     asyncio.run(start_server())