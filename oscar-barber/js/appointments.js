/* ============================================================
   Oscar Barber — Flujo de reserva de cita (citas.html)
   ============================================================ */

(function () {
    const CFG = window.OB_CONFIG;

    document.addEventListener("DOMContentLoaded", () => {
        const root = document.querySelector(".booking");
        if (!root) return; // No estamos en citas.html

        const state = {
            step: 1,
            service: null,
            date: null,
            time: null,
            customer: { name: "", phone: "", email: "", notes: "" },
        };

        const els = {
            steps: Array.from(document.querySelectorAll(".booking-step")),
            stepperItems: Array.from(document.querySelectorAll(".stepper .step")),
            serviceList: document.getElementById("service-options-list"),
            toStep2: document.getElementById("to-step-2"),
            toStep3: document.getElementById("to-step-3"),
            toStep4: document.getElementById("to-step-4"),
            toStep5: document.getElementById("to-step-5"),
            confirmBtn: document.getElementById("confirm-booking"),
            timeSlots: document.getElementById("time-slots"),
            step3Help: document.getElementById("step3-help"),
            customerForm: document.getElementById("customer-form"),
            summaryCard: document.getElementById("summary-card"),
            doneSummary: document.getElementById("done-summary-card"),
            newBooking: document.getElementById("new-booking"),
            // Aside summary
            asideService: document.getElementById("aside-service"),
            asideDuration: document.getElementById("aside-duration"),
            asidePrice: document.getElementById("aside-price"),
            asideDate: document.getElementById("aside-date"),
            asideTime: document.getElementById("aside-time"),
            // Calendar
            calTitle: document.getElementById("cal-title"),
            calDays: document.getElementById("cal-days"),
            calPrev: document.getElementById("cal-prev"),
            calNext: document.getElementById("cal-next"),
        };

        /* ---- Paso 1: Servicios ---- */
        function renderServices() {
            els.serviceList.innerHTML = "";
            CFG.services.forEach(svc => {
                const opt = document.createElement("label");
                opt.className = "service-option";
                opt.setAttribute("data-service-id", svc.id);
                opt.innerHTML = `
                    <input type="radio" name="service" value="${svc.id}">
                    <span class="service-name">${svc.icon ? svc.icon + " " : ""}${svc.name}</span>
                    <span class="service-meta">
                        <span>${svc.durationMin} min</span>
                        <span class="price">${formatPrice(svc.price)}</span>
                    </span>
                `;
                opt.addEventListener("click", () => selectService(svc.id));
                els.serviceList.appendChild(opt);
            });
        }

        function selectService(id) {
            const svc = CFG.services.find(s => s.id === id);
            if (!svc) return;
            const isDifferent = !state.service || state.service.id !== id;
            state.service = svc;
            if (isDifferent) {
                // Al cambiar de servicio, fecha y hora elegidas pueden quedar inválidas
                state.date = null;
                state.time = null;
                els.toStep3.disabled = true;
                els.toStep4.disabled = true;
                if (calendar) calendar.clearSelection();
            }
            els.serviceList.querySelectorAll(".service-option").forEach(o => {
                o.classList.toggle("selected", o.getAttribute("data-service-id") === id);
                const input = o.querySelector("input");
                if (input) input.checked = (o.getAttribute("data-service-id") === id);
            });
            els.toStep2.disabled = false;
            updateAside();
            if (calendar) calendar.setServiceDuration(svc.durationMin);
        }

        /* ---- Paso 2: Calendario ---- */
        let calendar = null;
        function initCalendar() {
            if (calendar) return;
            calendar = window.OBCalendar.create({
                titleEl: els.calTitle,
                daysEl: els.calDays,
                prevBtn: els.calPrev,
                nextBtn: els.calNext,
                serviceDurationMin: state.service ? state.service.durationMin : 30,
                onSelect: (dateStr) => {
                    state.date = dateStr;
                    state.time = null;
                    els.toStep3.disabled = false;
                    updateAside();
                },
            });
        }

        /* ---- Paso 3: Slots de hora ---- */
        function renderTimeSlots() {
            els.timeSlots.innerHTML = "";
            els.toStep4.disabled = true;
            if (!state.service || !state.date) return;

            const slots = window.OBCalendar.getAvailableSlots(state.date, state.service.durationMin);
            const formattedDate = formatDateLong(state.date);
            els.step3Help.textContent = `Horarios disponibles para ${formattedDate}.`;

            if (slots.length === 0) {
                const empty = document.createElement("div");
                empty.className = "time-slots-empty";
                empty.textContent = "No quedan huecos para ese día. Prueba otra fecha.";
                els.timeSlots.appendChild(empty);
                return;
            }

            slots.forEach(t => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "time-slot";
                btn.textContent = t;
                btn.setAttribute("data-time", t);
                btn.addEventListener("click", () => selectTime(t));
                if (state.time === t) btn.classList.add("is-selected");
                els.timeSlots.appendChild(btn);
            });
        }

        function selectTime(t) {
            state.time = t;
            els.timeSlots.querySelectorAll(".time-slot").forEach(b => {
                b.classList.toggle("is-selected", b.getAttribute("data-time") === t);
            });
            els.toStep4.disabled = false;
            updateAside();
        }

        /* ---- Paso 4: Datos del cliente ---- */
        function readCustomerForm() {
            const fd = new FormData(els.customerForm);
            return {
                name: (fd.get("name") || "").toString().trim(),
                phone: (fd.get("phone") || "").toString().trim(),
                email: (fd.get("email") || "").toString().trim(),
                notes: (fd.get("notes") || "").toString().trim(),
            };
        }

        function validateCustomer(data) {
            const errors = {};
            if (data.name.length < 2) errors.name = "Introduce tu nombre.";
            if (!/^[+\d][\d\s\-().]{6,}$/.test(data.phone)) errors.phone = "Introduce un teléfono válido.";
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = "Email no válido.";
            return errors;
        }

        function showFieldErrors(errors) {
            ["name", "phone", "email"].forEach(field => {
                const input = els.customerForm.querySelector(`[name="${field}"]`);
                const errEl = els.customerForm.querySelector(`[data-error-for="${field}"]`);
                if (!input) return;
                if (errors[field]) {
                    input.setAttribute("aria-invalid", "true");
                    if (errEl) errEl.textContent = errors[field];
                } else {
                    input.removeAttribute("aria-invalid");
                    if (errEl) errEl.textContent = "";
                }
            });
        }

        /* ---- Paso 5: Resumen y confirmación ---- */
        function renderSummary(target) {
            const node = target || els.summaryCard;
            if (!state.service || !state.date || !state.time) {
                node.innerHTML = "";
                return;
            }
            node.innerHTML = `
                <div class="summary-row"><span>Servicio</span><span>${escapeHtml(state.service.name)}</span></div>
                <div class="summary-row"><span>Duración</span><span>${state.service.durationMin} min</span></div>
                <div class="summary-row"><span>Fecha</span><span>${formatDateLong(state.date)}</span></div>
                <div class="summary-row"><span>Hora</span><span>${state.time}</span></div>
                <div class="summary-row"><span>Cliente</span><span>${escapeHtml(state.customer.name || "—")}</span></div>
                <div class="summary-row"><span>Teléfono</span><span>${escapeHtml(state.customer.phone || "—")}</span></div>
                ${state.customer.email ? `<div class="summary-row"><span>Email</span><span>${escapeHtml(state.customer.email)}</span></div>` : ""}
                ${state.customer.notes ? `<div class="summary-row"><span>Notas</span><span>${escapeHtml(state.customer.notes)}</span></div>` : ""}
                <div class="summary-row summary-total"><span>Precio</span><span>${formatPrice(state.service.price)}</span></div>
            `;
        }

        function confirmBooking() {
            if (els.confirmBtn.disabled) return;
            els.confirmBtn.disabled = true;
            try {
                // Última comprobación: el slot todavía sigue libre
                const slots = window.OBCalendar.getAvailableSlots(state.date, state.service.durationMin);
                if (!slots.includes(state.time)) {
                    alert("Lo sentimos, ese horario acaba de ocuparse. Selecciona otra hora.");
                    goToStep(3);
                    renderTimeSlots();
                    return;
                }
                const saved = window.OBStorage.save({
                    serviceId: state.service.id,
                    serviceName: state.service.name,
                    durationMin: state.service.durationMin,
                    price: state.service.price,
                    date: state.date,
                    time: state.time,
                    customer: state.customer,
                });
                if (!saved) {
                    alert("No se ha podido guardar la cita. Inténtalo de nuevo.");
                    return;
                }
                renderSummary(els.doneSummary);
                goToStep("done");
                // Notificación por email al barbero (no bloqueante).
                sendNotification(saved).catch(err => {
                    console.warn("Notificación por email fallida:", err);
                });
            } finally {
                els.confirmBtn.disabled = false;
            }
        }

        function sendNotification(record) {
            if (!CFG.notifications || !CFG.notifications.enabled) return Promise.resolve();
            const to = CFG.notifications.emailTo;
            if (!to) return Promise.resolve();

            const payload = {
                _subject: `Nueva cita: ${record.date} ${record.time} — ${record.customer.name}`,
                _template: "table",
                _captcha: "false",
                Servicio: record.serviceName,
                Duración: `${record.durationMin} min`,
                Precio: `${record.price} €`,
                Fecha: formatDateLong(record.date),
                Hora: record.time,
                Cliente: record.customer.name,
                Teléfono: record.customer.phone,
                Email: record.customer.email || "(no proporcionado)",
                Notas: record.customer.notes || "(sin notas)",
                IdCita: record.id,
                Reservado: record.createdAt,
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

        /* ---- Navegación entre pasos ---- */
        function goToStep(step) {
            state.step = step;
            els.steps.forEach(sec => {
                const target = sec.getAttribute("data-step-content");
                const matches = String(target) === String(step);
                sec.hidden = !matches;
                sec.classList.toggle("is-active", matches);
            });
            els.stepperItems.forEach(item => {
                const n = Number(item.getAttribute("data-step"));
                item.classList.toggle("active", n === Number(step));
                item.classList.toggle("is-done", typeof step === "number" && n < step);
                if (step === "done") {
                    item.classList.remove("active");
                    item.classList.add("is-done");
                }
            });
            // Acciones específicas al entrar a cada paso
            if (step === 2) {
                initCalendar();
                // Si volvemos al paso 2 con servicio nuevo, actualizar duración
                if (state.service) calendar.setServiceDuration(state.service.durationMin);
            }
            if (step === 3) renderTimeSlots();
            if (step === 5) renderSummary();

            // Scroll al inicio del flow
            const targetSec = els.steps.find(s => !s.hidden);
            if (targetSec && targetSec.scrollIntoView) {
                targetSec.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }

        /* ---- Aside ---- */
        function updateAside() {
            els.asideService.textContent = state.service ? state.service.name : "—";
            els.asideDuration.textContent = state.service ? `${state.service.durationMin} min` : "—";
            els.asidePrice.textContent = state.service ? formatPrice(state.service.price) : "—";
            els.asideDate.textContent = state.date ? formatDateLong(state.date) : "—";
            els.asideTime.textContent = state.time || "—";
        }

        /* ---- Helpers ---- */
        function formatPrice(value) { return value.toFixed(0).replace(/\.0+$/, "") + " €"; }

        function formatDateLong(dateStr) {
            const d = window.OBCalendar.parseDateStr(dateStr);
            const weekday = CFG.weekdays[(d.getDay() + 6) % 7];
            return `${weekday} ${d.getDate()} de ${CFG.months[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
        }

        function escapeHtml(s) {
            return String(s)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        /* ---- Bindings de botones ---- */
        els.toStep2.addEventListener("click", () => goToStep(2));
        els.toStep3.addEventListener("click", () => goToStep(3));
        els.toStep4.addEventListener("click", () => goToStep(4));
        els.toStep5.addEventListener("click", () => {
            const data = readCustomerForm();
            const errors = validateCustomer(data);
            showFieldErrors(errors);
            if (Object.keys(errors).length > 0) {
                const first = els.customerForm.querySelector('[aria-invalid="true"]');
                if (first) first.focus();
                return;
            }
            state.customer = data;
            updateAside();
            goToStep(5);
        });
        els.confirmBtn.addEventListener("click", confirmBooking);

        document.querySelectorAll("[data-back]").forEach(btn => {
            btn.addEventListener("click", () => goToStep(Number(btn.getAttribute("data-back"))));
        });

        if (els.newBooking) {
            els.newBooking.addEventListener("click", () => {
                state.service = null;
                state.date = null;
                state.time = null;
                state.customer = { name: "", phone: "", email: "", notes: "" };
                els.customerForm.reset();
                els.toStep2.disabled = true;
                els.toStep3.disabled = true;
                els.toStep4.disabled = true;
                els.serviceList.querySelectorAll(".service-option.selected").forEach(o => o.classList.remove("selected"));
                if (calendar) calendar.clearSelection();
                updateAside();
                goToStep(1);
            });
        }

        // Limpiar errores al editar campos
        els.customerForm.querySelectorAll("input, textarea").forEach(input => {
            input.addEventListener("input", () => {
                input.removeAttribute("aria-invalid");
                const errEl = els.customerForm.querySelector(`[data-error-for="${input.name}"]`);
                if (errEl) errEl.textContent = "";
            });
        });

        // Pre-selección si hay servicio en la URL: ?servicio=corte
        const urlParams = new URLSearchParams(window.location.search);
        const preService = urlParams.get("servicio");

        renderServices();
        if (preService && CFG.services.some(s => s.id === preService)) {
            selectService(preService);
        }
        updateAside();
        goToStep(1);
    });
})();
