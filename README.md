# 🏡 RealEstate AI Chatbot

An AI-powered real estate analytics chatbot with interactive charts, real-time dashboard, and Excel-based insights. Upload your data or ask about any real location — the backend will validate the place and generate realistic market trends if missing.

---

## ✨ Features

- 💬 **Smart Chat Interface** — Ask questions like *"Analyze Wakad"* or *"Compare Tokyo and Mumbai"*
- 📈 **Interactive Charts** — Price & demand trends over time
- 📊 **Live Dashboard** — Real-time market statistics & comparisons
- 📤 **Excel Upload** — Use your own dataset
- 🔍 **Place Validation** — Rejects invalid locations
- ⚡ **Synthetic Data Generator** — Creates realistic data when not found in Excel

---

## 🧱 Tech Stack

**Backend**
- Django 4.2+
- Django REST Framework
- Pandas, NumPy
- OpenAI API (optional)
- Geopy (place validation)

**Frontend**
- React 18
- Chart.js
- Bootstrap 5

---

## 📁 Project Structure

```
realestate-chatbot/
├── backend/
│   ├── api/
│   ├── realestate_project/
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── src/
│   └── package.json
└── README.md
```

---

## ✅ Quick Start (Windows)

```bash
# Automated setup
setup.bat

# Start both frontend + backend
start.bat
```

---

## ⚙️ Manual Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python generate_sample_data.py
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm start
```

---

## 🌍 Example Queries

- **Single Area**
  - Analyze Wakad
  - Show price trends for Baner from 2019

- **Comparison**
  - Compare Wakad and Hinjewadi
  - Compare Tokyo and Mumbai

- **Invalid Place**
  - "Analyze Xyz123" → returns “Invalid location”

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/query/?q=` | Query insights |
| GET | `/api/areas/` | List available areas |
| GET | `/api/dashboard/` | Dashboard stats |
| POST | `/api/upload/` | Upload Excel file |

---

## 📤 Excel File Requirements

Your Excel file must include:

- **Area** (e.g., area, location, locality)
- **Year**
- **Price**
- **Demand**

The system automatically detects column variations.

---

## 🔐 Environment Variables

Create `.env` in backend:

```env
DEBUG=False
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1
OPENAI_API_KEY=
PRELOADED_EXCEL=./api/sample_data.xlsx
```

---


## ✅ Ready to Use

Once running:

- Backend → http://localhost:8000  
- Frontend → http://localhost:3000  

---

## 📜 License

MIT License — feel free to use and modify.

---

### Made with ❤️ by JAY

