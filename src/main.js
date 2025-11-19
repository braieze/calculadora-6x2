import { 
    initFirebase, 
    signInAnonymouslyUser, 
    signInWithGoogle, 
    signOutUser, 
    saveConfig, 
    saveData, 
    setupDataListeners, 
    loadPreviousConfig,
    setProfile
} from './firebase.js';
import { calculateSchedule } from './calcLogic.js';
import { 
    updateUIFromState, 
    updateStatus, 
    setLoading, 
    updateAuthUI, 
    generatePDFReport, 
    openModal,
    closeModal
} from './uiRenderer.js';

// Estado Global de la Aplicación
let appState = {
    auth: null,
    db: null,
    userId: null,
    unsubscribeListeners: null,
    config: {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        valorHora: 0.00, // Usar 0.00 para inicializar como flotante
        discountRate: 0.18,
        lastFrancoDate: '',
        initialTurn: 'Mañana',
    },
    data: null, // Resultado del cálculo
    profile: null, // Datos fijos del usuario (Categoría, Técnico)
    isAuthReady: false,
    isLoadingData: false, // Indicador de carga
};

// -------------------- MANEJO DE PERFIL --------------------

/**
 * Abre el modal de perfil y precarga los datos existentes.
 */
function openProfileModal() {
    if (appState.profile) {
        document.getElementById('input-category').value = appState.profile.category || '';
        document.getElementById('input-isTechnician').checked = appState.profile.isTechnician || false;
    } else {
        // Limpiar para nuevo registro
        document.getElementById('input-category').value = '';
        document.getElementById('input-isTechnician').checked = false;
    }
    openModal('profile-modal');
}

/**
 * Maneja el envío del formulario de perfil.
 * @param {Event} e - Evento de formulario.
 */
async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!appState.userId) return updateStatus('Error: Usuario no autenticado.', 'error');

    const category = document.getElementById('input-category').value.trim();
    const isTechnician = document.getElementById('input-isTechnician').checked;
    
    if (!category) {
        return updateStatus('Por favor, ingrese una categoría laboral.', 'warning');
    }

    const newProfile = { category, isTechnician };

    appState.isLoadingData = true;
    setLoading(true);
    await setProfile(appState.userId, newProfile); // Guarda en Firebase
    appState.isLoadingData = false;
    setLoading(false);

    closeModal('profile-modal');
    updateStatus('Perfil guardado exitosamente.', 'success');
}


// -------------------- MANEJO DE ESTADO Y FIREBASE --------------------

/**
 * Carga la configuración del mes anterior y la aplica a la UI/Estado.
 * @param {number} year - Año seleccionado.
 * @param {number} month - Mes seleccionado.
 */
async function loadInitialConfig(year, month) {
    if (!appState.userId) return;

    appState.isLoadingData = true;
    setLoading(true);
    
    // 1. Intentar cargar la configuración del mes anterior
    const prevConfig = await loadPreviousConfig(appState.userId, year, month);

    if (prevConfig) {
        // Si hay config previa, usarla como base y sobrescribir el periodo
        appState.config = { ...prevConfig, year, month };
        updateStatus(`Configuración base cargada del mes anterior (${prevConfig.month}/${prevConfig.year}).`, 'info');
    } else {
        // Si no hay config previa, mantener los valores por defecto o los cargados por el listener
        appState.config = { ...appState.config, year, month };
        updateStatus('Usando configuración por defecto para el nuevo mes.', 'info');
    }

    // 2. Aplicar la configuración al UI (input fields)
    syncInputsFromState();

    appState.isLoadingData = false;
    setLoading(false);
}

// ... initDataListeners (no cambia)

/**
 * Inicializa los listeners de datos de Firebase.
 * @param {string} userId - ID del usuario.
 */
