from groq import Groq
import json

class AIEngine:
    def __init__(self, api_key, model_name="llama-3.3-70b-versatile"):
        self.client = Groq(api_key=api_key)
        self.model = model_name

    def _format_technical_context(self, car):
        """Transforme le dictionnaire brut de la DB en fiche technique lisible"""
        def val(k, unit=""):
            v = car.get(k)
            return f"{v} {unit}" if v is not None and v != "" else "N/A"

        return f"""
        [VÉHICULE] {val('marque')} {val('modele')} ({val('annee')})
        IMMAT: {val('immatriculation')} - KM: {val('km_actuel', 'km')}
        MOTEUR: {val('code_moteur')} - {val('cylindree', 'cc')} - {val('puissance_ch', 'ch')}
        CARBURANT: {val('carburant')} - BOITE: {val('boite_vitesse')}
        """

    def analyze_obd(self, car_info, history_text, problem_desc, current_date):
        tech_context = self._format_technical_context(car_info)
        
        prompt = f"""
        Rôle : Expert Mécanicien Auto. Date : {current_date}
        
        VÉHICULE :
        {tech_context}

        HISTORIQUE :
        {history_text}

        PROBLÈME SIGNALÉ :
        {problem_desc}

        TACHE :
        Analyse ce problème technique.
        
        FORMAT JSON STRICT ATTENDU :
        {{
            "titre_rapport": "Titre court",
            "resume_court": "Synthèse pour le client (max 20 mots)",
            "analyse_technique_detaillee": "Explication technique détaillée des causes probables.",
            "gravite_score": 1,
            "sante_vehicule": "VERT" ou "ORANGE" ou "ROUGE",
            "plan_action_propose": "Étapes de réparation",
            "estimation_cout_pieces_mo": "Fourchette prix (ex: 150-200€)"
        }}
        """
        try:
            completion = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content)
        except Exception as e:
            return {"error": f"Erreur IA : {str(e)}"}
