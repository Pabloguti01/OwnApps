/* ====================================================
   Oscar Barber — Configuración del negocio
   Edita este archivo para personalizar la barbería.
   ==================================================== */

window.OB_CONFIG = {
    business: {
        name: "Oscar Barber",
        tagline: "Barbería a domicilio.",
        phone: "+34 600 000 000",
        email: "hola@oscarbarber.es",
        instagram: "@oscarbarber",
        serviceArea: "Servicio a domicilio"
    },

    /*
     * Horario semanal.
     * Clave = día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado).
     * Valor = array de turnos abiertos ese día (permite pausa para comer).
     * null = cerrado.
     */
    schedule: {
        0: null,
        1: [{ open: "09:00", close: "14:00" }],
        2: [{ open: "09:00", close: "14:00" }],
        3: [{ open: "09:00", close: "14:00" }],
        4: [{ open: "09:00", close: "14:00" }],
        5: [{ open: "09:00", close: "14:00" }],
        6: null,
    },

    /*
     * Días concretos cerrados (vacaciones, festivos).
     * Formato YYYY-MM-DD.
     */
    closedDates: [
        // "2026-08-15",
    ],

    booking: {
        slotIntervalMin: 15,
        maxDaysAhead: 60,
        minLeadTimeMin: 30,
    },

    /*
     * Notificación por email cuando se confirma una cita.
     * Usa FormSubmit (https://formsubmit.co) — no requiere registro.
     * Importante: la PRIMERA vez que se envía un email a una dirección,
     * FormSubmit envía a esa dirección un mensaje de activación.
     * Tienes que abrir ese email y pulsar el enlace de activación.
     * A partir de ahí, todas las reservas llegan automáticamente.
     */
    notifications: {
        emailTo: "pabloguti1006@gmail.com",
        enabled: true,
    },

    /*
     * Panel de administración (admin.html).
     * La contraseña vive en el cliente (no es seguridad real),
     * solo evita accesos casuales. Cambiala antes de publicar.
     */
    admin: {
        password: "oscar1234",
    },

    /*
     * Catálogo de servicios.
     * id: identificador único (no cambiar tras tener citas guardadas)
     * durationMin: duración en minutos (múltiplo del intervalo de slot)
     * price: número en euros
     */
    services: [
        {
            id: "corte",
            name: "Corte de pelo",
            description: "Corte clásico o moderno adaptado a tu estilo, en la comodidad de tu casa.",
            durationMin: 30,
            price: 10,
            icon: "✂"
        },
        {
            id: "corte-barba",
            name: "Corte + Barba",
            description: "Corte completo combinado con arreglo y perfilado de barba a domicilio.",
            durationMin: 45,
            price: 12,
            icon: "✂"
        },
    ],

    /*
     * Nombres de los días de la semana en español, lunes-primero.
     */
    weekdays: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    weekdaysShort: ["L", "M", "X", "J", "V", "S", "D"],
    months: [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ],
};
