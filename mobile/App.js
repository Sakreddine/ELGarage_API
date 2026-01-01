import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';

// 👇 IMPORTEZ VOTRE COMPOSANT DE STATUS
// Assurez-vous que le fichier est bien dans mobile/components/ServerStatus.js
import ServerStatus from './components/ServerStatus';

// ================= CONFIGURATION =================
const API_URL = 'https://elgarage-api.onrender.com';
const Stack = createStackNavigator();

// ================= ECRAN 1 : CONNEXION =================
function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Veuillez entrer votre email et mot de passe.");
      return;
    }

    setLoading(true);
    try {
      // On envoie les données au backend
      const response = await axios.post(`${API_URL}/login`, {
        email: email.trim(), // .trim() enlève les espaces accidentels
        password: password
      }, { timeout: 10000 });

      setLoading(false);
      // Succès : On va à l'accueil
      navigation.replace('Home', { user: response.data.user });

    } catch (error) {
      setLoading(false);
      console.log("Login Error:", error);
      const msg = error.response?.data?.detail || "Impossible de se connecter. Vérifiez votre internet ou le serveur.";
      Alert.alert('Échec Connexion', msg);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ELGarage 🚗</Text>
      
      {/* Moniteur d'état du serveur */}
      <ServerStatus />

      <TextInput 
        placeholder="Email" 
        value={email} 
        onChangeText={setEmail} 
        style={styles.input} 
        autoCapitalize="none" 
        keyboardType="email-address"
      />
      <TextInput 
        placeholder="Mot de passe" 
        value={password} 
        onChangeText={setPassword} 
        style={styles.input} 
        secureTextEntry 
      />
      
      {loading ? <ActivityIndicator size="large" color="#2196F3" /> : <Button title="Se connecter" onPress={handleLogin} />}
      
      <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={{marginTop: 20}}>
        <Text style={styles.link}>Pas de compte ? Créer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}

