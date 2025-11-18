// Importaciones de Firebase (Usando CDN paths para modularidad sin build tool)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE (PROPORCIONADA POR EL USUARIO) ---
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC_gewonkD_XnzQmwmUnQuhfzOf5zdm9lw",
    authDomain: "calculadora-6x2.firebaseapp.com",
    projectId: "calculadora-6x2",
    storageBucket: "calculadora-6x2.firebasestorage.app",
    messagingSenderId: "238926197886",
    appId: "1:238926197886:web:d05857b007dcb305e9d42f"
};

// Variables de Instancia
let app;
let auth;
let db;
let unsubscribeConfig = null;
let unsubscribeData = null;

// Rutas de Firestore (Usando las variables globales inyectadas por Canvas)
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

function getConfigDocRef(userId) {
    if (!db || !userId) return null;
    return doc(db, 'artifacts', APP_ID, 'users', userId, 'config', 'salary');
}
function getDataDocRef(userId, monthDocId) {
    if (!db || !userId) return null;
    return doc(db, 'artifacts', APP_ID, 'users', userId, 'data', monthDocId);
}

/**
 * Inicializa Firebase y configura el listener de autenticación.
 * @param {string|null} initialAuthToken - Token de Firebase Custom Auth del entorno.
 * @param {function} onAuthStateChangeCallback - Callback a ejecutar al cambiar el estado de Auth.
 */
export async function initFirebase(initialAuthToken, onAuthStateChangeCallback) {
    try {
        app = initializeApp(FIREBASE_CONFIG); 
        auth = getAuth(app);
        db = getFirestore(app);
        
        // Autenticar con el token de entorno (si existe)
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } 

        onAuthStateChanged(auth, onAuthStateChangeCallback);

    } catch (error) {
        console.error("Error crítico al inicializar Firebase:", error);
        return { error: true, message: error.message };
    }
}

/** Inicia sesión anónimamente si no hay usuario. */
export async function signInAnonymouslyUser() {
    if (!auth) return;
    try {
        await signInAnonymously(auth);
    } catch (e) {
        console.error("Fallo de autenticación anónima:", e);
    }
}

/** Inicia sesión con Google. */
export async function signInWithGoogle() {
    if (!auth) throw new Error('Firebase Auth no inicializado.');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
}

/** Cierra la sesión actual. */
export async function signOutUser() {
    if (!auth) return;
    await signOut(auth);
}

/**
 * Configura los listeners de datos (Configuración y Datos del Mes)
 * @param {string} userId - ID del usuario.
 * @param {object} config - Configuración actual.
 * @param {function} onConfigUpdate - Callback para actualizar la configuración.
 * @param {function} onDataUpdate - Callback para actualizar los datos del mes (extras/feriados).
 */
export function setupDataListeners(userId, config, onConfigUpdate, onDataUpdate) {
    // 1. Listener de Configuración
    if (unsubscribeConfig) unsubscribeConfig();
    const configRef = getConfigDocRef(userId);
    if (configRef) {
        unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
            if (docSnap.exists()) {
                onConfigUpdate(docSnap.data());
            } else {
                saveConfig(userId, config); // Guardar por primera vez
            }
        }, (error) => {
            console.error("Error fetching config:", error);
        });
    }

    // 2. Listener de Datos (Horas Extra y Feriados Manuales)
    if (unsubscribeData) unsubscribeData();
    const monthDocId = `${config.year}-${String(config.month).padStart(2, '0')}`;
    const dataRef = getDataDocRef(userId, monthDocId);
    if (dataRef) {
        unsubscribeData = onSnapshot(dataRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                onDataUpdate(data.extras || {}, data.holidayFlags || {});
            } else {
                onDataUpdate({}, {}); // Limpiar si no hay datos para el nuevo mes
            }
        }, (error) => {
            console.error("Error fetching month data:", error);
        });
    }
}

/**
 * Guarda la configuración general del usuario.
 */
export function saveConfig(userId, config) {
    const configRef = getConfigDocRef(userId);
    if (!configRef) return;
    
    const dataToSave = { ...config };
    // Asegurar tipos numéricos para Firestore
    dataToSave.valorHora = Number(dataToSave.valorHora);
    dataToSave.discountRate = Number(dataToSave.discountRate);
    dataToSave.month = Number(dataToSave.month); 
    dataToSave.year = Number(dataToSave.year);

    setDoc(configRef, dataToSave, { merge: true })
        .catch(error => {
            console.error("Error saving config:", error);
        });
}

/**
 * Guarda las horas extra y banderas de feriado del mes.
 */
export function saveData(userId, config, extraHours, manualHolidays) {
    const monthDocId = `${config.year}-${String(config.month).padStart(2, '0')}`;
    const dataRef = getDataDocRef(userId, monthDocId);
    if (!dataRef) return;
    
    setDoc(dataRef, { 
        extras: extraHours,
        holidayFlags: manualHolidays
    }, { merge: true })
    .catch(error => {
        console.error("Error saving month data:", error);
    });
}
