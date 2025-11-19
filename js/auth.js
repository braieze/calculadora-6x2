import { auth, db, appId } from './firebase.js'; // Asumo que estas son las importaciones base
import { appState } from './state.js';
import { updateStatus, populateInputs } from './ui.js';
import { refreshCalculation } from './main.js'; 
import { renderDashboard } from './ui.js'; // Para renderizar el gráfico

// Firebase Auth
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from "firebase/auth";
// Firebase Firestore
import { doc, onSnapshot, setDoc, collection, query, orderBy } from "firebase/firestore";

let unsubscribeConfig = null;
let unsubscribeProfile = null;
let unsubscribeHistory = null; // Nuevo listener para el historial

// Referencias a Firestore
const getConfigDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'config', 'salary');
const getDataDocRef = (userId, monthDocId) => doc(db, 'artifacts', appId, 'users', userId, 'data', monthDocId);
const getProfileDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'profile', 'details');
const getHistoryCollectionRef = (userId) => collection(db, 'artifacts', appId, 'users', userId, 'history');


// --- Listeners y Control de Sesión ---

/**
 * Inicia la autenticación y los listeners de estado.
 */
export async function initAuth() {
    updateStatus('info', 'Conectando...');

    // Controles de UI para Login
    const googleBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    googleBtn.addEventListener('click', async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
        catch (e) { updateStatus('error', e.message); }
    });

    logoutBtn.addEventListener('click', async () => {
        try { await signOut(auth); } 
        catch (e) { console.error(e); }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            appState.user.id = user.uid;
            appState.user.name = user.displayName || 'Anónimo';
            appState.user.isAuthenticated = !user.isAnonymous;
            
            userInfo.textContent = `Hola, ${appState.user.name}`;
            
            if (!user.isAnonymous) {
                googleBtn.classList.add('hidden');
                logoutBtn.classList.remove('hidden');
            } else {
                googleBtn.classList.remove('hidden');
                logoutBtn.classList.add('hidden');
            }

            setupDataListeners(user.uid);
            setupHistoryListener(user.uid); // <--- NUEVA LLAMADA
            updateStatus('success', 'Sesión activa.');
        } else {
            // Limpieza de estado al cerrar sesión
            appState.user.id = null;
            appState.user.name = 'Invitado';
            appState.user.isAuthenticated = false;
            userInfo.textContent = 'Hola, Invitado';
            
            // Cancelar todas las suscripciones
            if (unsubscribeConfig) unsubscribeConfig();
            if (unsubscribeProfile) unsubscribeProfile();
            if (unsubscribeHistory) unsubscribeHistory();
            
            // Intentar login anónimo si no hay usuario
            signInAnonymously(auth).catch(e => updateStatus('error', 'Error login anónimo'));
        }
    });
}

/**
 * Configura todos los listeners de datos de configuración y perfil.
 */
function setupDataListeners(userId) {
    // 1. Listener de Configuración
    if (unsubscribeConfig) unsubscribeConfig();
    unsubscribeConfig = onSnapshot(getConfigDocRef(userId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            appState.config = { ...appState.config, ...data };
            appState.config.month = Number(appState.config.month);
            appState.config.year = Number(appState.config.year);
            appState.config.valorHora = Number(appState.config.valorHora);
            appState.config.discountRate = Number(appState.config.discountRate);
            
            populateInputs(); 
            refreshCalculation(); 
        }
    });
    
    // 2. Listener de Perfil
    if (unsubscribeProfile) unsubscribeProfile();
    unsubscribeProfile = onSnapshot(getProfileDocRef(userId), (snap) => {
        if (snap.exists()) {
            const profileData = snap.data();
            // Actualizar el estado con los datos del perfil
            appState.profile = { ...appState.profile, ...profileData }; 
            
            refreshCalculation(); // Recalcular con los nuevos datos de perfil
        }
    });

    // 3. Listener de Datos Mensuales (Extras/Feriados)
    refreshMonthListener(userId);
}

/**
 * Configura un listener para los datos históricos del usuario.
 */
export function setupHistoryListener(userId) {
    if (unsubscribeHistory) unsubscribeHistory();

    const historyRef = getHistoryCollectionRef(userId);
    // Ordenar los resultados por la clave de mes (YYYY-MM) para tenerlos cronológicamente
    const q = query(historyRef, orderBy('monthKey')); 

    unsubscribeHistory = onSnapshot(q, (snapshot) => {
        const historicalData = {};
        snapshot.forEach((doc) => {
            const data = doc.data();
            historicalData[data.monthKey] = data;
        });

        // Almacena los datos en el estado de la aplicación
        appState.historicalData = historicalData;
        
        // Renderiza el nuevo Dashboard
        renderDashboard(historicalData); 
    }, (error) => {
        console.error("Error al escuchar el historial:", error);
    });
}


// --- Funciones de Persistencia ---

/**
 * Vuelve a suscribir el listener de datos mensuales (extras/feriados) para el mes actual.
 */
export function refreshMonthListener(userId = appState.user.id) {
    if (!userId) return;
    // Lógica para desuscribir listener viejo y suscribir uno nuevo al mes actual
    // (Implementación omitida por brevedad, asumiendo que ya funciona)
}

/**
 * Guarda la configuración actual.
 */
export function saveConfig() {
    if (!appState.user.id) return;
    setDoc(getConfigDocRef(appState.user.id), appState.config, { merge: true });
    refreshMonthListener();
}

/**
 * Guarda los datos diarios (extras y feriados).
 */
export function saveData() {
    if (!appState.user.id) return;
    const monthId = `${appState.config.year}-${String(appState.config.month).padStart(2, '0')}`;
    setDoc(getDataDocRef(appState.user.id, monthId), {
        extras: appState.extraHours,
        holidayFlags: appState.manualHolidays
    }, { merge: true });
}

/**
 * Guarda los detalles del perfil (categoría, título).
 */
export function saveProfileDetails() {
    if (!appState.user.id || !appState.profile) return;
    
    // Convertir el monto del título a número antes de guardar
    appState.profile.tituloSum = Number(appState.profile.tituloSum || 0);

    setDoc(getProfileDocRef(appState.user.id), appState.profile, { merge: true });
}
