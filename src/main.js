import { initFirebase, signInAnonymouslyUser, signInWithGoogle, signOutUser, saveConfig, saveData, setupDataListeners } from './firebase.js';
import { calculateSchedule } from './calcLogic.js';
import { updateUIFromState, updateStatus, setLoading, updateAuthUI, generatePDFReport as renderPDF } from './uiRenderer.js';

// --- UTILIDADES DE INICIALIZACIÓN ---
function getYesterdayDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

// --- ESTADO GLOBAL ---
let appState = {
    // Valores iniciales (se sobrescribirán con Firestore si hay datos)
    config: {
        month: new Date().getDate() === 1 ? new Date().getMonth() : new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        valorHora: 3758,
        lastFrancoDate: getYesterdayDate(),
        initialTurn: 'Mañana',
        discountRate: 0.18,
    },
    extraHours: {},
    manualHolidays: {},
    calculationResult: null,
    
    // Estado de la Aplicación
    userId: null,
    userName: 'Usuario Local',
    isAuthReady: false,
    isGoogleAuthenticated: false,
    isFirebaseActive: true, 
    isLoading: false,
    status: null,
};

// --- MANEJADORES DE EVENTOS GLOBALES ---

/** Maneja cambios en los inputs de configuración. */
function handleConfigChange(inputEvent) {
    const target = inputEvent.target;
    const value = target.type === 'number' ? parseFloat(target.value) : target.value;
    const name = target.name;
    
    const newConfig = { ...appState.config, [name]: value };
    
    // Si el mes o año cambia, puede necesitar cambiar el listener de datos.
    const oldDocId = `${appState.config.year}-${String(appState.config.month).padStart(2, '0')}`;
    const newDocId = `${newConfig.year}-${String(newConfig.month).padStart(2, '0')}`;

    appState.config = newConfig;
    
    if (appState.isFirebaseActive && oldDocId !== newDocId) {
        setupDataListeners(
            appState.userId, 
            appState.config, 
            handleConfigUpdate, 
            handleDataUpdate
        );
    } 

    if (appState.userId && appState.isFirebaseActive) saveConfig(appState.userId, appState.config);
    
    // Re-calcular y actualizar UI localmente
    runCalculation(false);
}

/** Maneja cambios en la tabla de horas extra (dispara saveData). */
function handleExtraChange(dateKey, value) {
    const hours = parseFloat(value) || 0;
    if (hours > 0) {
        appState.extraHours[dateKey] = hours;
    } else {
        delete appState.extraHours[dateKey];
    }
    if (appState.userId && appState.isFirebaseActive) saveData(appState.userId, appState.config, appState.extraHours, appState.manualHolidays);
    runCalculation(false);
}

/** Maneja cambios en la tabla de feriados (dispara saveData). */
function handleHolidayChange(dateKey, checked) {
    if (checked) {
        appState.manualHolidays[dateKey] = true;
    } else {
        delete appState.manualHolidays[dateKey];
    }
    if (appState.userId && appState.isFirebaseActive) saveData(appState.userId, appState.config, appState.extraHours, appState.manualHolidays);
    runCalculation(false);
}

// --- FUNCIONES DE ACTUALIZACIÓN DE ESTADO (DESDE FIREBASE) ---

/** Callback para actualizar la configuración desde Firestore. */
function handleConfigUpdate(data) {
    appState.config = { 
        ...appState.config, 
        ...data,
        valorHora: Number(data.valorHora) || appState.config.valorHora,
        discountRate: Number(data.discountRate) || appState.config.discountRate,
        month: Number(data.month) || appState.config.month,
        year: Number(data.year) || appState.config.year,
    };
    runCalculation(false);
}

/** Callback para actualizar los datos del mes (extras/feriados) desde Firestore. */
function handleDataUpdate(extras, holidayFlags) {
    appState.extraHours = extras;
    appState.manualHolidays = holidayFlags;
    runCalculation(false);
}


// --- LÓGICA DE CÁLCULO Y RENDERIZADO ---

/** Ejecuta el cálculo y actualiza la UI. */
function runCalculation(isInitial) {
    if (isInitial) setLoading(true);

    const result = calculateSchedule(appState.config, appState.extraHours, appState.manualHolidays);
    
    appState.calculationResult = result;

    if (isInitial) {
        setLoading(false);
        updateStatus(result ? 'success' : 'error', result ? 'Cálculo generado. ¡Añade tus extras y feriados!' : 'Por favor, ingrese Valor Hora y Fecha de Último Franco válidos.');
    }

    // El último paso es renderizar la UI con el nuevo estado
    updateUIFromState(appState, handleExtraChange, handleHolidayChange);
}

// --- FUNCIÓN DE INICIALIZACIÓN DE LA APLICACIÓN ---

/** Listener principal de Firebase Auth. */
function authStateChangedHandler(user) {
    if (user) {
        appState.userId = user.uid;
        appState.userName = user.displayName || user.email || (user.isAnonymous ? 'Temporal' : 'Usuario');
        appState.isGoogleAuthenticated = !user.isAnonymous && user.providerData.some(p => p.providerId === 'google.com');
        appState.isAuthReady = true;
        
        updateStatus('success', `Sesión iniciada. Bienvenido, ${appState.userName}!`);
        
        // Configuramos los listeners de datos que dependen del userId
        setupDataListeners(appState.userId, appState.config, handleConfigUpdate, handleDataUpdate);
        
    } else {
        // Si no hay usuario (ej: después de un signOut), intentamos el anónimo
        signInAnonymouslyUser(); 
        appState.isGoogleAuthenticated = false;
        appState.isAuthReady = true;
        
        // Ejecutamos cálculo inicial si no estamos usando Firebase (fallback)
        if (!appState.isFirebaseActive) runCalculation(true);
    }
    
    // Actualizar la UI de Auth
    updateAuthUI(appState.userId, appState.userName, appState.isGoogleAuthenticated, signInWithGoogle, signOutUser);
}


/** Configura todos los listeners de la UI y lanza la inicialización. */
function setupEventListeners() {
    // Attach listeners to config inputs
    document.querySelectorAll('.input-style').forEach(input => {
        // Usamos el evento 'change' en lugar de 'input' para solo guardar y recalcular al terminar de editar
        input.addEventListener('change', handleConfigChange);
    });

    document.getElementById('calculate-schedule-button').addEventListener('click', () => runCalculation(true));
    
    document.getElementById('generate-pdf-button').addEventListener('click', () => {
        if (appState.calculationResult) {
            renderPDF(appState.calculationResult, appState.config);
        } else {
            updateStatus('error', 'Debe generar el cálculo antes de descargar el reporte.');
        }
    });
}

// --- INICIO ---
window.onload = () => {
    // 1. Configurar eventos de la UI
    setupEventListeners();

    // 2. Inicializar Firebase
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    const firebaseInitResult = initFirebase(initialAuthToken, authStateChangedHandler);
    
    if (firebaseInitResult && firebaseInitResult.error) {
        appState.isFirebaseActive = false;
        appState.userId = crypto.randomUUID(); 
        appState.userName = 'Local (Error)';
        appState.isAuthReady = true;
        updateStatus('error', `Error Crítico: ${firebaseInitResult.message}. La aplicación funcionará sin persistencia.`);
        runCalculation(true);
    }
    
    // 3. Renderizar el estado inicial de la UI
    updateUIFromState(appState, handleExtraChange, handleHolidayChange); 
};
