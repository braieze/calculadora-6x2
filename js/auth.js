import { auth, db, appId } from './firebase.js'; 
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { appState } from './state.js';
import { updateStatus, populateInputs, renderResults } from './ui.js';
import { refreshCalculation } from './main.js'; // <--- Importación correcta

let unsubscribeConfig = null;
let unsubscribeProfile = null; // Nuevo listener para el perfil

// Referencias a Firestore
const getConfigDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'config', 'salary');
const getDataDocRef = (userId, monthDocId) => doc(db, 'artifacts', appId, 'users', userId, 'data', monthDocId);
const getProfileDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'profile', 'details'); // NUEVA REFERENCIA

export async function initAuth() {
    updateStatus('info', 'Conectando...');

    // Controles de UI para Login (igual que antes)
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
            updateStatus('success', 'Sesión activa.');
        } else {
            signInAnonymously(auth).catch(e => updateStatus('error', 'Error login anónimo'));
        }
    });
}

function setupDataListeners(userId) {
    // 1. Listener de Configuración (igual que antes)
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
    
    // 2. Listener de Perfil (NUEVO)
    if (unsubscribeProfile) unsubscribeProfile();
    unsubscribeProfile = onSnapshot(getProfileDocRef(userId), (snap) => {
        if (snap.exists()) {
            const profileData = snap.data();
            // Actualizar el estado con los datos del perfil
            appState.profile = { ...appState.profile, ...profileData }; 
            
            // Opcional: Actualizar inputs de perfil en UI
            // Esto se implementará en el siguiente paso cuando agreguemos los inputs.
            
            refreshCalculation(); // Recalcular con los nuevos datos de perfil
        }
    });

    // 3. Listener de Datos Mensuales (Extras/Feriados) (igual que antes)
    refreshMonthListener(userId);
}

export function refreshMonthListener(userId = appState.user.id) {
    // ... (Función de refresh igual que antes)
}

// Guardar Configuración (igual que antes)
export function saveConfig() {
    if (!appState.user.id) return;
    setDoc(getConfigDocRef(appState.user.id), appState.config, { merge: true });
    refreshMonthListener();
}

// Guardar Datos (Extras/Feriados) (igual que antes)
export function saveData() {
    if (!appState.user.id) return;
    const monthId = `${appState.config.year}-${String(appState.config.month).padStart(2, '0')}`;
    setDoc(getDataDocRef(appState.user.id, monthId), {
        extras: appState.extraHours,
        holidayFlags: appState.manualHolidays
    }, { merge: true });
}

// GUARDAR DETALLES DEL PERFIL (NUEVO)
export function saveProfileDetails() {
    if (!appState.user.id || !appState.profile) return;
    
    // Convertir el monto del título a número antes de guardar
    appState.profile.tituloSum = Number(appState.profile.tituloSum || 0);

    setDoc(getProfileDocRef(appState.user.id), appState.profile, { merge: true });
}
