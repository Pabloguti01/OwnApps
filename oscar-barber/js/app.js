/* ============================================================
   OscarBarber — App principal (UI + backend integrado)

   Esta build mezcla el frontend nuevo (single-page, modal wizard,
   admin shell) con el backend ya existente:
   - Catálogo y horarios desde js/config.js (OB_CONFIG)
   - Persistencia de citas en localStorage vía js/storage.js (OBStorage)
   - Notificación por email vía FormSubmit al confirmar
   - Acceso al admin con contraseña + atajo de long-press en el logo
   ============================================================ */

(function () {
    "use strict";

    const CFG = window.OB_CONFIG;
    const SESSION_KEY = "ob_admin_session_v1";

    // ============================================================
    // CONSTANTES DERIVADAS DE CONFIG
    // ============================================================
    const SLOT_STEP = CFG.booking.slotIntervalMin;
    const TRAVEL_BUFFER = CFG.booking.travelBufferMin;
    const MIN_LEAD_TIME = CFG.booking.minLeadTimeMin;
    const MAX_DAYS_AHEAD = CFG.booking.maxDaysAhead;

    // Localización (vienen del config)
    const MONTHS = CFG.months;
    const MONTHS_SHORT = CFG.monthsShort;
    const WEEKDAYS_FULL = CFG.weekdays;
    const WEEKDAYS_SHORT = CFG.weekdaysShort;

    // ============================================================
    // HELPERS
    // ============================================================
    function pad(n) { return String(n).padStart(2, "0"); }
    function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function isoTime(mins) { return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; }
    function parseYMD(s) {
        const [y, m, d] = s.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setHours(0, 0, 0, 0);
        return dt;
    }
    function parseTimeStr(s) {
        const [h, m] = s.split(":").map(Number);
        return h * 60 + m;
    }
    function todayStart() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    function sameDate(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }
    function formatLongDate(date) {
        const idx = (date.getDay() + 6) % 7; // 0=Lun
        return `${WEEKDAYS_FULL[idx]}, ${date.getDate()} de ${MONTHS[date.getMonth()].toLowerCase()}`;
    }
    function formatShortDate(date) {
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    }
    function escapeHtml(s) {
        return (s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function isoWeekdayMondayFirst(date) {
        return (date.getDay() + 6) % 7;
    }
    function getService(id) { return CFG.services.find(s => s.id === id); }

    /**
     * Turnos abiertos en una fecha (puede ser null si cerrado, o array
     * de { open, close } en minutos desde medianoche).
     */
    function getShiftsForDate(dateStr) {
        if (CFG.closedDates.includes(dateStr)) return null;
        const date = parseYMD(dateStr);
        const dow = date.getDay();
        const shifts = CFG.schedule[dow];
        if (!shifts) return null;
        return shifts.map(s => ({
            openMin: parseTimeStr(s.open),
            closeMin: parseTimeStr(s.close),
        }));
    }

    // ============================================================
    // ESTADO
    // ============================================================
    const state = {
        wizard: {
            open: false,
            step: 0,
            serviceId: null,
            address: "",
            addressNotes: "",
            date: null,
            startMin: null,
            name: "",
            phone: "",
            email: "",
            customerNotes: "",
        },
        calendar: {
            viewYear: new Date().getFullYear(),
            viewMonth: new Date().getMonth(),
        },
        admin: {
            open: false,
            tab: "day",
            viewDate: new Date(),
            selectedId: null,
        },
        _lastBooking: null,
    };

    function getAppointments() {
        // Solo confirmadas (las canceladas se eliminan, ver remove)
        return OBStorage.getAll().filter(a => a.status === "confirmed");
    }

    // ============================================================
    // DISPONIBILIDAD DE SLOTS
    // ============================================================
    function getAvailableSlots(dateStr, serviceDuration) {
        const shifts = getShiftsForDate(dateStr);
        if (!shifts) return [];

        const targetDay = parseYMD(dateStr);
        const today = todayStart();
        if (targetDay < today) return [];

        const dayAppts = getAppointments()
            .filter(a => a.date === dateStr)
            .map(a => ({
                blockStart: a.startMin,
                blockEnd: a.endMin + TRAVEL_BUFFER,  // incluye viaje hacia la SIGUIENTE
            }))
            .sort((a, b) => a.blockStart - b.blockStart);

        const isToday = sameDate(targetDay, new Date());
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        const slots = [];
        for (const shift of shifts) {
            for (let t = shift.openMin; t + serviceDuration <= shift.closeMin; t += SLOT_STEP) {
                const tEnd = t + serviceDuration;
                let available = true;

                for (const block of dayAppts) {
                    // El slot debe terminar con suficiente buffer ANTES de la siguiente cita
                    // y debe empezar DESPUÉS del fin (con buffer ya incluido) de la cita previa.
                    const before = (tEnd + TRAVEL_BUFFER) <= block.blockStart;
                    const after = t >= block.blockEnd;
                    if (!before && !after) { available = false; break; }
                }

                if (isToday && t <= nowMin + MIN_LEAD_TIME) available = false;

                slots.push({ startMin: t, available });
            }
        }
        return slots;
    }

    function countDayAvailableSlots(dateStr, duration) {
        return getAvailableSlots(dateStr, duration).filter(s => s.available).length;
    }

    // ============================================================
    // TOAST
    // ============================================================
    function toast(msg) {
        const el = document.getElementById("toast");
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove("show"), 2400);
    }

    // ============================================================
    // WIZARD DE RESERVA
    // ============================================================
    const STEP_TITLES = [
        "Elige el servicio",
        "¿Dónde te corto?",
        "Elige el día",
        "Elige la hora",
        "Tus datos",
        "¡Cita confirmada!",
    ];

    function openWizard(prefillServiceId) {
        state.wizard = {
            open: true, step: 0,
            serviceId: prefillServiceId || null,
            address: "", addressNotes: "",
            date: null, startMin: null,
            name: "", phone: "", email: "", customerNotes: "",
        };
        state.calendar = {
            viewYear: new Date().getFullYear(),
            viewMonth: new Date().getMonth(),
        };
        renderWizard();
        document.getElementById("booking-modal").classList.add("open");
        document.body.style.overflow = "hidden";
    }
    function closeWizard() {
        state.wizard.open = false;
        document.getElementById("booking-modal").classList.remove("open");
        document.body.style.overflow = "";
    }

    function wizardNext() {
        const s = state.wizard.step;
        if (!validateStep(s)) return;
        if (s === 4) {
            confirmBooking();
        }
        if (s < 5) {
            state.wizard.step++;
            renderWizard();
        } else {
            closeWizard();
        }
    }
    function wizardPrev() {
        if (state.wizard.step > 0 && state.wizard.step < 5) {
            state.wizard.step--;
            renderWizard();
        }
    }

    function validateStep(step) {
        const w = state.wizard;
        document.querySelectorAll(".form-field.error").forEach(el => el.classList.remove("error"));
        if (step === 0 && !w.serviceId) { toast("Elige un servicio para continuar"); return false; }
        if (step === 1) {
            if (!w.address.trim()) {
                document.getElementById("field-address").classList.add("error");
                toast("Indica tu dirección");
                return false;
            }
        }
        if (step === 2 && !w.date) { toast("Elige un día disponible"); return false; }
        if (step === 3 && w.startMin === null) { toast("Elige una hora disponible"); return false; }
        if (step === 4) {
            let ok = true;
            if (!w.name.trim()) { document.getElementById("field-name").classList.add("error"); ok = false; }
            if (!w.phone.trim() || w.phone.replace(/\D/g, "").length < 6) {
                document.getElementById("field-phone").classList.add("error"); ok = false;
            }
            if (w.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w.email.trim())) {
                document.getElementById("field-email").classList.add("error"); ok = false;
            }
            if (!ok) { toast("Revisa los campos marcados"); return false; }
        }
        return true;
    }

    function confirmBooking() {
        const w = state.wizard;
        const svc = getService(w.serviceId);

        // Última verificación: el slot debe seguir libre
        const slots = getAvailableSlots(w.date, svc.durationMin);
        const stillFree = slots.find(s => s.startMin === w.startMin && s.available);
        if (!stillFree) {
            toast("Ese horario acaba de ocuparse. Elige otra hora.");
            state.wizard.startMin = null;
            state.wizard.step = 3;
            renderWizard();
            return;
        }

        const record = OBStorage.save({
            serviceId: svc.id,
            serviceName: svc.name,
            durationMin: svc.durationMin,
            price: svc.price,
            date: w.date,
            startMin: w.startMin,
            endMin: w.startMin + svc.durationMin,
            customer: {
                name: w.name.trim(),
                phone: w.phone.trim(),
                email: w.email.trim(),
                notes: w.customerNotes.trim(),
            },
            address: w.address.trim(),
            addressNotes: w.addressNotes.trim(),
            status: "confirmed",
        });
        state._lastBooking = record;

        // Notificación por email no bloqueante
        sendNotification(record).catch(err => {
            console.warn("Notificación FormSubmit fallida:", err);
        });
    }

    // ============================================================
    // NOTIFICACIÓN POR EMAIL (FormSubmit)
    // ============================================================
    function sendNotification(record) {
        if (!CFG.notifications || !CFG.notifications.enabled) return Promise.resolve();
        const to = CFG.notifications.emailTo;
        if (!to) return Promise.resolve();

        const date = parseYMD(record.date);
        const payload = {
            _subject: `Nueva cita: ${record.date} ${isoTime(record.startMin)} — ${record.customer.name}`,
            _template: "table",
            _captcha: "false",
            // Para que respondiendo al email contestes directo al cliente:
            ...(record.customer.email ? { _replyto: record.customer.email } : {}),

            Servicio: record.serviceName,
            "Duración": `${record.durationMin} min`,
            Precio: `${record.price} €`,
            Fecha: formatLongDate(date),
            Hora: isoTime(record.startMin),
            Cliente: record.customer.name,
            Teléfono: record.customer.phone,
            Email: record.customer.email || "(no proporcionado)",
            Dirección: record.address || "(no proporcionada)",
            "Notas para llegar": record.addressNotes || "(sin notas)",
            "Notas del cliente": record.customer.notes || "(sin notas)",
            "ID cita": record.id,
            Creada: record.createdAt,
        };

        return fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(payload),
        }).then(r => {
            if (!r.ok) throw new Error("FormSubmit respondió " + r.status);
            return r.json();
        });
    }

    // ============================================================
    // RENDER WIZARD
    // ============================================================
    function renderWizard() {
        const w = state.wizard;
        const step = w.step;
        const body = document.getElementById("wizard-body");
        const stepTitle = document.getElementById("wizard-title");
        const stepIndicator = document.getElementById("step-indicator");
        const summary = document.getElementById("wizard-summary");
        const footer = document.getElementById("wizard-footer");
        const btnPrev = document.getElementById("btn-prev");
        const btnNext = document.getElementById("btn-next");

        if (step === 5) {
            stepTitle.innerHTML = STEP_TITLES[5];
        } else {
            stepTitle.innerHTML = `<span class="step-pill">PASO ${step + 1}/5</span>${STEP_TITLES[step]}`;
        }

        let bars = "";
        for (let i = 0; i < 5; i++) {
            let cls = "bar";
            if (i < step) cls += " done";
            if (i === step) cls += " active";
            bars += `<div class="${cls}"></div>`;
        }
        stepIndicator.innerHTML = step < 5 ? bars : "";

        if (step === 0) body.innerHTML = renderStepService();
        else if (step === 1) body.innerHTML = renderStepAddress();
        else if (step === 2) body.innerHTML = renderStepDate();
        else if (step === 3) body.innerHTML = renderStepTime();
        else if (step === 4) body.innerHTML = renderStepInfo();
        else if (step === 5) body.innerHTML = renderStepConfirm();

        if (step === 5) {
            footer.style.display = "flex";
            btnPrev.style.display = "none";
            btnNext.textContent = "Listo, cerrar";
            summary.innerHTML = `<span>Referencia <strong>${state._lastBooking?.id || ""}</strong></span>`;
        } else {
            footer.style.display = "flex";
            btnPrev.style.display = step === 0 ? "none" : "inline-flex";
            btnNext.innerHTML = step === 4 ? 'Confirmar cita <span class="arrow">→</span>' : 'Continuar <span class="arrow">→</span>';
            summary.innerHTML = renderWizardSummary();
        }

        attachStepListeners(step);
    }

    function renderWizardSummary() {
        const w = state.wizard;
        const svc = w.serviceId ? getService(w.serviceId) : null;
        const parts = [];
        if (svc) parts.push(`<strong>${svc.name}</strong>`);
        if (w.date) {
            const d = parseYMD(w.date);
            parts.push(`${pad(d.getDate())}.${pad(d.getMonth() + 1)}`);
        }
        if (w.startMin !== null) parts.push(isoTime(w.startMin));
        if (svc) parts.push(`${svc.price}€`);
        return parts.length ? parts.join(" · ") : `Cita a domicilio · ${CFG.business.city || ""}`;
    }

    function svgScissors() {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>`;
    }
    function svgRazor() {
        return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 18 4M14 4h6v6M14 14l6 6"/></svg>`;
    }

    function renderStepService() {
        const w = state.wizard;
        return `
            <h3 class="step-title">${STEP_TITLES[0]}</h3>
            <p class="step-sub">Servicios completamente a domicilio. Oscar acude con todo el material.</p>
            <div class="service-pick">
                ${CFG.services.map(s => `
                    <button class="service-option ${w.serviceId === s.id ? "selected" : ""}" data-svc="${s.id}">
                        <div class="ico">${s.id === "corte" ? svgScissors() : svgRazor()}</div>
                        <h4>${escapeHtml(s.name)}</h4>
                        <div class="desc">${escapeHtml(s.description || "")}</div>
                        <div class="footer-row">
                            <div class="price">${s.price}€</div>
                            <div class="dur">${s.durationMin} min</div>
                        </div>
                    </button>
                `).join("")}
            </div>
        `;
    }

    function renderStepAddress() {
        const w = state.wizard;
        const city = CFG.business.city || "";
        return `
            <h3 class="step-title">${STEP_TITLES[1]}</h3>
            <p class="step-sub">Servicio a domicilio${city ? " en " + city + " y alrededores" : ""}. Necesitamos saber dónde acudir.</p>
            <div class="form-row">
                <div class="form-field" id="field-address">
                    <label>Dirección completa</label>
                    <input type="text" id="inp-address" placeholder="Calle, número, piso, puerta" value="${escapeHtml(w.address)}" autocomplete="street-address" />
                    <div class="hint">Ej: Calle Sierpes 24, 3º B${city ? ", " + city : ""}</div>
                </div>
                <div class="form-field">
                    <label>Notas para llegar (opcional)</label>
                    <textarea id="inp-address-notes" placeholder="Portero automático, código del portal, referencias...">${escapeHtml(w.addressNotes)}</textarea>
                </div>
            </div>
        `;
    }

    function renderStepDate() {
        const w = state.wizard;
        const svc = getService(w.serviceId);
        const { viewYear, viewMonth } = state.calendar;
        const monthName = `${MONTHS[viewMonth]} ${viewYear}`;

        const firstOfMonth = new Date(viewYear, viewMonth, 1);
        const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
        const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
        const daysInMonth = lastOfMonth.getDate();

        const todayMid = todayStart();
        const maxDate = new Date(todayMid);
        maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD);

        const prevDisabled = (viewYear < todayMid.getFullYear()) ||
            (viewYear === todayMid.getFullYear() && viewMonth <= todayMid.getMonth());
        const nextDisabled = (viewYear > maxDate.getFullYear()) ||
            (viewYear === maxDate.getFullYear() && viewMonth >= maxDate.getMonth());

        let cells = "";
        for (let i = 0; i < firstWeekday; i++) {
            const d = new Date(viewYear, viewMonth, i - firstWeekday + 1);
            cells += `<button class="cal-day other-month" disabled>${d.getDate()}</button>`;
        }
        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const d = new Date(viewYear, viewMonth, dayNum);
            const isPast = d < todayMid;
            const isBeyond = d > maxDate;
            const ymdStr = ymd(d);
            const isToday = sameDate(d, new Date());
            const isSelected = w.date === ymdStr;

            const shifts = getShiftsForDate(ymdStr);
            const isClosed = !shifts;

            let availCount = 0;
            let disabled = isPast || isBeyond || isClosed;
            if (!disabled && svc) availCount = countDayAvailableSlots(ymdStr, svc.durationMin);
            if (!disabled && svc && availCount === 0) disabled = true;

            const cls = [
                "cal-day",
                isToday ? "today" : "",
                isSelected ? "selected" : "",
            ].filter(Boolean).join(" ");

            cells += `
                <button class="${cls}" data-day="${ymdStr}" ${disabled ? "disabled" : ""}>
                    ${dayNum}
                    ${!disabled && availCount > 0 ? `<span class="slot-count">${availCount} libres</span>` : ""}
                </button>
            `;
        }
        const totalCells = firstWeekday + daysInMonth;
        const trailing = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < trailing; i++) {
            cells += `<button class="cal-day other-month" disabled>${i + 1}</button>`;
        }

        const shiftLabel = (CFG.schedule[1] || []).map(s => `${s.open}–${s.close}`).join(" / ");

        return `
            <h3 class="step-title">${STEP_TITLES[2]}</h3>
            <p class="step-sub">Solo se muestran días con disponibilidad real (lun–vie · ${shiftLabel}).</p>
            <div class="calendar">
                <div class="cal-head">
                    <div class="cal-title">${monthName}</div>
                    <div class="cal-nav">
                        <button id="cal-prev" ${prevDisabled ? "disabled" : ""} aria-label="Mes anterior">‹</button>
                        <button id="cal-next" ${nextDisabled ? "disabled" : ""} aria-label="Mes siguiente">›</button>
                    </div>
                </div>
                <div class="cal-weekdays">
                    ${CFG.weekdaysShort.map(d => `<div>${d}</div>`).join("")}
                </div>
                <div class="cal-days">${cells}</div>
            </div>
        `;
    }

    function renderStepTime() {
        const w = state.wizard;
        const svc = getService(w.serviceId);
        const slots = getAvailableSlots(w.date, svc.durationMin);
        const d = parseYMD(w.date);
        const longDate = formatLongDate(d);

        return `
            <h3 class="step-title">${STEP_TITLES[3]}</h3>
            <p class="step-sub">${longDate} · Duración del servicio: <strong style="color:var(--accent)">${svc.durationMin} min</strong></p>
            <div class="slots-info">
                <span class="item"><span class="swatch avail"></span>Disponible</span>
                <span class="item"><span class="swatch taken"></span>Ocupado</span>
                <span class="item"><span class="swatch sel"></span>Seleccionado</span>
                <span class="item" style="margin-left:auto">+${TRAVEL_BUFFER} min de traslado entre citas</span>
            </div>
            <div class="slots-grid">
                ${slots.length === 0
                    ? `<div style="grid-column:1/-1; text-align:center; color:var(--muted); padding:30px 0;">No hay horarios libres este día.</div>`
                    : slots.map(slot => `
                        <button class="slot ${w.startMin === slot.startMin ? "selected" : ""}"
                                data-time="${slot.startMin}"
                                ${!slot.available ? "disabled" : ""}>
                            ${isoTime(slot.startMin)}
                        </button>
                    `).join("")}
            </div>
        `;
    }

    function renderStepInfo() {
        const w = state.wizard;
        const svc = getService(w.serviceId);
        const d = parseYMD(w.date);
        return `
            <h3 class="step-title">${STEP_TITLES[4]}</h3>
            <p class="step-sub">Confirmamos por WhatsApp el día previo. Pago en efectivo al terminar.</p>

            <div class="form-row two">
                <div class="form-field" id="field-name">
                    <label>Nombre y apellido</label>
                    <input type="text" id="inp-name" placeholder="Tu nombre" value="${escapeHtml(w.name)}" autocomplete="name" />
                </div>
                <div class="form-field" id="field-phone">
                    <label>Teléfono</label>
                    <input type="tel" id="inp-phone" placeholder="600 12 34 56" value="${escapeHtml(w.phone)}" autocomplete="tel" />
                </div>
            </div>
            <div class="form-row" style="margin-top:16px">
                <div class="form-field" id="field-email">
                    <label>Email (opcional)</label>
                    <input type="email" id="inp-email" placeholder="tu@email.com" value="${escapeHtml(w.email)}" autocomplete="email" />
                </div>
                <div class="form-field">
                    <label>Notas para Oscar (opcional)</label>
                    <textarea id="inp-customer-notes" placeholder="Estilo deseado, alergias, peticiones especiales...">${escapeHtml(w.customerNotes)}</textarea>
                </div>
            </div>

            <div style="margin-top:28px; padding:18px 22px; background:var(--accent-soft); border:1px solid var(--accent-line); border-radius:var(--r-md); display:flex; gap:18px; flex-wrap:wrap; align-items:center;">
                <div style="flex:1; min-width:200px;">
                    <div class="mono" style="font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent); margin-bottom:6px;">Resumen</div>
                    <div style="font-weight:600">${escapeHtml(svc.name)} · ${formatLongDate(d)} · ${isoTime(w.startMin)}</div>
                    <div style="font-size:13px; color:var(--text-2); margin-top:4px;">${escapeHtml(w.address)}</div>
                </div>
                <div style="font-family:var(--font-display); font-size:42px; color:var(--accent); line-height:1;">${svc.price}€</div>
            </div>
        `;
    }

    function renderStepConfirm() {
        const a = state._lastBooking;
        if (!a) return "";
        const d = parseYMD(a.date);
        return `
            <div class="confirm">
                <div class="check">✓</div>
                <h3>¡Cita confirmada!</h3>
                <p>Hemos guardado tu reserva. Oscar te contactará por WhatsApp para confirmar.</p>
                <div class="summary-card">
                    <div class="row"><span class="lbl">Servicio</span><span class="val">${escapeHtml(a.serviceName)}</span></div>
                    <div class="row"><span class="lbl">Fecha</span><span class="val">${formatLongDate(d)}</span></div>
                    <div class="row"><span class="lbl">Hora</span><span class="val accent">${isoTime(a.startMin)} h</span></div>
                    <div class="row"><span class="lbl">Dirección</span><span class="val" style="max-width:60%; font-size:13px;">${escapeHtml(a.address)}</span></div>
                    <div class="row"><span class="lbl">Total</span><span class="val accent">${a.price}€</span></div>
                </div>
                <div class="ref-code">REFERENCIA · <strong>${a.id}</strong></div>
            </div>
        `;
    }

    function attachStepListeners(step) {
        if (step === 0) {
            document.querySelectorAll(".service-option").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (state.wizard.serviceId !== btn.dataset.svc) {
                        state.wizard.startMin = null;
                        state.wizard.date = null;
                    }
                    state.wizard.serviceId = btn.dataset.svc;
                    renderWizard();
                });
            });
        }
        if (step === 1) {
            document.getElementById("inp-address").addEventListener("input", e => state.wizard.address = e.target.value);
            document.getElementById("inp-address-notes").addEventListener("input", e => state.wizard.addressNotes = e.target.value);
        }
        if (step === 2) {
            document.getElementById("cal-prev").addEventListener("click", () => {
                state.calendar.viewMonth--;
                if (state.calendar.viewMonth < 0) { state.calendar.viewMonth = 11; state.calendar.viewYear--; }
                renderWizard();
            });
            document.getElementById("cal-next").addEventListener("click", () => {
                state.calendar.viewMonth++;
                if (state.calendar.viewMonth > 11) { state.calendar.viewMonth = 0; state.calendar.viewYear++; }
                renderWizard();
            });
            document.querySelectorAll(".cal-day[data-day]").forEach(b => {
                b.addEventListener("click", () => {
                    if (b.disabled) return;
                    state.wizard.date = b.dataset.day;
                    state.wizard.startMin = null;
                    renderWizard();
                });
            });
        }
        if (step === 3) {
            document.querySelectorAll(".slot[data-time]").forEach(b => {
                b.addEventListener("click", () => {
                    if (b.disabled) return;
                    state.wizard.startMin = parseInt(b.dataset.time, 10);
                    renderWizard();
                });
            });
        }
        if (step === 4) {
            document.getElementById("inp-name").addEventListener("input", e => state.wizard.name = e.target.value);
            document.getElementById("inp-phone").addEventListener("input", e => state.wizard.phone = e.target.value);
            document.getElementById("inp-email").addEventListener("input", e => state.wizard.email = e.target.value);
            document.getElementById("inp-customer-notes").addEventListener("input", e => state.wizard.customerNotes = e.target.value);
        }
    }

    // ============================================================
    // ADMIN (con login)
    // ============================================================

    /**
     * Token de sesión derivado de la contraseña actual.
     * Así, cuando cambias la contraseña en config.js (o cuando alguien
     * tenía guardada una sesión del admin antiguo con otro esquema),
     * la sesión se invalida automáticamente y vuelve a pedir contraseña.
     */
    function sessionToken() {
        const s = (CFG.admin && CFG.admin.password) || "";
        let hash = 0;
        for (let i = 0; i < s.length; i++) {
            hash = ((hash << 5) - hash) + s.charCodeAt(i);
            hash |= 0;
        }
        return "v2:" + Math.abs(hash).toString(36);
    }

    function isAdminAuthenticated() {
        return sessionStorage.getItem(SESSION_KEY) === sessionToken();
    }

    function openAdmin() {
        if (!isAdminAuthenticated()) {
            openAdminLogin();
            return;
        }
        state.admin.open = true;
        state.admin.viewDate = new Date();
        document.getElementById("admin-shell").classList.add("open");
        document.body.style.overflow = "hidden";
        renderAdmin();
    }
    function closeAdmin() {
        state.admin.open = false;
        document.getElementById("admin-shell").classList.remove("open");
        document.body.style.overflow = "";
        closeDetail();
    }

    function openAdminLogin() {
        document.getElementById("admin-login-modal").classList.add("open");
        document.getElementById("admin-login-hint").textContent = "La sesión se cierra al cerrar la pestaña.";
        document.getElementById("admin-login-hint").style.color = "";
        document.getElementById("field-admin-pass").classList.remove("error");
        const input = document.getElementById("inp-admin-pass");
        input.value = "";
        setTimeout(() => input.focus(), 50);
    }
    function closeAdminLogin() {
        document.getElementById("admin-login-modal").classList.remove("open");
    }
    function tryAdminLogin(pass) {
        const expected = (CFG.admin && CFG.admin.password) || "";
        if (!expected) {
            const hint = document.getElementById("admin-login-hint");
            hint.textContent = "No hay contraseña configurada en config.js.";
            hint.style.color = "var(--red)";
            return false;
        }
        if (pass === expected) {
            sessionStorage.setItem(SESSION_KEY, sessionToken());
            closeAdminLogin();
            openAdmin();
            return true;
        }
        const hint = document.getElementById("admin-login-hint");
        hint.textContent = "Contraseña incorrecta.";
        hint.style.color = "var(--red)";
        document.getElementById("field-admin-pass").classList.add("error");
        const input = document.getElementById("inp-admin-pass");
        input.select();
        return false;
    }

    function adminLogout() {
        sessionStorage.removeItem(SESSION_KEY);
        closeAdmin();
        toast("Sesión cerrada");
    }

    function renderAdmin() {
        const tab = state.admin.tab;
        document.querySelectorAll(".admin-tab").forEach(t => {
            t.classList.toggle("active", t.dataset.tab === tab);
        });
        renderAdminKpis();
        const content = document.getElementById("admin-content-area");
        if (tab === "day") content.innerHTML = renderAdminDay();
        else content.innerHTML = renderAdminWeek();
        attachAdminListeners(tab);
    }

    function renderAdminKpis() {
        const all = getAppointments();
        const todayStr = ymd(new Date());
        const todayAppts = all.filter(a => a.date === todayStr);

        const monday = new Date();
        const dayOfWeek = (monday.getDay() + 6) % 7;
        monday.setDate(monday.getDate() - dayOfWeek);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const weekAppts = all.filter(a => {
            const d = parseYMD(a.date);
            return d >= monday && d <= sunday;
        });

        const weekRevenue = weekAppts.reduce((s, a) => s + (a.price || 0), 0);
        const todayRevenue = todayAppts.reduce((s, a) => s + (a.price || 0), 0);

        document.getElementById("admin-kpis").innerHTML = `
            <div class="kpi accent">
                <div class="lbl">Citas hoy</div>
                <div class="val">${todayAppts.length}</div>
                <div class="delta">${todayRevenue}€ facturados</div>
            </div>
            <div class="kpi">
                <div class="lbl">Citas esta semana</div>
                <div class="val">${weekAppts.length}</div>
                <div class="delta">${weekRevenue}€ totales</div>
            </div>
            <div class="kpi">
                <div class="lbl">Próxima cita</div>
                <div class="val" style="font-size:32px;">${getNextApptLabel()}</div>
            </div>
            <div class="kpi">
                <div class="lbl">Total reservas</div>
                <div class="val">${all.length}</div>
                <div class="delta" style="color:var(--muted)">Histórico</div>
            </div>
        `;
    }

    function getNextApptLabel() {
        const now = new Date();
        const upcoming = getAppointments()
            .map(a => ({ ...a, dt: new Date(parseYMD(a.date).getTime() + a.startMin * 60000) }))
            .filter(a => a.dt > now)
            .sort((a, b) => a.dt - b.dt);
        if (!upcoming.length) return "—";
        const n = upcoming[0];
        const d = parseYMD(n.date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (sameDate(d, today)) return `Hoy ${isoTime(n.startMin)}`;
        return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} · ${isoTime(n.startMin)}`;
    }

    function renderAdminDay() {
        const date = state.admin.viewDate;
        const dateStr = ymd(date);
        const appts = getAppointments()
            .filter(a => a.date === dateStr)
            .sort((a, b) => a.startMin - b.startMin);

        const isWeekend = !getShiftsForDate(dateStr);

        // Timeline: usa el horario real del día (o por defecto el del lunes)
        const shifts = getShiftsForDate(dateStr) || (CFG.schedule[1] || []);
        let rows = "";
        if (shifts.length > 0 && !isWeekend) {
            // Encontrar el rango total del día (primera apertura, último cierre)
            const dayStart = Math.min(...shifts.map(s => parseTimeStr(s.open)));
            const dayEnd = Math.max(...shifts.map(s => parseTimeStr(s.close)));
            const startHour = Math.floor(dayStart / 60);
            const endHour = Math.ceil(dayEnd / 60);

            for (let h = startHour; h < endHour; h++) {
                const hourStart = h * 60;
                const halfStart = h * 60 + 30;
                const apptInHour = appts.find(a => a.startMin >= hourStart && a.startMin < hourStart + 30);
                const apptInHalf = appts.find(a => a.startMin >= halfStart && a.startMin < halfStart + 30);
                rows += `
                    <div class="timeline-row ${apptInHour ? "" : "empty"}">
                        <div class="hour">${pad(h)}:00</div>
                        <div class="cell">${apptInHour ? renderApptCard(apptInHour) : ""}</div>
                    </div>
                    <div class="timeline-row half ${apptInHalf ? "" : "empty"}">
                        <div class="hour">${pad(h)}:30</div>
                        <div class="cell">${apptInHalf ? renderApptCard(apptInHalf) : ""}</div>
                    </div>
                `;
            }
        }
        const odd = appts.filter(a => a.startMin % 30 !== 0);

        return `
            <div class="admin-day-header">
                <div>
                    <h2>${formatLongDate(date)}</h2>
                    <div class="date-sub">${formatShortDate(date)} · ${appts.length} cita${appts.length === 1 ? "" : "s"} · ${appts.reduce((s, a) => s + (a.price || 0), 0)}€</div>
                </div>
                <div class="day-nav">
                    <button id="day-prev" aria-label="Día anterior">‹</button>
                    <button class="today-btn" id="day-today">Hoy</button>
                    <button id="day-next" aria-label="Día siguiente">›</button>
                </div>
            </div>

            ${isWeekend ? `
                <div class="empty-state">
                    <div class="ico">☕</div>
                    <div class="txt">Día de descanso · Sólo se trabaja Lunes a Viernes</div>
                </div>
            ` : appts.length === 0 ? `
                <div class="empty-state">
                    <div class="ico">○</div>
                    <div class="txt">Sin citas reservadas para este día</div>
                </div>
            ` : `
                <div class="timeline">${rows}</div>
                ${odd.length ? `
                    <div style="margin-top:16px;">
                        <div class="mono" style="font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted); margin-bottom:10px;">Otras horas</div>
                        ${odd.map(renderApptCardStandalone).join("")}
                    </div>
                ` : ""}
            `}
        `;
    }

    function renderApptCard(a) {
        return `
            <div class="appt-card" data-id="${a.id}">
                <div>
                    <div class="time">${isoTime(a.startMin)} – ${isoTime(a.endMin)}</div>
                    <div class="name">${escapeHtml(a.customer.name)}</div>
                    <div class="meta">
                        <span>${escapeHtml(a.serviceName)}</span>
                        <span class="sep">·</span>
                        <span>${escapeHtml(a.customer.phone)}</span>
                        <span class="sep">·</span>
                        <span style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(a.address)}</span>
                    </div>
                </div>
                <div></div>
                <div class="price-pill">${a.price}€</div>
            </div>
        `;
    }
    function renderApptCardStandalone(a) {
        return `<div style="margin-bottom:8px;">${renderApptCard(a)}</div>`;
    }

    function renderAdminWeek() {
        const ref = new Date(state.admin.viewDate);
        const dayOfWeek = (ref.getDay() + 6) % 7;
        const monday = new Date(ref);
        monday.setDate(ref.getDate() - dayOfWeek);
        monday.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(monday); d.setDate(monday.getDate() + i);
            days.push(d);
        }

        const today = new Date();
        const weekTitle = `${pad(days[0].getDate())} ${MONTHS_SHORT[days[0].getMonth()]} – ${pad(days[4].getDate())} ${MONTHS_SHORT[days[4].getMonth()]} ${days[4].getFullYear()}`;

        // Bounds horarios (usa el horario del lunes como referencia)
        const refShifts = CFG.schedule[1] || [];
        const wdStart = refShifts.length ? Math.min(...refShifts.map(s => parseTimeStr(s.open))) : 600;
        const wdEnd = refShifts.length ? Math.max(...refShifts.map(s => parseTimeStr(s.close))) : 840;

        let header = `<div class="week-head"></div>`;
        for (const d of days) {
            const isToday = sameDate(d, today);
            header += `
                <div class="week-head ${isToday ? "today" : ""}">
                    ${WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}
                    <span class="day-num">${pad(d.getDate())}</span>
                </div>
            `;
        }

        const appointments = getAppointments();
        let cells = "";
        for (let m = wdStart; m < wdEnd; m += 30) {
            cells += `<div class="hour-cell">${isoTime(m)}</div>`;
            for (const d of days) {
                const dateStr = ymd(d);
                const appt = appointments.find(a =>
                    a.date === dateStr && a.startMin >= m && a.startMin < m + 30
                );
                if (appt) {
                    cells += `
                        <div class="slot-cell">
                            <div class="week-appt" data-id="${appt.id}">
                                <strong>${isoTime(appt.startMin)}</strong>
                                <span class="nm">${escapeHtml((appt.customer.name || "").split(" ")[0])}</span>
                            </div>
                        </div>
                    `;
                } else {
                    cells += `<div class="slot-cell"></div>`;
                }
            }
        }

        return `
            <div class="admin-day-header">
                <div>
                    <h2>Semana</h2>
                    <div class="date-sub">${weekTitle}</div>
                </div>
                <div class="day-nav">
                    <button id="week-prev" aria-label="Semana anterior">‹</button>
                    <button class="today-btn" id="week-today">Esta semana</button>
                    <button id="week-next" aria-label="Semana siguiente">›</button>
                </div>
            </div>
            <div class="week-grid">
                ${header}
                ${cells}
            </div>
        `;
    }

    function attachAdminListeners(tab) {
        document.querySelectorAll(".appt-card[data-id], .week-appt[data-id]").forEach(el => {
            el.addEventListener("click", () => openDetail(el.dataset.id));
        });
        if (tab === "day") {
            document.getElementById("day-prev")?.addEventListener("click", () => {
                state.admin.viewDate.setDate(state.admin.viewDate.getDate() - 1);
                renderAdmin();
            });
            document.getElementById("day-next")?.addEventListener("click", () => {
                state.admin.viewDate.setDate(state.admin.viewDate.getDate() + 1);
                renderAdmin();
            });
            document.getElementById("day-today")?.addEventListener("click", () => {
                state.admin.viewDate = new Date();
                renderAdmin();
            });
        } else {
            document.getElementById("week-prev")?.addEventListener("click", () => {
                state.admin.viewDate.setDate(state.admin.viewDate.getDate() - 7);
                renderAdmin();
            });
            document.getElementById("week-next")?.addEventListener("click", () => {
                state.admin.viewDate.setDate(state.admin.viewDate.getDate() + 7);
                renderAdmin();
            });
            document.getElementById("week-today")?.addEventListener("click", () => {
                state.admin.viewDate = new Date();
                renderAdmin();
            });
        }
    }

    function openDetail(id) {
        const a = OBStorage.getById(id);
        if (!a) return;
        state.admin.selectedId = id;
        const d = parseYMD(a.date);
        const phoneDigits = (a.customer.phone || "").replace(/\D/g, "");
        const phoneTel = (a.customer.phone || "").replace(/\s/g, "");
        document.getElementById("detail-body").innerHTML = `
            <div class="detail-row">
                <div class="lbl">Fecha y hora</div>
                <div class="val big">${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} · ${isoTime(a.startMin)}</div>
                <div class="val" style="font-size:13px; color:var(--muted); margin-top:4px;">${formatLongDate(d)} · Termina a las ${isoTime(a.endMin)}</div>
            </div>
            <div class="detail-row">
                <div class="lbl">Cliente</div>
                <div class="val">${escapeHtml(a.customer.name)}</div>
            </div>
            <div class="detail-row">
                <div class="lbl">Teléfono</div>
                <div class="val"><a href="tel:${escapeHtml(phoneTel)}">${escapeHtml(a.customer.phone)}</a></div>
            </div>
            ${a.customer.email ? `
                <div class="detail-row">
                    <div class="lbl">Email</div>
                    <div class="val"><a href="mailto:${escapeHtml(a.customer.email)}">${escapeHtml(a.customer.email)}</a></div>
                </div>
            ` : ""}
            <div class="detail-row">
                <div class="lbl">Dirección a domicilio</div>
                <div class="val" style="font-size:14px; line-height:1.5;">${escapeHtml(a.address || "(sin dirección)")}</div>
                ${a.addressNotes ? `<div class="val" style="font-size:13px; color:var(--muted); margin-top:6px;">Notas: ${escapeHtml(a.addressNotes)}</div>` : ""}
            </div>
            <div class="detail-row">
                <div class="lbl">Servicio</div>
                <div class="val">${escapeHtml(a.serviceName)} · <span style="color:var(--accent); font-weight:700;">${a.price}€</span> · ${a.durationMin} min</div>
            </div>
            ${a.customer.notes ? `
                <div class="detail-row">
                    <div class="lbl">Notas del cliente</div>
                    <div class="val" style="font-size:14px; line-height:1.5; color:var(--text-2);">${escapeHtml(a.customer.notes)}</div>
                </div>
            ` : ""}
            <div class="detail-row">
                <div class="lbl">Referencia</div>
                <div class="val mono" style="font-size:13px; letter-spacing:0.08em;">${a.id}</div>
            </div>
            <div style="display:flex; gap:8px; margin-top:24px;">
                <a class="btn btn-primary btn-sm" style="flex:1" href="tel:${escapeHtml(phoneTel)}">Llamar</a>
                ${phoneDigits ? `<a class="btn btn-dark btn-sm" style="flex:1" href="https://wa.me/34${escapeHtml(phoneDigits)}" target="_blank">WhatsApp</a>` : ""}
            </div>
            <button class="btn btn-ghost btn-sm" style="margin-top:10px; width:100%" id="cancel-appt">Cancelar cita</button>
        `;
        document.getElementById("detail-drawer").classList.add("open");
        document.getElementById("cancel-appt").addEventListener("click", () => {
            if (confirm(`¿Cancelar la cita de ${a.customer.name} (${isoTime(a.startMin)})?`)) {
                OBStorage.remove(a.id);
                toast("Cita cancelada");
                closeDetail();
                renderAdmin();
            }
        });
    }
    function closeDetail() {
        document.getElementById("detail-drawer").classList.remove("open");
        state.admin.selectedId = null;
    }

    // ============================================================
    // EXPORT CSV
    // ============================================================
    function exportCSV() {
        const all = OBStorage.getAll()
            .slice()
            .sort((a, b) => (a.date + isoTime(a.startMin || 0)).localeCompare(b.date + isoTime(b.startMin || 0)));
        const headers = [
            "ID", "Fecha", "Hora", "Servicio", "Duración (min)", "Precio (€)",
            "Cliente", "Teléfono", "Email", "Dirección", "Notas dirección", "Notas cliente",
            "Estado", "Creada"
        ];
        const rows = all.map(a => [
            a.id, a.date, isoTime(a.startMin || 0),
            a.serviceName, a.durationMin, a.price,
            a.customer.name, a.customer.phone, a.customer.email || "",
            a.address || "", a.addressNotes || "", a.customer.notes || "",
            a.status || "confirmed", a.createdAt
        ]);
        const escape = v => {
            const s = String(v ?? "");
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\r\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `oscarbarber-citas-${ymd(new Date())}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast("CSV descargado");
    }

    // ============================================================
    // BINDINGS DESDE OB_CONFIG (data-bind)
    // ============================================================
    function applyBindings() {
        const B = CFG.business;
        const phone = B.phone || "";
        const phoneTel = phone.replace(/\s/g, "");
        document.querySelectorAll('[data-bind="phone"]').forEach(el => el.textContent = phone);
        document.querySelectorAll('[data-bind="phone-tel"]').forEach(el => el.setAttribute("href", "tel:" + phoneTel));
        document.querySelectorAll('[data-bind="email"]').forEach(el => el.textContent = B.email || "");
        document.querySelectorAll('[data-bind="email-mailto"]').forEach(el => el.setAttribute("href", "mailto:" + (B.email || "")));
        document.querySelectorAll('[data-bind="city"]').forEach(el => el.textContent = B.city || "");
        const instagram = B.instagram || "";
        document.querySelectorAll('[data-bind="instagram"]').forEach(el => {
            el.textContent = instagram;
            if (instagram) {
                el.setAttribute("href", "https://instagram.com/" + instagram.replace(/^@/, ""));
            }
        });
        document.querySelectorAll('[data-bind="year"]').forEach(el => el.textContent = new Date().getFullYear());
        const monShifts = CFG.schedule[1] || [];
        if (monShifts.length) {
            const hours = monShifts.map(s => `${s.open}h–${s.close}h`).join(" / ");
            document.querySelectorAll('[data-bind="hours"]').forEach(el => el.textContent = hours);
        }
    }

    // ============================================================
    // ATAJO OCULTO: LONG-PRESS EN EL LOGO → ADMIN
    // ============================================================
    function initLogoSecret() {
        const brand = document.querySelector(".brand");
        if (!brand) return;
        let timer = null;
        const HOLD_MS = 1500;
        const start = () => {
            cancel();
            timer = setTimeout(() => {
                openAdmin();
                timer = null;
            }, HOLD_MS);
        };
        const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
        brand.addEventListener("pointerdown", start);
        brand.addEventListener("pointerup", cancel);
        brand.addEventListener("pointerleave", cancel);
        brand.addEventListener("pointercancel", cancel);
        brand.addEventListener("contextmenu", (ev) => { if (timer) ev.preventDefault(); });
    }

    // ============================================================
    // RELOJ ADMIN (live)
    // ============================================================
    function initAdminClock() {
        function tick() {
            const el = document.getElementById("admin-clock");
            if (!el) return;
            const d = new Date();
            el.textContent = `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        tick();
        setInterval(tick, 30000);
    }

    // ============================================================
    // SMOOTH SCROLL PARA ANCLAS
    // ============================================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener("click", (e) => {
                const href = a.getAttribute("href");
                if (href === "#" || href.length < 2) return;
                const target = document.querySelector(href);
                if (!target) return;
                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.scrollY - 70;
                window.scrollTo({ top, behavior: "smooth" });
            });
        });
    }

    // ============================================================
    // MOBILE DRAWER (hamburguesa + barra lateral)
    // ============================================================
    function initMobileDrawer() {
        const burger = document.getElementById("nav-burger");
        const drawer = document.getElementById("mobile-drawer");
        const backdrop = document.getElementById("mobile-drawer-backdrop");
        const closeBtn = document.getElementById("drawer-close");
        if (!burger || !drawer || !backdrop) return;

        function openDrawer() {
            drawer.classList.add("open");
            backdrop.classList.add("open");
            burger.classList.add("open");
            burger.setAttribute("aria-expanded", "true");
            drawer.setAttribute("aria-hidden", "false");
            document.body.classList.add("drawer-open");
        }
        function closeDrawer() {
            drawer.classList.remove("open");
            backdrop.classList.remove("open");
            burger.classList.remove("open");
            burger.setAttribute("aria-expanded", "false");
            drawer.setAttribute("aria-hidden", "true");
            document.body.classList.remove("drawer-open");
        }
        function toggleDrawer() {
            if (drawer.classList.contains("open")) closeDrawer();
            else openDrawer();
        }

        burger.addEventListener("click", toggleDrawer);
        closeBtn?.addEventListener("click", closeDrawer);
        backdrop.addEventListener("click", closeDrawer);

        // Cualquier enlace o acción dentro del drawer marcado con
        // data-drawer-close cierra el drawer al activarse.
        drawer.querySelectorAll("[data-drawer-close]").forEach(el => {
            el.addEventListener("click", () => closeDrawer());
        });

        // Si la ventana se ensancha a desktop, asegurarse de cerrar el drawer.
        const mq = window.matchMedia("(min-width: 961px)");
        mq.addEventListener("change", e => { if (e.matches) closeDrawer(); });

        // Exponer para que ESC pueda cerrarlo desde el listener global.
        window.__obCloseDrawer = closeDrawer;
        window.__obIsDrawerOpen = () => drawer.classList.contains("open");
    }

    // ============================================================
    // INIT
    // ============================================================
    document.addEventListener("DOMContentLoaded", () => {
        applyBindings();
        initSmoothScroll();
        initMobileDrawer();
        initLogoSecret();
        initAdminClock();

        // CTA reservar
        document.querySelectorAll('[data-action="book"]').forEach(b => {
            b.addEventListener("click", () => openWizard());
        });

        // Modal wizard
        document.getElementById("btn-close-modal").addEventListener("click", closeWizard);
        document.getElementById("booking-modal").addEventListener("click", e => {
            if (e.target.id === "booking-modal") closeWizard();
        });
        document.getElementById("btn-prev").addEventListener("click", wizardPrev);
        document.getElementById("btn-next").addEventListener("click", wizardNext);

        // Admin
        document.querySelectorAll('[data-action="open-admin"]').forEach(b => {
            b.addEventListener("click", openAdmin);
        });
        document.getElementById("admin-close").addEventListener("click", adminLogout);
        document.getElementById("admin-export").addEventListener("click", exportCSV);
        document.querySelectorAll(".admin-tab").forEach(t => {
            t.addEventListener("click", () => {
                state.admin.tab = t.dataset.tab;
                renderAdmin();
            });
        });
        document.getElementById("detail-close").addEventListener("click", closeDetail);

        // Admin login modal
        document.getElementById("btn-close-admin-login").addEventListener("click", closeAdminLogin);
        document.getElementById("admin-login-modal").addEventListener("click", e => {
            if (e.target.id === "admin-login-modal") closeAdminLogin();
        });
        document.getElementById("admin-login-form").addEventListener("submit", e => {
            e.preventDefault();
            tryAdminLogin(document.getElementById("inp-admin-pass").value);
        });

        // #admin hash → admin
        if (window.location.hash === "#admin") openAdmin();
        window.addEventListener("hashchange", () => {
            if (window.location.hash === "#admin") openAdmin();
        });

        // ESC para cerrar
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                if (state.admin.selectedId) { closeDetail(); return; }
                if (document.getElementById("admin-login-modal").classList.contains("open")) { closeAdminLogin(); return; }
                if (state.wizard.open) { closeWizard(); return; }
                if (state.admin.open) { closeAdmin(); return; }
                if (window.__obIsDrawerOpen && window.__obIsDrawerOpen()) { window.__obCloseDrawer(); return; }
            }
        });

        // Sincronización entre pestañas (otra pestaña guarda/elimina una cita)
        window.addEventListener("storage", ev => {
            if (ev.key === OBStorage.STORAGE_KEY) {
                if (state.admin.open) renderAdmin();
                if (state.wizard.open && state.wizard.step >= 2) renderWizard();
            }
        });

        // Sincronización inicial con PocketBase (re-renderiza admin si está abierto)
        OBStorage.onSync = () => {
            if (state.admin.open) renderAdmin();
            if (state.wizard.open && state.wizard.step >= 2) renderWizard();
        };
        OBStorage.init();
    });
})();
