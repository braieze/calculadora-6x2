import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    getDoc,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Configuración global (MANDATORIO: No modificar estas variables)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// FIX: Asegurar que se parsee correctamente
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

let app;
let db;
let auth;

/**
 * Obtiene la referencia al documento de configuración de un usuario para un mes/año específico.
 * Colección: /artifacts/{appId}/users/{userId}/configs
 * @param {string} userId - ID del usuario.
 * @param {number} year - Año de la configuración.
 * @param {number} month - Mes de la configuración (1-12).
 * @returns {import('firebase/firestore').DocumentReference}
 */
const getConfigDocRef = (userId, year, month) => {
    const configPath = `/artifacts/${appId}/users/${userId}/configs`;
    return doc(db, configPath, `${year}-${month}`);
};

/**
 * Obtiene la referencia al documento de datos de resultados de un usuario para un mes/año específico.
 * Colección: /artifacts/{appId}/users/{userId}/data
 * @param {string} userId - ID del usuario.
 * @param {number} year - Año de los datos.
 * @param {number} month - Mes de los datos (1-12).
 * @returns {import('firebase/firestore').DocumentReference}
 */
const getDataDocRef = (userId, year, month) => {
    const dataPath = `/artifacts/${appId}/users/{userId}/data`;
    // Nota: El path es un poco diferente para que se guarde en la carpeta privada del usuario
    const fullPath = `/artifacts/${appId}/users/${userId}/data`;
    return doc(db, fullPath, `${year}-${month}`);
};


/**
 * Obtiene la referencia al documento de Perfil de Usuario.
 * Colección: /artifacts/{appId}/users/{userId}/profile/userProfile
 * @param {string} userId - ID del usuario.
 * @returns {import('firebase/firestore').DocumentReference}
 */
const getProfileDocRef = (userId) => {
    const profilePath = `/artifacts/${appId}/users/${userId}/profile`;
    // Usamos un ID fijo 'userProfile' para el documento de perfil
    return doc(db, profilePath, 'userProfile'); 
};


// -------------------- FUNCIONES PÚBLICAS DE AUTENTICACIÓN --------------------

/**
 * Inicializa Firebase y establece el listener de autenticación.
 * @param {string} initialAuthToken - Token de autenticación inicial.
 * @param {(user: import('firebase/auth').User | null) => void} onAuthStateChangeCallback - Callback a llamar al cambiar el estado de autenticación.
 * @returns {Promise<void>}
 */
export async function initFirebase(initialAuthToken, onAuthStateChangeCallback) {
    try {
        setLogLevel('debug'); // Para depuración
        // FIX: Comprobar si firebaseConfig tiene el mínimo para inicializar
        if (!firebaseConfig || !firebaseConfig.projectId) {
            console.error("Configuración de Firebase incompleta. Inicialización omitida.");
            return;
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // 1. Establecer el listener de estado de autenticación
        onAuthStateChanged(auth, onAuthStateChangeCallback);

        // 2. Intentar autenticación inicial
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            // Intentamos anónima como base, el listener lo detectará.
            await signInAnonymously(auth); 
        }
    } catch (error) {
        console.error("Error inicializando Firebase o autenticando:", error);
    }
}

/**
 * Inicia sesión con Google.
 */
export async function signInWithGoogle() {
    // FIX: Asegurar que 'auth' exista
    if (!auth) {
        console.error("El objeto de autenticación no está inicializado.");
        return;
    }
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error al iniciar sesión con Google:", error);
    }
}

/**
 * Cierra la sesión del usuario.
 */
export async function signOutUser() {
    // FIX: Asegurar que 'auth' exista
    if (!auth) {
        console.error("El objeto de autenticación no está inicializado.");
        return;
    }
    try {
        await signOut(auth);
        // Volver a iniciar sesión de forma anónima
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}


// -------------------- FUNCIONES PÚBLICAS DE PERSISTENCIA --------------------

/**
 * Carga la configuración del mes/año anterior para usar como valores iniciales.
 * @param {string} userId - ID del usuario.
 * @param {number} currentYear - Año actual.
 * @param {number} currentMonth - Mes actual (1-12).
 * @returns {Promise<Object | null>} - Configuración del mes anterior o null.
 */
export async function loadPreviousConfig(userId, currentYear, currentMonth) {
    if (!db) return null;
    try {
        // Calcular mes y año anterior
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear -= 1;
        }

        const docRef = getConfigDocRef(userId, prevYear, prevMonth);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log(`Configuración del mes anterior (${prevYear}-${prevMonth}) cargada.`);
            return docSnap.data();
        }

        return null;

    } catch (error) {
        console.error("Error al cargar la configuración anterior:", error);
        return null;
    }
}

