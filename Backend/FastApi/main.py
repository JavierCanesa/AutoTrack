from fastapi import FastAPI

from FastApi.routers import service_types

app = FastAPI(title="AutoTrack API", version="1.0.0")
app.include_router(service_types.router)


@app.get("/")
def root():
    return {"message": "AutoTrack API funcionando"}
