import os
import json
import time
import requests
from flask import Flask, render_template, request, jsonify, redirect, url_for
from dotenv import load_dotenv

# .env ফাইল থেকে এনভায়রনমেন্ট ভেরিয়েবল লোড করা
load_dotenv()

app = Flask(__name__)

PORT = int(os.getenv("PORT", 8002))
STORE_ID = os.getenv("STORE_ID", "STORE1001")
STORE_API_KEY = os.getenv("STORE_API_KEY", "mk_test_12345")
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8000")
ENABLE_MOCK_GATEWAY = os.getenv("ENABLE_MOCK_GATEWAY", "true").lower() == "true"

# JSON ফাইল রিড/রাইট হেলপার ফাংশন
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
ORDERS_FILE = os.path.join(DATA_DIR, "orders.json")

def load_json(filepath):
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)
    except (json.JSONDecodeError, Exception):
        return []

def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

# ==================== Backend Routes ====================

# ১. হোম পেজ (প্রোডাক্ট শোকেস)
@app.route("/")
def index():
    products = load_json(PRODUCTS_FILE)
    return render_template("index.html", products=products)

# ২. অর্ডার তৈরি ও চেকআউট ইনিশিয়ালাইজেশন
@app.route("/orders", methods=["POST"])
def create_order():
    product_id = request.form.get("product_id")
    buyer_name = request.form.get("buyer_name", "Customer")
    buyer_email = request.form.get("buyer_email", "customer@example.com")

    products = load_json(PRODUCTS_FILE)
    product = next((p for p in products if p["id"] == product_id), None)
    
    if not product:
        return jsonify({"error": "Product not found"}), 404

    # ইউনিক অর্ডার ও ইনভয়েস আইডি জেনারেট
    timestamp = int(time.time())
    order_id = f"ORD-{timestamp}"
    invoice_id = f"INV-{timestamp}"
    amount = product["price"]

    # নতুন অর্ডার অবজেক্ট (স্ট্যাটাস: pending)
    new_order = {
        "id": order_id,
        "invoice_id": invoice_id,
        "product_id": product_id,
        "product_name": product["name"],
        "buyer_name": buyer_name,
        "buyer_email": buyer_email,
        "amount": amount,
        "status": "pending",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    orders = load_json(ORDERS_FILE)
    orders.append(new_order)
    save_json(ORDERS_FILE, orders)

    # মক মোড বনাম আসল গেটওয়ে লজিক
    if ENABLE_MOCK_GATEWAY:
        # টিমেটদের গেটওয়ে ছাড়াই একা টেস্ট করার মক লিংক
        checkout_url = f"/mock-gateway/{invoice_id}"
    else:
        # টিমেটদের আসল পেমেন্ট গেটওয়ে API কল
        success_url = f"http://localhost:{PORT}/success?invoice_id={invoice_id}"
        fail_url = f"http://localhost:{PORT}/fail?invoice_id={invoice_id}"
        
        payload = {
            "store_id": STORE_ID,
            "api_key": STORE_API_KEY,
            "order_id": order_id,
            "amount": amount,
            "success_url": success_url,
            "fail_url": fail_url
        }
        
        try:
            res = requests.post(f"{GATEWAY_URL}/api/checkout/init", json=payload, timeout=5)
            data = res.json()
            checkout_url = data.get("checkout_url", f"/fail?invoice_id={invoice_id}")
        except Exception as e:
            print(f"Error connecting to Payment Gateway: {e}")
            return jsonify({"error": "Payment Gateway Connection Failed"}), 500

    return jsonify({"checkout_url": checkout_url})

# ৩. মক পেমেন্ট গেটওয়ে পেজ (সোলো টেস্টিং সিমুলেটর)
@app.route("/mock-gateway/<invoice_id>")
def mock_gateway(invoice_id):
    orders = load_json(ORDERS_FILE)
    order = next((o for o in orders if o["invoice_id"] == invoice_id), None)
    if not order:
        return "Invoice not found", 404
    return render_template("mock_gateway.html", order=order)

@app.route("/mock-gateway/<invoice_id>/pay", methods=["POST"])
def mock_gateway_pay(invoice_id):
    return redirect(url_for("success", invoice_id=invoice_id))

@app.route("/mock-gateway/<invoice_id>/cancel", methods=["POST"])
def mock_gateway_cancel(invoice_id):
    return redirect(url_for("fail", invoice_id=invoice_id))

# ৪. পেমেন্ট সাকসেস হ্যান্ডলার
@app.route("/success")
def success():
    invoice_id = request.args.get("invoice_id")
    orders = load_json(ORDERS_FILE)
    order = next((o for o in orders if o["invoice_id"] == invoice_id), None)
    
    if order:
        # আসল গেটওয়ে মোডে সার্ভার-টু-সার্ভার ভেরিফিকেশন
        if not ENABLE_MOCK_GATEWAY:
            try:
                verify_res = requests.get(f"{GATEWAY_URL}/api/transactions/{invoice_id}/verify", timeout=5)
                verify_data = verify_res.json()
                if verify_data.get("status") != "Completed":
                    return redirect(url_for("fail", invoice_id=invoice_id))
            except Exception:
                pass

        # অর্ডার স্ট্যাটাস 'paid' এ আপডেট
        order["status"] = "paid"
        save_json(ORDERS_FILE, orders)
        
    return render_template("success.html", order=order)

# ৫. পেমেন্ট ফেইল হ্যান্ডলার
@app.route("/fail")
def fail():
    invoice_id = request.args.get("invoice_id")
    orders = load_json(ORDERS_FILE)
    order = next((o for o in orders if o["invoice_id"] == invoice_id), None)
    
    if order:
        order["status"] = "failed"
        save_json(ORDERS_FILE, orders)
        
    return render_template("fail.html", order=order)

if __name__ == "__main__":
    print(f"🛒 Ecommerce Web App running on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=True)