/**
 * Establece los listeners en tiempo real para la configuración y los datos.
 * @param {string} userId - ID del usuario.
 * @param {{year: number, month: number}} currentPeriod - Período actual.
 * @param {(config: Object) => void} onConfigUpdate - Callback para la actualización de configuración.
 * @param {(data: Object) => void} onDataUpdate - Callback para la actualización de datos.
 * @param {(profile: Object | null) => void} onProfileUpdate - Callback para la actualización de perfil.
 * @returns {() => void} - Función para desuscribirse de todos los listeners.
 */
export function setupDataListeners(userId, currentPeriod, onConfigUpdate, onDataUpdate, onProfileUpdate) {
    if (!db || !userId) {
        console.warn("Firestore no inicializado o userId no disponible.");
        return () => {};
    }

    const { year, month } = currentPeriod;
    const configDocRef = getConfigDocRef(userId, year, month);
    const dataDocRef = getDataDocRef(userId, year, month);
    const profileDocRef = getProfileDocRef(userId); 

    // Función auxiliar para convertir Timestamps a Date, si es necesario
    const convertTimestampToDate = (item) => {
        // Verifica si existe el campo 'date' y si tiene la función toDate (es un Timestamp)
        if (item && item.date && typeof item.date.toDate === 'function') {
            return { ...item, date: item.date.toDate() };
        }
        return item;
    };

    // 1. Listener de Configuración
    const unsubscribeConfig = onSnapshot(configDocRef, (doc) => {
        if (doc.exists()) {
            onConfigUpdate(doc.data());
        } else {
            onConfigUpdate({}); 
        }
    }, (error) => console.error("Error en el listener de Config:", error));

    // 2. Listener de Datos (Resultados)
    const unsubscribeData = onSnapshot(dataDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            
            // CONVERSIÓN CRÍTICA: Convertir Timestamps a Date en el schedule
            if (data.schedule && Array.isArray(data.schedule)) {
                data.schedule = data.schedule.map(convertTimestampToDate);
            }
            
            // CONVERSIÓN CRÍTICA: Convertir Timestamps a Date en las fechas de pago
            if (data.paymentDates && Array.isArray(data.paymentDates)) {
                data.paymentDates = data.paymentDates.map(convertTimestampToDate);
            }
            
            onDataUpdate(data);
        } else {
            onDataUpdate(null);
        }
    }, (error) => console.error("Error en el listener de Datos:", error));
    
    // 3. Listener de Perfil
    const unsubscribeProfile = onSnapshot(profileDocRef, (doc) => {
        if (doc.exists()) {
            onProfileUpdate(doc.data());
        } else {
            onProfileUpdate(null);
        }
    }, (error) => console.error("Error en el listener de Perfil:", error));


    // Retornar una función para desuscribirse de todos los listeners
    return () => {
        unsubscribeConfig();
        unsubscribeData();
        unsubscribeProfile();
    };
}

/**
 * Guarda la configuración del mes/año actual.
 * @param {string} userId - ID del usuario.
 * @param {Object} config - Objeto de configuración.
 * @returns {Promise<void>}
 */
export function saveConfig(userId, config) {
    if (!db || !config || !config.year || !config.month) return;
    try {
        const docRef = getConfigDocRef(userId, config.year, config.month);
        setDoc(docRef, config, { merge: true }); 
    } catch (error) {
        console.error("Error al guardar la configuración:", error);
    }
}

/**
 * Guarda los resultados del cálculo (datos).
 * @param {string} userId - ID del usuario.
 * @param {Object} data - Objeto de datos (horario, horas extra, etc.).
 * @returns {Promise<void>}
 */
export function saveData(userId, data) {
    if (!db || !data || !data.year || !data.month) return;
    try {
        const docRef = getDataDocRef(userId, data.year, data.month);
        setDoc(docRef, data, { merge: true });
    } catch (error) {
        console.error("Error al guardar los datos:", error);
    }
}

/**
 * Guarda el perfil del usuario.
 * @param {string} userId - ID del usuario.
 * @param {{ category: string, isTechnician: boolean }} profile - Objeto con los datos del perfil.
 * @returns {Promise<void>}
 */
export async function setProfile(userId, profile) {
    if (!db || !userId) return;
    try {
        const profileDocRef = getProfileDocRef(userId);
        // Usamos merge para solo actualizar los campos que pasamos
        await setDoc(profileDocRef, profile, { merge: true }); 
        console.log("Perfil guardado exitosamente.");
    } catch (error) {
        console.error("Error al guardar el perfil:", error);
    }
}
