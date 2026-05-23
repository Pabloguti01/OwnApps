/* ====================================================
   Oscar Barber — Configuración del negocio
   Edita este archivo para personalizar la barbería.
   ==================================================== */

window.OB_CONFIG = {
    pocketbase: {
        baseUrl: "/pb",   // nginx proxea /pb/ → PocketBase en puerto 8090
    },

    business: {
        name: "OscarBarber",
        tagline: "Barbería a domicilio.",
        city: "Sevilla",
        phone: "+34 666 666 666",  // ← cambiar por el teléfono real de Oscar
        email: "hola@oscarbarber.es",
        instagram: "@oscarbarber",
        serviceArea: "Servicio a domicilio en Sevilla y alrededores"
    },

    /*
     * Horario semanal.
     * Clave = día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado).
     * Valor = array de turnos abiertos ese día (permite pausa para comer).
     * null = cerrado.
     */
    schedule: {
        0: null,
        1: [{ open: "10:00", close: "14:00" }],
        2: [{ open: "10:00", close: "14:00" }],
        3: [{ open: "10:00", close: "14:00" }],
        4: [{ open: "10:00", close: "14:00" }],
        5: [{ open: "10:00", close: "14:00" }],
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
        slotIntervalMin: 15,         // separación entre slots reservables
        maxDaysAhead: 60,            // hasta cuántos días vista permitir reservar
        minLeadTimeMin: 30,          // antelación mínima para reservas el mismo día
        travelBufferMin: 30,         // minutos de traslado entre citas a domicilio
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
     * Panel de administración (se abre desde [ADMIN] en el footer o
     * mediante long-press de 1.5s sobre el logo).
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
            description: "Lavado opcional, corte a tijera o máquina según el estilo, perfilado de patillas y acabado con producto.",
            durationMin: 30,
            price: 10,
        },
        {
            id: "corte-barba",
            name: "Corte + Barba",
            description: "Servicio completo: corte de pelo con todos los pasos + perfilado de barba con navaja, toalla caliente y aceite.",
            durationMin: 30,
            price: 12,
        },
    ],

    /*
     * Nombres de los días de la semana en español, lunes-primero.
     */
    weekdays: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"],
    weekdaysShort: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    weekdaysOneLetter: ["L", "M", "X", "J", "V", "S", "D"],
    months: [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ],
    monthsShort: [
        "Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ],
};