// ================= ECRAN 2 : INSCRIPTION (CORRIGÉ) =================
function SignUpScreen({ navigation }) {
  const [form, setForm] = useState({ nom: '', email: '', password: '', adresse: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // 1. Validation
    if (!form.nom || !form.email || !form.password) {
      Alert.alert("Erreur", "Le Nom, l'Email et le Mot de passe sont obligatoires.");
      return;
    }

    setLoading(true);

    try {
      // 2. Envoi (Timeout 15s pour laisser le temps au serveur de se réveiller)
      await axios.post(`${API_URL}/register`, {
        nom: form.nom,
        email: form.email.trim(),
        password: form.password,
        adresse: form.adresse
      }, { timeout: 15000 });

      // 3. Succès
      Alert.alert(
        "Compte créé ! 🎉", 
        "Vous pouvez maintenant vous connecter avec vos identifiants.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      // 4. Gestion d'erreur détaillée
      console.log("Register Error:", error);
      let message = "Erreur inconnue.";

      if (error.response) {
        // Le serveur a répondu une erreur (ex: Email déjà pris)
        message = error.response.data.detail || "Le serveur a refusé l'inscription.";
      } else if (error.request) {
        // Pas de réponse du serveur
        message = "Le serveur ne répond pas. Il est peut-être en train de démarrer (attendez 30s) ou vous n'avez pas internet.";
      } else {
        message = error.message;
      }
      
      Alert.alert("Échec Inscription", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      <TextInput placeholder="Nom complet" onChangeText={t => setForm({...form, nom: t})} style={styles.input} />
      <TextInput placeholder="Email" onChangeText={t => setForm({...form, email: t})} style={styles.input} autoCapitalize="none" keyboardType="email-address"/>
      <TextInput placeholder="Mot de passe" onChangeText={t => setForm({...form, password: t})} style={styles.input} secureTextEntry />
      <TextInput placeholder="Adresse" onChangeText={t => setForm({...form, adresse: t})} style={styles.input} />
      
      {loading ? <ActivityIndicator size="large" color="#2196F3" /> : <Button title="S'inscrire" onPress={handleRegister} />}
      
      <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 15}}>
        <Text style={{color: 'gray', textAlign: 'center'}}>Annuler</Text>
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
      // Appel API pour récupérer les véhicules de l'utilisateur
      // Note: Assurez-vous que votre backend a bien cette route GET /vehicles/{user_id}
      // Sinon, on peut utiliser Supabase directement si vous préférez, mais via l'API c'est mieux.
      // Si cette route n'existe pas dans votre backend Python, l'ajout marchera mais pas l'affichage.
      
      // OPTION API (Recommandée si la route existe)
      const { data } = await axios.get(`${API_URL}/vehicles?user_id=${user.id}`);
      
      // SI VOUS UTILISEZ SUPABASE DIRECT (Décommentez si besoin)
      // const { data } = await supabase.from('vehicules').select('*').eq('user_id', user.id);

      setVehicles(data || []);
    } catch (error) {
      console.log("Erreur fetch:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  return (
    <View style={styles.mainContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bonjour, {user.nom}</Text>
        <ServerStatus />
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
            <Text style={styles.cardSubtitle}>{item.immatriculation}</Text>
          </TouchableOpacity>
        )}
      />
      
      <View style={styles.fabContainer}>
         <Button title="+ Ajouter un véhicule" onPress={() => navigation.navigate('AddVehicle', { user, refresh: fetchVehicles })} />
      </View>
    </View>
  );
}

// ================= ECRAN 4 : AJOUT VEHICULE (CORRIGÉ & ROBUSTE) =================
function AddVehicleScreen({ route, navigation }) {
  const { user, refresh } = route.params;
  // Utilisation de variables séparées pour éviter les bugs d'objet
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [immat, setImmat] = useState('');
  const [annee, setAnnee] = useState('');
  const [km, setKm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // 1. Vérification que tout est rempli
    if (!marque || !modele || !immat || !annee || !km) {
      Alert.alert("Attention", "Tous les champs sont obligatoires.");
      return;
    }

    setLoading(true);

    try {
      // 2. CONVERSION CRITIQUE : Texte -> Nombre
      // C'est souvent ça qui fait planter l'ajout (Python veut un int, pas un string)
      const anneeInt = parseInt(annee, 10);
      const kmInt = parseInt(km, 10);

      const payload = {
        user_id: user.id,
        marque: marque,
        modele: modele,
        immatriculation: immat,
        annee: anneeInt,      // Nombre
        km_actuel: kmInt,     // Nombre
        nom: `${marque} ${modele}`
      };

      console.log("Envoi données:", payload);

      // 3. Appel API
      await axios.post(`${API_URL}/vehicles`, payload);

      // 4. Succès
      Alert.alert("Succès", "Véhicule ajouté !", [
        { 
          text: "OK", 
          onPress: () => {
            refresh(); // Rafraichir la liste
            navigation.goBack(); 
          }
        }
      ]);

    } catch (error) {
      console.log("Add Vehicle Error:", error);
      let msg = "Erreur lors de l'ajout.";
      
      if (error.response) {
        // Erreur 422 = Données mal formatées
        if (error.response.status === 422) {
          msg = "Format de données invalide (vérifiez l'année et le KM).";
        } else {
          msg = error.response.data.detail || "Le serveur a refusé l'ajout.";
        }
      }
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nouveau Véhicule</Text>
      
      <TextInput placeholder="Marque (ex: Renault)" value={marque} onChangeText={setMarque} style={styles.input} />
      <TextInput placeholder="Modèle (ex: Clio)" value={modele} onChangeText={setModele} style={styles.input} />
      <TextInput placeholder="Immatriculation" value={immat} onChangeText={setImmat} style={styles.input} />
      
      {/* Claviers numériques */}
      <TextInput 
        placeholder="Année (ex: 2018)" 
        value={annee} 
        onChangeText={setAnnee} 
        keyboardType="numeric" 
        style={styles.input} 
      />
      <TextInput 
        placeholder="Kilométrage (ex: 50000)" 
        value={km} 
        onChangeText={setKm} 
        keyboardType="numeric" 
        style={styles.input} 
      />
      
      {loading ? <ActivityIndicator size="large" color="blue" /> : <Button title="Valider" onPress={handleSubmit} />}
    </ScrollView>
  );
}

// ================= ECRAN 5 : DETAIL & DIAGNOSTIC =================
function DetailScreen({ route }) {
  const { vehicle, user } = route.params;
  const [codes, setCodes] = useState('');
  const [symp, setSymp] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true); 
    setResult(null);
    try {
      const response = await axios.post(`${API_URL}/analyze`, {
        user_id: user.id,
        vehicule_id: vehicle.id,
        codes_defaut: codes,
        symptomes: symp,
        date_occurence: new Date().toISOString().split('T')[0]
      }, { timeout: 30000 }); // 30s car l'IA peut être lente

      setResult(response.data);
    } catch (error) {
      console.log("Analysis Error:", error);
      Alert.alert("Erreur", error.response?.data?.detail || "Erreur lors de l'analyse.");
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <ScrollView style={styles.mainContainer}>
      <Text style={styles.title}>{vehicle.marque} {vehicle.modele}</Text>
      <Text style={{textAlign:'center', marginBottom:20, color:'gray'}}>Immat: {vehicle.immatriculation} - {vehicle.km_actuel} km</Text>
      
      <View style={styles.section}>
        <Text style={styles.label}>🔍 Diagnostic IA</Text>
        <TextInput placeholder="Code défaut (ex: P0300)" value={codes} onChangeText={setCodes} style={styles.input} />
        <TextInput placeholder="Symptômes (bruit, fumée...)" value={symp} onChangeText={setSymp} style={[styles.input, {height: 80}]} multiline />
        
        {loading ? (
          <View>
            <ActivityIndicator size="large" color="orange" />
            <Text style={{textAlign:'center'}}>L'IA réfléchit...</Text>
          </View>
        ) : (
          <Button title="Lancer l'Analyse" onPress={runAnalysis} color="orange"/>
        )}
      </View>

      {result && (
        <View style={[styles.resultBox, { borderLeftColor: result.sante_vehicule === 'ROUGE' ? 'red' : 'green' }]}>
          <Text style={styles.resultHeader}>Santé : {result.sante_vehicule}</Text>
          <Text style={{fontWeight:'bold', marginTop:5}}>{result.resume_court}</Text>
          <Text style={{marginTop:10}}>{result.analyse_technique_detaillee}</Text>
          <Text style={{marginTop:10, fontStyle:'italic'}}>Coût estimé: {result.estimation_cout_pieces_mo}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ================= NAVIGATION =================
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{headerShown: false}} />
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{title: 'Créer un compte'}} />
        <Stack.Screen name="Home" component={HomeScreen} options={{title: 'Mon Garage', headerLeft: null}} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{title: 'Diagnostic'}} />
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{title: 'Ajout Véhicule'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
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
  fabContainer: { marginTop: 10, marginBottom: 30 }
});
