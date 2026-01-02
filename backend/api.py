from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <--- IMPERATIF POUR LE MOBILE
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

# Import de vos modules locaux
from data_manager import DataManager 
from ai_engine import AIEngine 

# Chargement des variables
load_dotenv()

app = FastAPI()

# --- CONFIGURATION CORS (Pour éviter l'erreur 405) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autorise tout le monde (Mobile, Web, Localhost)
    allow_credentials=True,
    allow_methods=["*"],  # Autorise toutes les méthodes (GET, POST, OPTIONS...)
    allow_headers=["*"],
)
# -----------------------------------------------------

# --- INITIALISATION ---
try:
    dm = DataManager()
    print("✅ API: DataManager connecté.")
except Exception as e:
    print(f"❌ API: Erreur DataManager - {e}")

try:
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key and dm.db_ready:
        settings = dm.get_app_settings()
        if settings:
            groq_key = settings.get('groq_api_key')
    
    ai_engine = AIEngine(api_key=groq_key) if groq_key else None
    if ai_engine: print("✅ API: Moteur IA prêt.")
    else: print("⚠️ API: Moteur IA non configuré.")

except Exception as e:
    print(f"❌ API: Erreur AIEngine - {e}")
    ai_engine = None


# --- MODÈLES DE DONNÉES ---
class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    nom: str
    email: str
    password: str
    adresse: Optional[str] = None

class VehicleInput(BaseModel):
    user_id: int
    marque: str
    modele: str
    immatriculation: str
    annee: int
    km_actuel: int
    nom: str

class AnalyzeInput(BaseModel):
    user_id: int
    vehicule_id: int
    codes_defaut: Optional[str] = ""
    symptomes: str
    date_occurence: str


# --- ROUTES ---

@app.get("/")
def read_root():
    return {"status": "online", "message": "ELGarage API is running 🚀"}

@app.post("/register")
def register(user: UserRegister):
    success, message = dm.register_user(user.nom, user.email, user.password, user.adresse)
    if success:
        return {"message": "Inscription réussie", "email": user.email}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.post("/login")
def login(user: UserLogin):
    success, message = dm.login_user(user.email, user.password)
    if success:
        return {"message": "Connexion réussie", "user": dm.current_user}
    else:
        raise HTTPException(status_code=401, detail=message)

@app.post("/vehicles")
def add_vehicle(v: VehicleInput):
    try:
        response = dm.supabase.table('vehicules').insert({
            "user_id": v.user_id,
            "marque": v.marque,
            "modele": v.modele,
            "immatriculation": v.immatriculation,
            "annee": v.annee,
            "km_actuel": v.km_actuel,
            "nom": v.nom
        }).execute()
        
        if response.data:
            return {"message": "Véhicule ajouté !", "vehicle": response.data[0]}
        else:
            raise HTTPException(status_code=400, detail="Erreur lors de l'enregistrement DB")
            
    except Exception as e:
        print(f"Erreur Add Vehicle: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")

@app.get("/vehicles")
def get_vehicles(user_id: int):
    try:
        response = dm.supabase.table('vehicules').select("*").eq('user_id', user_id).execute()
        return response.data
    except Exception as e:
        print(f"Erreur Get Vehicles: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
def analyze_vehicle(data: AnalyzeInput):
    if not ai_engine:
        raise HTTPException(status_code=503, detail="Service IA non disponible.")

    try:
        car_info = dm.get_vehicle_info(data.vehicule_id)
        if not car_info:
            raise HTTPException(status_code=404, detail="Véhicule introuvable.")

        history_text = dm.get_full_history_text(data.vehicule_id)
        probleme = f"Codes: {data.codes_defaut}. Symptômes: {data.symptomes}"

        result = ai_engine.analyze_obd(car_info, history_text, probleme, data.date_occurence)

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        dm.save_diagnostic(
            data.vehicule_id, data.codes_defaut, str(result), 
            result.get('estimation_cout_pieces_mo', 'N/A'),
            result.get('sante_vehicule', 'VERT'),
            data.date_occurence,
            result.get('resume_court', 'Analyse IA')
        )
        return result

    except Exception as e:
        print(f"Erreur Analyse: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e: raise HTTPException(500, f"Erreur IA: {e}")

