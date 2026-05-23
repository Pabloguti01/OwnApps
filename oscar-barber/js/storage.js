/* ============================================================
   Oscar Barber — Persistencia de citas en localStorage

   Esquema actual (v2):
   {
     id, createdAt,
     serviceId, serviceName, durationMin, price,
     date,         // 'YYYY-MM-DD'
     startMin,     // minutos desde medianoche (ej. 600 para 10:00)
     endMin,       // startMin + durationMin
     customer: { name, phone, email, notes },
     address,      // dirección de servicio a domicilio
     addressNotes, // referencias para llegar
     status        // 'confirmed' | 'cancelled'
   }

   Esquema v1 (legacy) usaba `time: "HH:MM"` y no tenía address.
   Se migra automáticamente al leer.
   ============================================================ */

(function () {
    const STORAGE_KEY = "ob_appointments_v1"; // mantenemos la clave para no perder datos

    function readRaw() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.warn("OBStorage: no se pudo leer localStorage", err);
            return [];
        }
    }

    function writeAll(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            return true;
        } catch (err) {
            console.error("OBStorage: no se pudo escribir en localStorage", err);
            return false;
        }
    }

    function parseTimeStr(str) {
        if (typeof str !== "string") return null;
        const [h, m] = str.split(":").map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    }

    function migrate(record) {
        // v1 → v2: convertir time → startMin/endMin
        if (record.startMin == null && record.time) {
            const start = parseTimeStr(record.time);
            if (start != null) {
                record.startMin = start;
                record.endMin = start + (record.durationMin || 30);
            }
        }
        if (record.address == null) record.address = "";
        if (record.addressNotes == null) record.addressNotes = "";
        if (!record.status) record.status = "confirmed";
        return record;
    }

    function readAll() {
        return readRaw().map(migrate);
    }

    function generateId() {
        const rand = Math.floor(Math.random() * 9000) + 1000;
        return "OB-" + Date.now().toString(36).toUpperCase().slice(-4) + rand;
    }

    const OBStorage = {
        STORAGE_KEY,

        getAll() {
            return readAll();
        },

        getById(id) {
            return readAll().find(a => a.id === id) || null;
        },

        getForDate(dateStr) {
            return readAll().filter(a => a.date === dateStr);
        },

        /**
         * Guarda o actualiza una cita. Acepta el formato nuevo
         * (con startMin/endMin/address) o el formato antiguo (con time)
         * por compatibilidad.
         */
        save(appointment) {
            const list = readAll();
            const durationMin = appointment.durationMin || 30;

            // Resolver startMin (acepta legacy `time`)
            let startMin = appointment.startMin;
            if (startMin == null && appointment.time) {
                startMin = parseTimeStr(appointment.time);
            }
            const endMin = appointment.endMin != null
                ? appointment.endMin
                : (startMin != null ? startMin + durationMin : null);

            const record = {
                id: appointment.id || generateId(),
                createdAt: appointment.createdAt || new Date().toISOString(),
                serviceId: appointment.serviceId,
                serviceName: appointment.serviceName,
                durationMin: durationMin,
                price: appointment.price,
                date: appointment.date,
                startMin: startMin,
                endMin: endMin,
                customer: {
                    name: appointment.customer?.name || "",
                    phone: appointment.customer?.phone || "",
                    email: appointment.customer?.email || "",
                    notes: appointment.customer?.notes || "",
                },
                address: appointment.address || "",
                addressNotes: appointment.addressNotes || "",
                status: appointment.status || "confirmed",
            };

            const existingIdx = list.findIndex(a => a.id === record.id);
            if (existingIdx >= 0) {
                list[existingIdx] = record;
            } else {
                list.push(record);
            }
            writeAll(list);
            return record;
        },

        remove(id) {
            const list = readAll().filter(a => a.id !== id);
            return writeAll(list);
        },

        clear() {
            return writeAll([]);
        },
    };

    window.OBStorage = OBStorage;
})();
