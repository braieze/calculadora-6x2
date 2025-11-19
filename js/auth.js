import { auth, db, appId } from './firebase.js'; // Asegúrate de que firebase.js exista
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { appState } from './state.js';
import { updateStatus, populateInputs, renderResults } from './ui.js';
import { calculateSalaryData } from './logic.js';

let unsubscribeConfig = null;
let unsubscribeData = null;

// Referencias a Firestore
const getConfigDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'config', 'salary');
const getDataDocRef = (userId, monthDocId) => doc(db, 'artifacts', appId, 'users', userId, 'data', monthDocId);

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
            updateStatus('success', 'Sesión activa.');
        } else {
            signInAnonymously(auth).catch(e => updateStatus('error', 'Error login anónimo'));
        }
    });
}

function setupDataListeners(userId) {
    // 1. Listener de Configuración
    if (unsubscribeConfig) unsubscribeConfig();
    unsubscribeConfig = onSnapshot(getConfigDocRef(userId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            // Actualizamos estado y UI
            appState.config = { ...appState.config, ...data };
            // Asegurar tipos numéricos
            appState.config.month = Number(appState.config.month);
            appState.config.year = Number(appState.config.year);
            appState.config.valorHora = Number(appState.config.valorHora);
            appState.config.discountRate = Number(appState.config.discountRate);
            
            populateInputs(); // Actualiza los inputs visuales con los datos traídos
            window.refreshCalculation(); // Recalcula todo
        }
    });

    // 2. Listener de Datos Mensuales (Extras/Feriados)
    refreshMonthListener(userId);
}

export function refreshMonthListener(userId = appState.user.id) {
    if (!userId) return;
    const { year, month } = appState.config;
    const monthId = `${year}-${String(month).padStart(2, '0')}`;

    if (unsubscribeData) unsubscribeData();
    
    unsubscribeData = onSnapshot(getDataDocRef(userId, monthId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            appState.extraHours = data.extras || {};
            appState.manualHolidays = data.holidayFlags || {};
        } else {
            appState.extraHours = {};
            appState.manualHolidays = {};
        }
        window.refreshCalculation();
    });
}

// Guardar Configuración
export function saveConfig() {
    if (!appState.user.id) return;
    // Al guardar config, verificamos si cambió el mes para actualizar listeners
    const currentMonthId = `${appState.config.year}-${String(appState.config.month).padStart(2, '0')}`;
    
    setDoc(getConfigDocRef(appState.user.id), appState.config, { merge: true });
    
    // Pequeño hack: verificamos si necesitamos recargar los datos del mes (si cambió mes/año)
    // Lo ideal es hacerlo comparando con el estado anterior, pero por simplicidad, 
    // refreshMonthListener es ligero.
    refreshMonthListener();
}

// Guardar Datos (Extras/Feriados)
export function saveData() {
    if (!appState.user.id) return;
    const monthId = `${appState.config.year}-${String(appState.config.month).padStart(2, '0')}`;
    setDoc(getDataDocRef(appState.user.id, monthId), {
        extras: appState.extraHours,
        holidayFlags: appState.manualHolidays
    }, { merge: true });
}
