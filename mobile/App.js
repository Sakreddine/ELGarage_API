import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';

// 👇 Assurez-vous que ce fichier existe bien dans mobile/components/
import ServerStatus from './components/ServerStatus';

// CONFIGURATION
const API_URL = 'https://elgarage-api.onrender.com';
const Stack = createStackNavigator();

// ================= ECRAN 1 : CONNEXION =================
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert("Erreur", "Remplissez tous les champs."); return; }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/login`, { email: email.trim(), password });
      setLoading(false);
      navigation.replace('Home', { user: response.data.user });
    } catch (error) {
      setLoading(false);
      Alert.alert("Erreur", error.response?.data?.detail || "Impossible de se connecter.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ELGarage 🚗</Text>
      <ServerStatus />
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address"/>
      <TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      
      {loading ? <ActivityIndicator size="large" color="#2196F3" /> : <Button title="Se connecter" onPress={handleLogin} />}
      
      <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={{marginTop: 20}}>
        <Text style={styles.link}>Créer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}

// ================= ECRAN 2 : INSCRIPTION =================
function SignUpScreen({ navigation }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', adresse: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.nom || !form.email || !form.password) { Alert.alert("Erreur", "Champs manquants."); return; }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/register`, { ...form, email: form.email.trim() }, { timeout: 15000 });
      Alert.alert("Succès", "Compte créé !", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (error) {
      const msg = error.response?.data?.detail || "Erreur connexion serveur.";
      Alert.alert("Erreur", msg);
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      <TextInput placeholder="Nom" onChangeText={t => setForm({...form, nom: t})} style={styles.input} />
      <TextInput placeholder="Email" onChangeText={t => setForm({...form, email: t})} style={styles.input} autoCapitalize="none" />
      <TextInput placeholder="Mot de passe" onChangeText={t => setForm({...form, password: t})} style={styles.input} secureTextEntry />
      <TextInput placeholder="Adresse" onChangeText={t => setForm({...form, adresse: t})} style={styles.input} />
      
      {loading ? <ActivityIndicator size="large" color="#2196F3" /> : <Button title="S'inscrire" onPress={handleRegister} />}
      
      {/* BOUTON RETOUR */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>⬅️ Retour à la connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

// ================= ECRAN 3 : ACCUEIL =================
function HomeScreen({ route, navigation }) {
  const { user } = route.params;
  const [vehicles, setVehicles] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVehicles = async () => {
    setRefreshing(true);
    try {
      const { data } = await axios.get(`${API_URL}/vehicles?user_id=${user.id}`);
      setVehicles(data || []);
    } catch (error) {
      console.log("Erreur chargement véhicules:", error);
    } finally { setRefreshing(false); }
  };

  useEffect(() => { fetchVehicles(); }, []);

  // Fonction de déconnexion
  const logout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Garage de {user.nom}</Text>
        <ServerStatus />
        <TouchableOpacity onPress={logout} style={{marginTop: 10}}>
            <Text style={{color:'red', fontWeight:'bold'}}>Déconnexion 🚪</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={fetchVehicles}
        refreshing={refreshing}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun véhicule. Ajoutez-en un !</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Detail', { vehicle: item, user })}>
            <Text style={styles.cardTitle}>{item.marque} {item.modele}</Text>
            <Text style={styles.cardSubtitle}>{item.immatriculation} • {item.km_actuel} km</Text>
          </TouchableOpacity>
        )}
      />
      
      <View style={styles.fabContainer}>
         <Button title="+ Ajouter un véhicule" onPress={() => navigation.navigate('AddVehicle', { user, refresh: fetchVehicles })} />
      </View>
    </View>
  );
}

