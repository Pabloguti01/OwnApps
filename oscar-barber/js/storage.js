/* ============================================================
   Oscar Barber — Persistencia de citas en localStorage
   ============================================================ */

(function () {
    const STORAGE_KEY = "ob_appointments_v1";

    function readAll() {
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

    function generateId() {
        return "ob_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

        save(appointment) {
            const list = readAll();
            const record = {
                id: appointment.id || generateId(),
                createdAt: appointment.createdAt || new Date().toISOString(),
                serviceId: appointment.serviceId,
                serviceName: appointment.serviceName,
                durationMin: appointment.durationMin,
                price: appointment.price,
                date: appointment.date,
                time: appointment.time,
                customer: {
                    name: appointment.customer?.name || "",
                    phone: appointment.customer?.phone || "",
                    email: appointment.customer?.email || "",
                    notes: appointment.customer?.notes || "",
                },
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
