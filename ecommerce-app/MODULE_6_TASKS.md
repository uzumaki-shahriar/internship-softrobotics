# Module 6: Ecommerce Web App (Python/Flask) — Task List & Checklist

This task list tracks all steps to complete **Module 6 (Ecommerce Web App)** as a standalone Python Flask application on **Port 8002** using a **JSON File Database**.

---

## 📌 Phase 1: Environment & Python Setup
- [x] **1.1** Create directory structure (`ecommerce-app/`, `data/`, `templates/`).
- [x] **1.2** Create `requirements.txt` (`flask`, `requests`, `python-dotenv`).
- [x] **1.3** Create `.env` configuration (`PORT=8002`, `ENABLE_MOCK_GATEWAY=true`).

---

## 📌 Phase 2: JSON Database Setup
- [x] **2.1** Create `data/products.json` pre-seeded with 2 products (৳500 & ৳1200).
- [x] **2.2** Create `data/orders.json` for persistent order tracking.
- [x] **2.3** Add helper methods in `app.py` for JSON storage operations.

---

## 📌 Phase 3: Flask Backend & API Routes
- [x] **3.1** Implement `GET /` — Product showcase page (`app.py`).
- [x] **3.2** Implement `POST /orders` — Order creation and checkout URL generation.
- [x] **3.3** Implement `GET /mock-gateway/<invoice_id>` — Standalone simulator page for local testing.
- [x] **3.4** Implement `GET /success` — Order status update to `paid` & receipt page.
- [x] **3.5** Implement `GET /fail` — Order status update to `failed` & error page.

---

## 📌 Phase 4: Modern Frontend Templates (Jinja2 + CSS)
- [x] **4.1** Create `templates/base.html` — Responsive layout with modern glassmorphism styling.
- [x] **4.2** Create `templates/index.html` — Product showcase & instant buy modal.
- [x] **4.3** Create `templates/mock_gateway.html` — Gateway payment simulator UI.
- [x] **4.4** Create `templates/success.html` — Order confirmation invoice.
- [x] **4.5** Create `templates/fail.html` — Payment failure screen.

---

## 📌 Phase 5: Execution & Integration
- [ ] **5.1** Run Flask app: `python app.py`.
- [ ] **5.2** Test order purchase end-to-end.
- [ ] **5.3** When teammates finish Payment Gateway, switch `ENABLE_MOCK_GATEWAY=false` in `.env`.