function initDataListeners(userId) {
    // Si hay listeners activos, desuscribirse
    if (appState.unsubscribeListeners) {
        appState.unsubscribeListeners();
    }

    // Suscribirse a la configuración, datos y AHORA al perfil
    appState.unsubscribeListeners = setupDataListeners(
        userId,
        { year: appState.config.year, month: appState.config.month },
        (configData) => {
            // Callback de Configuración
            appState.config = { ...appState.config, ...configData };
            syncInputsFromState(); // Sincroniza la UI
        },
        (dataResults) => {
            // Callback de Resultados
            appState.data = dataResults;
            updateUIFromState(appState);
        },
        (profileData) => {
            // Callback de Perfil
            appState.profile = profileData;
            
            // Si el perfil no existe y el usuario está autenticado, forzar la apertura del modal
            if (appState.isAuthReady && appState.userId && !profileData) {
                updateStatus('¡Bienvenido! Por favor, configura tu perfil salarial.', 'warning');
                openProfileModal();
            } else {
                 // Si ya tiene perfil, simplemente actualiza la UI o usa los datos
                 updateUIFromState(appState);
            }
        }
    );
}

/**
 * Callback de Firebase que se llama al cambiar el estado de autenticación.
 * @param {import('firebase/auth').User | null} user - Objeto de usuario de Firebase.
 */
function handleAuthStateChange(user) {
    appState.isAuthReady = true;
    appState.auth = user;
    appState.userId = user ? user.uid : null;

    updateAuthUI(user); // Actualiza botones de Login/Logout/Usuario

    if (user && user.uid) {
        // Si el usuario está logueado, inicializar listeners y cargar configuración
        initDataListeners(user.uid);
        loadInitialConfig(appState.config.year, appState.config.month); 
        // El updateUIFromState final se hará cuando lleguen los datos del listener.
    } else {
        // Usuario desconectado
        if (appState.unsubscribeListeners) {
            appState.unsubscribeListeners();
            appState.unsubscribeListeners = null;
        }
        // Limpiar datos y desbloquear UI
        appState.data = null; 
        setLoading(false); 
        updateStatus('Inicia sesión para guardar y cargar tus datos.', 'info');
        updateUIFromState(appState); 
    }
}


// -------------------- MANEJO DE EVENTOS Y CÁLCULO --------------------

/**
 * Sincroniza los inputs de la UI con el estado local.
 */
function syncInputsFromState() {
    document.getElementById('input-month').value = appState.config.month;
    document.getElementById('input-year').value = appState.config.year;
    // Usar toFixed(2) para asegurar que se muestre como número flotante
    document.getElementById('input-valorHora').value = appState.config.valorHora.toFixed(2); 
    document.getElementById('input-discountRate').value = appState.config.discountRate;
    document.getElementById('input-lastFrancoDate').value = appState.config.lastFrancoDate;
    document.getElementById('input-initialTurn').value = appState.config.initialTurn;
}

/**
 * Recolecta los datos de configuración de la UI.
 * @returns {Object} La nueva configuración.
 */
function collectConfigFromUI() {
    return {
        month: parseInt(document.getElementById('input-month').value),
        year: parseInt(document.getElementById('input-year').value),
        // Asegurar que el valor sea un número, 0 si está vacío.
        valorHora: parseFloat(document.getElementById('input-valorHora').value) || 0, 
        discountRate: parseFloat(document.getElementById('input-discountRate').value) || 0.18,
        lastFrancoDate: document.getElementById('input-lastFrancoDate').value,
        initialTurn: document.getElementById('input-initialTurn').value,
    };
}

/**
 * Función principal para iniciar el cálculo.
 */
function startCalculation() {
    if (!appState.userId) {
        updateStatus('Debes iniciar sesión para realizar cálculos y guardar datos.', 'warning');
        return;
    }
    
    const newConfig = collectConfigFromUI();
    
    // 1. Guardar la nueva configuración (dispara onSnapshot)
    appState.config = newConfig;
    saveConfig(appState.userId, newConfig);

    appState.isLoadingData = true;
    setLoading(true);
    updateStatus('Calculando y generando horario...', 'info');

    try {
        // 2. Ejecutar la lógica de cálculo
        const calculationResults = calculateSchedule(appState.config, appState.data, appState.profile);

        // 3. Guardar los resultados (esto dispara el onSnapshot y actualiza la UI)
        saveData(appState.userId, calculationResults);

        updateStatus('Cálculo finalizado y datos guardados.', 'success');
    } catch (error) {
        console.error("Error durante el cálculo:", error);
        updateStatus(`Error en el cálculo: ${error.message}`, 'error');
    } finally {
        appState.isLoadingData = false;
        // set Loading false se hace en onSnapshot de dataResults para asegurar que la UI se actualice
    }
}

