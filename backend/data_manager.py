import os
from supabase import create_client, Client
from dotenv import load_dotenv
import hashlib
from datetime import datetime

# Chargement des variables locales si .env existe
load_dotenv()

class DataManager:
    def __init__(self):
        self.supabase: Client = None
        self.db_ready = False
        self.current_user = None
        self._init_connection()

    def _init_connection(self):
        try:
            # ⚠️ MODIFICATION IMPORTANTE POUR L'API :
            # On utilise os.environ (Variables d'environnement) au lieu de st.secrets
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_KEY")
            
            if not url or not key:
                print("❌ DataManager: Manque SUPABASE_URL ou SUPABASE_KEY")
                return

            self.supabase = create_client(url, key)
            self.db_ready = True
        except Exception as e: 
            print(f"❌ Erreur connexion DB: {e}")
            self.db_ready = False

    def _hash_password(self, password):
        return hashlib.sha256(password.encode()).hexdigest()

    # --- USERS ---
    def register_user(self, nom, email, password, adresse):
        if not self.db_ready: return False, "Erreur DB: Non connectée"
        try:
            # Vérif doublon
            existing = self.supabase.table('users').select("*").eq('email', email).execute()
            if existing.data: return False, "Email déjà utilisé."
            
            new_user = {
                'nom': nom, 
                'email': email, 
                'password_hash': self._hash_password(password), 
                'adresse': adresse, 
                'role': 'user', 
                'ai_allowed': False
            }
            data = self.supabase.table('users').insert(new_user).execute()
            if data.data:
                self.current_user = data.data[0]
                return True, "Succès"
            return False, "Erreur Inscription"
        except Exception as e: return False, str(e)

    def login_user(self, email, password):
        if not self.db_ready: return False, "Erreur DB"
        try:
            pwd_hash = self._hash_password(password)
            res = self.supabase.table('users').select("*").eq('email', email).eq('password_hash', pwd_hash).execute()
            if res.data:
                self.current_user = res.data[0]
                return True, "Succès"
            return False, "Identifiants incorrects."
        except Exception as e: return False, str(e)

    # --- HISTORIQUE & CONFIG ---
    def get_app_settings(self):
        if not self.db_ready: return None
        try:
            res = self.supabase.table('app_settings').select("*").eq('id', 1).execute()
            return res.data[0] if res.data else None
        except: return None
    
    def get_vehicle_info(self, v_id):
        if not self.db_ready: return None
        try:
            res = self.supabase.table('vehicules').select("*").eq('id', v_id).execute()
            return res.data[0] if res.data else None
        except: return None

    def get_full_history_text(self, v_id):
        """Récupère l'historique pour l'IA"""
        if not self.db_ready: return "Historique indisponible."
        try:
            txt = "--- HISTORIQUE ---\n"
            # Notes
            notes = self.supabase.table('historique_vehicules').select("*").eq('vehicule_id', v_id).execute().data
            for n in notes: txt += f"- {n['date']} : {n['notes']}\n"
            # Diags précédents
            diags = self.supabase.table('diagnostics_vehicules').select("*").eq('vehicule_id', v_id).execute().data
            for d in diags: txt += f"- {d['date']} : {d['code_defaut']} ({d['resume_ia']})\n"
            return txt
        except: return "Erreur lecture historique."

    def save_diagnostic(self, v_id, c, a, cost, sante, d, res):
        if not self.db_ready: return
        try:
            self.supabase.table('diagnostics_vehicules').insert({
                'vehicule_id': v_id, 'date': str(d), 'code_defaut': c, 
                'resume_ia': res, 'analyse_ia': a, 'cout_estime': cost, 'sante_vehicule': sante
            }).execute()
        except Exception as e: print(f"Save Diag Error: {e}")
