from fastapi import FastAPI
import httpx

app = FastAPI(title="Mini Shop")


@app.get("/")
def home():
    return {"message": "Mini Shop running"}


@app.post("/buy")
def buy(item: dict):
    # For demo: call gateway init endpoint if available
    gateway_url = "http://gateway:8000/api/checkout/init"
    try:
        with httpx.Client(timeout=5.0) as c:
            resp = c.post(gateway_url, json=item)
            return {"gateway_response": resp.json()}
    except Exception as e:
        return {"error": str(e)}
