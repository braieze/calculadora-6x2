// Utilidades de fecha para el estado inicial
const getYesterdayDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
};

// Estado Global
export const appState = {
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
    isLoading: false,
    status: null,
    user: {
        id: null,
        name: 'Invitado',
        isAuthenticated: false
    }
};
