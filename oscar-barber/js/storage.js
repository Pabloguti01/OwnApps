/* ============================================================
   Oscar Barber — Persistencia de citas con PocketBase

   API síncrona idéntica a la v1 para no tocar app.js.
   localStorage actúa como caché de escritura anticipada;
   PocketBase es la fuente de verdad.

   Esquema de cita (v2):
   {
     id, createdAt,
     serviceId, serviceName, durationMin, price,
     date,         // 'YYYY-MM-DD'
     startMin,     // minutos desde medianoche (ej. 600 para 10:00)
     endMin,       // startMin + durationMin
     customer: { name, phone, email, notes },
     address, addressNotes,
     status,       // 'confirmed' | 'cancelled'
     _pbId,        // ID del registro en PocketBase (interno, no expuesto al UI)
   }

   Esquema v1 (legacy): usaba `time: "HH:MM"` y no tenía address.
   Se migra automáticamente al leer.

   Colección PocketBase: "appointments"
   Campos: ob_id, created_at, service_id, service_name, duration_min,
           price, date, start_min, end_min, customer_name, customer_phone,
           customer_email, customer_notes, address, address_notes, status
   ============================================================ */

(function () {
    "use strict";

    const STORAGE_KEY = "ob_appointments_v1";
    const PB_COLLECTION = "appointments";

    function getPbBase() {
        return (window.OB_CONFIG && window.OB_CONFIG.pocketbase && window.OB_CONFIG.pocketbase.baseUrl) || "/pb";
    }

    // ── localStorage helpers ──────────────────────────────────

    function readRaw() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function writeAll(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            return true;
        } catch {
            return false;
        }
    }

    function migrate(r) {
        if (r.startMin == null && r.time) {
            const [h, m] = r.time.split(":").map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                r.startMin = h * 60 + m;
                r.endMin   = r.startMin + (r.durationMin || 30);
            }
        }
        if (r.address     == null) r.address     = "";
        if (r.addressNotes == null) r.addressNotes = "";
        if (!r.status) r.status = "confirmed";
        return r;
    }

    function readAll() { return readRaw().map(migrate); }

    function genId() {
        return "OB-" + Date.now().toString(36).toUpperCase().slice(-4) +
            (Math.floor(Math.random() * 9000) + 1000);
    }

    // ── PocketBase REST helpers ───────────────────────────────

    async function pbRequest(method, path, body) {
        const opts = { method, headers: {} };
        if (body) {
            opts.headers["Content-Type"] = "application/json";
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(getPbBase() + path, opts);
        if (method === "DELETE" && res.status === 204) return null;
        const json = await res.json();
        if (!res.ok) throw new Error((json && json.message) || "HTTP " + res.status);
        return json;
    }

    // Appointment → PocketBase fields
    function toPb(a) {
        return {
            ob_id:          a.id,
            created_at:     a.createdAt || new Date().toISOString(),
            service_id:     a.serviceId,
            service_name:   a.serviceName,
            duration_min:   a.durationMin,
            price:          a.price,
            date:           a.date,
            start_min:      a.startMin,
            end_min:        a.endMin,
            customer_name:  a.customer ? a.customer.name  || "" : "",
            customer_phone: a.customer ? a.customer.phone || "" : "",
            customer_email: a.customer ? a.customer.email || "" : "",
            customer_notes: a.customer ? a.customer.notes || "" : "",
            address:        a.address       || "",
            address_notes:  a.addressNotes  || "",
            status:         a.status        || "confirmed",
        };
    }

    // PocketBase record → Appointment
    function fromPb(r) {
        return {
            id:           r.ob_id,
            createdAt:    r.created_at || r.created,
            serviceId:    r.service_id,
            serviceName:  r.service_name,
            durationMin:  r.duration_min,
            price:        r.price,
            date:         r.date,
            startMin:     r.start_min,
            endMin:       r.end_min,
            customer: {
                name:  r.customer_name,
                phone: r.customer_phone,
                email: r.customer_email,
                notes: r.customer_notes,
            },
            address:      r.address,
            addressNotes: r.address_notes,
            status:       r.status,
            _pbId:        r.id,
        };
    }

    // ── Public API ────────────────────────────────────────────

    const OBStorage = {
        STORAGE_KEY,

        /**
         * Callback invocado tras sincronizar con PocketBase.
         * app.js lo asigna para re-renderizar el admin si está abierto.
         */
        onSync: null,

        /**
         * Sincroniza con PocketBase al arrancar.
         * - Si PocketBase no tiene citas pero localStorage sí, las migra.
         * - Si PocketBase ya tiene datos, los usa como fuente de verdad.
         * La llamada es async pero no bloquea; app.js la dispara sin await.
         */
        async init() {
            try {
                const url = "/api/collections/" + PB_COLLECTION + "/records?perPage=200&sort=-date";
                const data = await pbRequest("GET", url);

                if (data.totalItems === 0) {
                    // Primera vez: migrar citas existentes en localStorage → PocketBase
                    const local = readRaw().filter(function (a) { return !a._pbId; });
                    for (var i = 0; i < local.length; i++) {
                        try {
                            var pbRec = await pbRequest("POST",
                                "/api/collections/" + PB_COLLECTION + "/records",
                                toPb(local[i]));
                            local[i]._pbId = pbRec.id;
                        } catch (e) {
                            console.warn("OBStorage: fallo al migrar cita", local[i].id, e);
                        }
                    }
                    if (local.length > 0) writeAll(local);
                } else {
                    // PocketBase tiene datos → sobreescribe caché local
                    writeAll(data.items.map(fromPb));
                }

                if (this.onSync) this.onSync();
            } catch (err) {
                console.warn("OBStorage: PocketBase no disponible, usando caché local.", err);
            }
        },

        getAll() {
            return readAll();
        },

        getById(id) {
            return readAll().find(function (a) { return a.id === id; }) || null;
        },

        getForDate(dateStr) {
            return readAll().filter(function (a) { return a.date === dateStr; });
        },

        save(appointment) {
            const list = readAll();
            const durationMin = appointment.durationMin || 30;

            var startMin = appointment.startMin;
            if (startMin == null && appointment.time) {
                var parts = appointment.time.split(":").map(Number);
                startMin = parts[0] * 60 + parts[1];
            }
            var endMin = appointment.endMin != null
                ? appointment.endMin
                : (startMin != null ? startMin + durationMin : null);

            const record = {
                id:          appointment.id || genId(),
                createdAt:   appointment.createdAt || new Date().toISOString(),
                serviceId:   appointment.serviceId,
                serviceName: appointment.serviceName,
                durationMin: durationMin,
                price:       appointment.price,
                date:        appointment.date,
                startMin:    startMin,
                endMin:      endMin,
                customer: {
                    name:  appointment.customer ? appointment.customer.name  || "" : "",
                    phone: appointment.customer ? appointment.customer.phone || "" : "",
                    email: appointment.customer ? appointment.customer.email || "" : "",
                    notes: appointment.customer ? appointment.customer.notes || "" : "",
                },
                address:      appointment.address      || "",
                addressNotes: appointment.addressNotes || "",
                status:       appointment.status       || "confirmed",
                _pbId:        appointment._pbId        || null,
            };

            const existingIdx = list.findIndex(function (a) { return a.id === record.id; });
            if (existingIdx >= 0) list[existingIdx] = record; else list.push(record);
            writeAll(list);

            // Sync a PocketBase en segundo plano (no bloquea la UI)
            var self = this;
            (async function () {
                try {
                    if (record._pbId) {
                        await pbRequest("PATCH",
                            "/api/collections/" + PB_COLLECTION + "/records/" + record._pbId,
                            toPb(record));
                    } else {
                        var pbRec = await pbRequest("POST",
                            "/api/collections/" + PB_COLLECTION + "/records",
                            toPb(record));
                        // Persiste el _pbId en caché para futuros updates
                        var fresh = readRaw();
                        var idx = fresh.findIndex(function (a) { return a.id === record.id; });
                        if (idx >= 0) { fresh[idx]._pbId = pbRec.id; writeAll(fresh); }
                    }
                } catch (e) {
                    console.error("OBStorage: no se pudo guardar en PocketBase", e);
                }
            })();

            return record;
        },

        remove(id) {
            const appt = this.getById(id);
            const result = writeAll(readAll().filter(function (a) { return a.id !== id; }));

            if (appt && appt._pbId) {
                pbRequest("DELETE",
                    "/api/collections/" + PB_COLLECTION + "/records/" + appt._pbId)
                    .catch(function (e) {
                        console.error("OBStorage: no se pudo eliminar en PocketBase", e);
                    });
            }

            return result;
        },

        clear() {
            return writeAll([]);
        },
    };

    window.OBStorage = OBStorage;
})();