/**
 * Maneja el cambio en los selectores de Mes/Año.
 */
function handlePeriodChange() {
    if (!appState.userId) {
        updateStatus('Debes iniciar sesión para cambiar el período.', 'warning');
        return;
    }
    const newConfig = collectConfigFromUI();
    const isNewPeriod = newConfig.month !== appState.config.month || newConfig.year !== appState.config.year;

    if (isNewPeriod) {
        appState.config = newConfig; 
        
        // Recargar configuración anterior y establecer nuevos listeners para el nuevo período
        initDataListeners(appState.userId);
        loadInitialConfig(newConfig.year, newConfig.month);
    }
}

/**
 * Maneja el cambio en los inputs de configuración (Valor Hora, Tasa Descuento, etc.)
 */
function handleConfigInputChange() {
     if (!appState.userId) {
        updateStatus('Debes iniciar sesión para guardar tu configuración.', 'warning');
        return;
    }
    const newConfig = collectConfigFromUI();
    // Guardar inmediatamente la configuración modificada
    appState.config = newConfig;
    saveConfig(appState.userId, newConfig); 
}


// -------------------- INICIALIZACIÓN --------------------

/**
 * Configura los eventos iniciales.
 */
function setupEventListeners() {
    // Autenticación
    document.getElementById('google-login-btn').addEventListener('click', signInWithGoogle);
    document.getElementById('logout-btn').addEventListener('click', signOutUser);
    
    // Perfil
    document.getElementById('profile-btn').addEventListener('click', openProfileModal);
    document.getElementById('profile-form').addEventListener('submit', handleProfileSubmit);
    document.getElementById('close-profile-modal-btn').addEventListener('click', () => closeModal('profile-modal'));

    // Configuración y Cálculo
    document.getElementById('calculate-schedule-button').addEventListener('click', startCalculation);
    document.getElementById('generate-pdf-button').addEventListener('click', () => generatePDFReport(appState));
    
    // Eventos de cambio para Mes y Año (para recargar config anterior)
    document.getElementById('input-month').addEventListener('change', handlePeriodChange);
    document.getElementById('input-year').addEventListener('change', handlePeriodChange);

    // Eventos de cambio para guardar config al volar (resto de inputs)
    const configInputs = ['input-valorHora', 'input-discountRate', 'input-lastFrancoDate', 'input-initialTurn'];
    configInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', handleConfigInputChange);
    });

    // Delegación de eventos para las casillas de feriado y horas extra (en la tabla de UI)
    document.getElementById('daily-detail-tbody').addEventListener('change', (e) => {
        if (e.target.dataset.field === 'isHoliday' || e.target.dataset.field === 'extraHours') {
            const index = parseInt(e.target.dataset.index);
            const value = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value) || 0;
            
            if (appState.data && appState.data.schedule && index >= 0 && appState.userId) {
                appState.data.schedule[index][e.target.dataset.field] = value;
                
                const updatedResults = calculateSchedule(appState.config, appState.data, appState.profile); 
                saveData(appState.userId, updatedResults);
            } else if (!appState.userId) {
                 updateStatus('Debes iniciar sesión para interactuar con los datos guardados.', 'warning');
            }
        }
    });

    // Inicializar selectores de Mes y Año
    const monthSelect = document.getElementById('input-month');
    const currentMonth = new Date().getMonth() + 1;
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = new Date(0, i, 0).toLocaleDateString('es-ES', { month: 'long' });
        monthSelect.appendChild(option);
    }

    monthSelect.value = currentMonth;
    
    const yearInput = document.getElementById('input-year');
    const currentYear = new Date().getFullYear();
    yearInput.value = currentYear;

    // Sincronizar estado inicial
    appState.config.month = currentMonth;
    appState.config.year = currentYear;
    syncInputsFromState();
    
    // Asegurar que la UI se renderice al inicio con los valores por defecto
    updateUIFromState(appState); 
}

// Iniciar la aplicación
window.onload = function () {
    const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    initFirebase(initialToken, handleAuthStateChange);
    setupEventListeners();
    updateStatus('Esperando autenticación...', 'info');
};