// ================= ECRAN 4 : AJOUT VEHICULE (CORRIGÉ) =================
function AddVehicleScreen({ route, navigation }) {
  const { user, refresh } = route.params;
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [immat, setImmat] = useState('');
  const [annee, setAnnee] = useState('');
  const [km, setKm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!marque || !modele || !immat || !annee || !km) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires.");
      return;
    }

    setLoading(true);
    try {
      // ⚠️ CONVERSION IMPORTANT : On force Année et KM en entiers (Int)
      const payload = {
        user_id: user.id,
        marque: marque,
        modele: modele,
        immatriculation: immat,
        annee: parseInt(annee, 10),  // <-- IMPORTANT
        km_actuel: parseInt(km, 10), // <-- IMPORTANT
        nom: `${marque} ${modele}`
      };

      console.log("Envoi au serveur:", payload); // Pour débugger

      await axios.post(`${API_URL}/vehicles`, payload);

      Alert.alert("Succès", "Véhicule ajouté !", [
        { text: "OK", onPress: () => { refresh(); navigation.goBack(); } }
      ]);
    } catch (error) {
      console.log("Erreur Ajout:", error);
      let msg = "Erreur inconnue.";
      if (error.response) {
        msg = `Serveur refuse (${error.response.status}): ` + (error.response.data.detail || "Vérifiez les données");
      } else if (error.request) {
        msg = "Serveur injoignable (404 ou Offline).";
      }
      Alert.alert("Échec", msg);
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nouveau Véhicule</Text>
      
      <TextInput placeholder="Marque" value={marque} onChangeText={setMarque} style={styles.input} />
      <TextInput placeholder="Modèle" value={modele} onChangeText={setModele} style={styles.input} />
      <TextInput placeholder="Immatriculation" value={immat} onChangeText={setImmat} style={styles.input} />
      <TextInput placeholder="Année" value={annee} onChangeText={setAnnee} keyboardType="numeric" style={styles.input} />
      <TextInput placeholder="Kilométrage" value={km} onChangeText={setKm} keyboardType="numeric" style={styles.input} />
      
      {loading ? <ActivityIndicator size="large" color="blue" /> : <Button title="Valider l'ajout" onPress={handleSubmit} />}

      {/* BOUTON RETOUR ACCUEIL */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>❌ Annuler / Retour Accueil</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ================= ECRAN 5 : DETAIL & DIAGNOSTIC =================
function DetailScreen({ route, navigation }) {
  const { vehicle, user } = route.params;
  const [codes, setCodes] = useState('');
  const [symp, setSymp] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true); setResult(null);
    try {
      const response = await axios.post(`${API_URL}/analyze`, {
        user_id: user.id,
        vehicule_id: vehicle.id,
        codes_defaut: codes,
        symptomes: symp,
        date_occurence: new Date().toISOString().split('T')[0]
      }, { timeout: 30000 });
      setResult(response.data);
    } catch (error) {
      Alert.alert("Erreur", error.response?.data?.detail || "Erreur analyse.");
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.mainContainer}>
      <Text style={styles.title}>{vehicle.marque} {vehicle.modele}</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>🔍 Diagnostic IA</Text>
        <TextInput placeholder="Code défaut (ex: P0300)" value={codes} onChangeText={setCodes} style={styles.input} />
        <TextInput placeholder="Symptômes..." value={symp} onChangeText={setSymp} style={[styles.input, {height: 80}]} multiline />
        
        {loading ? <ActivityIndicator size="large" color="orange" /> : <Button title="Lancer l'Analyse" onPress={runAnalysis} color="orange"/>}
      </View>

      {result && (
        <View style={[styles.resultBox, { borderLeftColor: result.sante_vehicule === 'ROUGE' ? 'red' : 'green' }]}>
          <Text style={styles.resultHeader}>Santé : {result.sante_vehicule}</Text>
          <Text style={{fontWeight:'bold', marginTop:5}}>{result.resume_court}</Text>
          <Text style={{marginTop:10}}>{result.analyse_technique_detaillee}</Text>
          <Text style={{marginTop:10, fontStyle:'italic'}}>Coût: {result.estimation_cout_pieces_mo}</Text>
        </View>
      )}

      {/* BOUTON RETOUR ACCUEIL */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>⬅️ Retour à la liste</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// NAVIGATION
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{title: 'Inscription', headerLeft: null}} />
        <Stack.Screen name="Home" component={HomeScreen} options={{title: 'Mon Garage', headerLeft: null}} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{title: 'Diagnostic', headerLeft: null}} />
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{title: 'Ajout', headerLeft: null}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', justifyContent: 'center' },
  mainContainer: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  header: { marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  link: { color: 'blue', textAlign: 'center', marginTop: 10 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  cardSubtitle: { color: 'gray' },
  emptyText: { textAlign: 'center', marginTop: 20, color: 'gray' },
  section: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 20 },
  label: { fontWeight: 'bold', marginBottom: 10 },
  resultBox: { backgroundColor: '#e8f4fd', padding: 15, borderRadius: 10, borderLeftWidth: 5, marginTop: 10 },
  resultHeader: { fontSize: 18, fontWeight: 'bold' },
  fabContainer: { marginTop: 10, marginBottom: 30 },
  backButton: { marginTop: 20, padding: 10 },
  backButtonText: { color: '#666', textAlign: 'center', fontWeight: 'bold' }
});

