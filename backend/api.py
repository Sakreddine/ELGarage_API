import os
import json
import hashlib
from datetime import date
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from groq import Groq
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()

SB_URL = os.getenv("SUPABASE_URL")
SB_KEY = os.getenv("SUPABASE_KEY")

if not SB_URL or not SB_KEY:
    print("⚠️ ERREUR: Les clés SUPABASE sont manquantes dans .env")

app = FastAPI(title="ELGarage Mobile API", version="1.2")

# --- AJOUT CLES CORS (Indispensable pour le mobile) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(SB_URL, SB_KEY) if SB_URL and SB_KEY else None

# --- MODÈLES DE DONNÉES ---
class DiagnosticRequest(BaseModel):
    user_id: int
    vehicule_id: int
    codes_defaut: str
    symptomes: str
    date_occurence: str = str(date.today())

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    nom: str
    email: str
    password: str
    adresse: str

# --- UTILITAIRES ---
def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def get_config_ia():
    try:
        res = supabase.table('app_settings').select("*").eq('id', 1).execute()
        if res.data:
            s = res.data[0]
            return s.get('groq_api_key'), s.get('maintenance_mode', True)
    except: pass
    return None, True

def get_car_history_text(v_id):
    txt = "--- HISTORIQUE ---\n"
    try:
        notes = supabase.table('historique_vehicules').select("*").eq('vehicule_id', v_id).order('date', desc=True).limit(5).execute()
        for n in notes.data: txt += f"- {n.get('date')}: [{n.get('type_evenement')}] {n.get('notes')}\n"
        diags = supabase.table('diagnostics_vehicules').select("*").eq('vehicule_id', v_id).order('date', desc=True).limit(3).execute()
        for d in diags.data: txt += f"- {d.get('date')}: Code {d.get('code_defaut')} ({d.get('resume_ia')})\n"
    except: pass
    return txt

def format_tech_sheet(car):
    def v(k, u=""): return f"{car.get(k)} {u}" if car.get(k) else "N/A"
    return f"""VEHICULE: {v('marque')} {v('modele')} {v('annee')}\nMOTEUR: {v('code_moteur')} | {v('cylindree', 'cc')} | {v('puissance_ch', 'ch')} | {v('carburant')}"""

# --- ROUTES API ---

@app.get("/")
def ping(): return {"status": "online"}

# 1. ROUTE INSCRIPTION
@app.post("/register")
async def register_user(req: RegisterRequest):
    print(f"📝 Inscription : {req.email}")
    
    # Vérifier si l'email existe déjà
    existing = supabase.table('users').select("*").eq('email', req.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")
    
    # Création
    new_user = {
        "nom": req.nom,
        "email": req.email,
        "password_hash": hash_password(req.password),
        "adresse": req.adresse,
        "role": "user",
        "ai_allowed": False
    }
    
    try:
        data = supabase.table('users').insert(new_user).execute()
        if data.data:
            return {"message": "Compte créé", "user": data.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    raise HTTPException(status_code=500, detail="Erreur création compte")

# 2. ROUTE CONNEXION
@app.post("/login")
async def login_user(req: LoginRequest):
    print(f"🔑 Connexion : {req.email}")
    pwd_hash = hash_password(req.password)
    
    res = supabase.table('users').select("*").eq('email', req.email).eq('password_hash', pwd_hash).execute()
    
    if res.data:
        return {"message": "Succès", "user": res.data[0]}
    else:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

# 3. ROUTE ANALYSE
@app.post("/analyze")
async def analyze_diagnostic(req: DiagnosticRequest):
    api_key, is_maint = get_config_ia()
    if is_maint: raise HTTPException(503, "Maintenance")
    if not api_key: raise HTTPException(500, "Config IA manquante")

    u_data = supabase.table('users').select('role, ai_allowed').eq('id', req.user_id).execute()
    if not u_data.data: raise HTTPException(404, "User inconnu")
    user = u_data.data[0]
    
    if user['role'] != 'admin' and not user['ai_allowed']:
        raise HTTPException(403, "IA non autorisée")

    v_data = supabase.table('vehicules').select("*").eq('id', req.vehicule_id).execute()
    if not v_data.data: raise HTTPException(404, "Véhicule introuvable")
    
    prompt = f"""Rôle: Mécanicien Expert.\n{format_tech_sheet(v_data.data[0])}\n{get_car_history_text(req.vehicule_id)}\nPanne: {req.codes_defaut} {req.symptomes}\nRéponds JSON: {{ "titre_rapport": "...", "resume_court": "...", "analyse_technique_detaillee": "...", "gravite_score": 1, "sante_vehicule": "ROUGE/ORANGE/VERT", "plan_action_propose": "...", "estimation_cout_pieces_mo": "..." }}"""

    try:
        client = Groq(api_key=api_key)
        chat = client.chat.completions.create(messages=[{"role":"user","content":prompt}], model="llama-3.3-70b-versatile", response_format={"type":"json_object"}, temperature=0.2)
        result = json.loads(chat.choices[0].message.content)
        
        supabase.table('diagnostics_vehicules').insert({
            'vehicule_id': req.vehicule_id, 'date': req.date_occurence,
            'code_defaut': req.codes_defaut, 'resume_ia': result.get('resume_court'),
            'analyse_ia': json.dumps(result), 'cout_estime': result.get('estimation_cout_pieces_mo'),
            'sante_vehicule': result.get('sante_vehicule')
        }).execute()
        return result
    except Exception as e: raise HTTPException(500, f"Erreur IA: {e}")