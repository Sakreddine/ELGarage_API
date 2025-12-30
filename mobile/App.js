import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from './supabase';
import axios from 'axios';

// ⚠️ METTEZ VOTRE IP LOCALE ICI (ex: http://192.168.1.45:8000)
// Si simulateur : http://127.0.0.1:8000 (iOS) ou http://10.0.2.2:8000 (Android)
const API_URL = 'https://elgarage-api.onrender.com'; 

const Stack = createStackNavigator();

// --- VALIDATION EMAIL SIMPLE ---
const isValidEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

// ================= ECRAN 1 : CONNEXION =================
function LoginScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-remplissage si on vient de l'inscription
  useEffect(() => {
    if (route.params?.prefillEmail) {
      setEmail(route.params.prefillEmail);
    }
  }, [route.params]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/login`, {
        email: email,
        password: password
      });

      setLoading(false);
      // Reset du formulaire pour la prochaine fois
      setPassword('');
      navigation.replace('Home', { user: response.data.user });

    } catch (error) {
      setLoading(false);
      console.error(error);
      const msg = error.response ? error.response.data.detail : "Serveur injoignable";
      Alert.alert('Echec Connexion', msg);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ELGarage 🚗</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address"/>
      <TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      
      {loading ? <ActivityIndicator color="blue" /> : <Button title="Se connecter" onPress={handleLogin} />}
      
      <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={{marginTop: 20}}>
        <Text style={{color: 'blue', textAlign: 'center'}}>Pas de compte ? Créer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}

// ================= ECRAN 1 BIS : INSCRIPTION =================
function SignUpScreen({ navigation }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', adresse: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // 1. Validation des champs vides
    if (!form.nom || !form.email || !form.password || !form.adresse) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires.");
      return;
    }

    // 2. Validation format email
    if (!isValidEmail(form.email)) {
      Alert.alert("Erreur", "Format d'email invalide.");
      return;
    }

    // 3. Validation longueur mot de passe
    if (form.password.length < 4) {
      Alert.alert("Erreur", "Le mot de passe doit faire au moins 4 caractères.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/register`, form);
      setLoading(false);
      
      Alert.alert(
        "Succès", 
        "Compte créé avec succès ! Connectez-vous.",
        [
          { text: "OK", onPress: () => navigation.navigate('Login', { prefillEmail: form.email }) }
        ]
      );
      
    } catch (error) {
      setLoading(false);
      const msg = error.response ? error.response.data.detail : "Erreur connexion serveur";
      Alert.alert("Erreur Inscription", msg);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte</Text>
      <TextInput placeholder="Nom complet" onChangeText={t => setForm({...form, nom: t})} style={styles.input} />
      <TextInput placeholder="Email" onChangeText={t => setForm({...form, email: t})} style={styles.input} autoCapitalize="none" keyboardType="email-address"/>
      <TextInput placeholder="Mot de passe" onChangeText={t => setForm({...form, password: t})} style={styles.input} secureTextEntry />
      <TextInput placeholder="Adresse physique" onChangeText={t => setForm({...form, adresse: t})} style={styles.input} />
      
      {loading ? <ActivityIndicator color="blue" /> : <Button title="S'inscrire" onPress={handleRegister} />}
      
      <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 15}}>
        <Text style={{color: 'gray', textAlign: 'center'}}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
}

// ================= ECRAN 2 : ACCUEIL =================
function HomeScreen({ route, navigation }) {
  const { user } = route.params;
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => { fetchVehicles(); }, []);

  const fetchVehicles = async () => {
    const { data } = await supabase.from('vehicules').select('*').eq('user_id', user.id);
    if (data) setVehicles(data);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Bienvenue, {user.nom}</Text>
      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={<Text style={{textAlign:'center', marginTop:20, color:'gray'}}>Aucun véhicule.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Detail', { vehicle: item, user: user })}>
            <Text style={styles.cardTitle}>{item.marque} {item.modele}</Text>
            <Text>{item.immatriculation}</Text>
          </TouchableOpacity>
        )}
      />
      <Button title="Ajouter un véhicule" onPress={() => navigation.navigate('AddVehicle', { user, refresh: fetchVehicles })} />
    </View>
  );
}

// ================= ECRAN 3 : DETAIL & DIAG =================
function DetailScreen({ route }) {
  const { vehicle, user } = route.params;
  const [codes, setCodes] = useState('');
  const [symp, setSymp] = useState('');
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true); setRes(null);
    try {
      const response = await axios.post(`${API_URL}/analyze`, {
        user_id: user.id, vehicule_id: vehicle.id,
        codes_defaut: codes, symptomes: symp,
        date_occurence: new Date().toISOString().split('T')[0]
      });
      setRes(response.data);
    } catch (error) {
      Alert.alert("Erreur", error.response?.data?.detail || "Erreur serveur");
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{vehicle.marque} {vehicle.modele}</Text>
      <View style={styles.section}>
        <Text style={styles.label}>Diagnostic IA</Text>
        <TextInput placeholder="Code (ex: P0300)" value={codes} onChangeText={setCodes} style={styles.input} />
        <TextInput placeholder="Symptômes" value={symp} onChangeText={setSymp} style={styles.input} multiline />
        {loading ? <ActivityIndicator size="large" /> : <Button title="Analyser" onPress={runAnalysis} />}
      </View>
      {res && (
        <View style={styles.resultBox}>
          <Text style={[styles.resultTitle, {color: res.sante_vehicule === 'ROUGE' ? 'red' : 'green'}]}>Santé : {res.sante_vehicule}</Text>
          <Text style={{fontWeight:'bold'}}>{res.resume_court}</Text>
          <Text style={{marginTop:10}}>{res.analyse_technique_detaillee}</Text>
          <Text style={{marginTop:10, fontStyle:'italic'}}>Coût: {res.estimation_cout_pieces_mo}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ================= ECRAN 4 : AJOUT =================
function AddVehicleScreen({ route, navigation }) {
  const { user, refresh } = route.params;
  const [f, setF] = useState({});
  const sub = async () => {
    const { error } = await supabase.from('vehicules').insert({
      user_id: user.id, marque: f.ma, modele: f.mo, immatriculation: f.im,
      annee: parseInt(f.an), km_actuel: parseInt(f.km), nom: `${f.ma} ${f.mo}`
    });
    if (!error) { refresh(); navigation.goBack(); }
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajout</Text>
      <TextInput placeholder="Marque" onChangeText={t=>setF({...f,ma:t})} style={styles.input} />
      <TextInput placeholder="Modèle" onChangeText={t=>setF({...f,mo:t})} style={styles.input} />
      <TextInput placeholder="Immat" onChangeText={t=>setF({...f,im:t})} style={styles.input} />
      <TextInput placeholder="Année" keyboardType="numeric" onChangeText={t=>setF({...f,an:t})} style={styles.input} />
      <TextInput placeholder="KM" keyboardType="numeric" onChangeText={t=>setF({...f,km:t})} style={styles.input} />
      <Button title="OK" onPress={sub} />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{title: 'Inscription'}} />
        <Stack.Screen name="Home" component={HomeScreen} options={{title: 'Garage'}} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{title: 'Diag'}} />
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{title: 'Ajout'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  section: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 20 },
  label: { fontWeight: 'bold', marginBottom: 10 },
  resultBox: { backgroundColor: '#e8f4fd', padding: 15, borderRadius: 10, borderLeftWidth: 5, borderLeftColor: '#2196F3' },
  resultTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 }

});
