// ============================================================================
//  CONFIGURAZIONE FIREBASE
//  ----------------------------------------------------------------------------
//  Incolla qui la configurazione del TUO progetto Firebase.
//  La trovi in: Console Firebase -> Impostazioni progetto (ingranaggio) ->
//  sezione "Le tue app" -> App web -> "Configurazione SDK".
//
//  NB: questi valori NON sono segreti (apiKey compresa). La sicurezza dei dati
//  e' garantita dalle Security Rules (vedi firestore.rules),
//  non dal nascondere questa configurazione.
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyCuPVTdW7eWPLEhe3EpRKwQrZU_WQx5VNs",
  authDomain: "eventi-ferrara.firebaseapp.com",
  projectId: "eventi-ferrara",
  storageBucket: "eventi-ferrara.firebasestorage.app",
  messagingSenderId: "498348955359",
  appId: "1:498348955359:web:0c9a920971c1014755bb6a"
};

// Inizializzazione (SDK compat: espone l'oggetto globale `firebase`)
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
