/* ============================================================
   Oscar Barber — Inicialización común a todas las páginas
   ============================================================ */

(function () {
    const CFG = window.OB_CONFIG;

    function formatPrice(value) {
        return value.toFixed(0).replace(/\.0+$/, "") + " €";
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function telHref(phone) {
        return "tel:" + phone.replace(/\s+/g, "");
    }

    function formatShifts(shifts) {
        if (!shifts) return "Cerrado";
        return shifts.map(s => `${s.open}–${s.close}`).join(" / ");
    }

    function renderFooter() {
        // Horario en el footer
        const scheduleEl = document.getElementById("footer-schedule");
        if (scheduleEl) {
            scheduleEl.innerHTML = "";
            // Lunes a Domingo (en orden visual: L M X J V S D)
            const dayOrder = [1, 2, 3, 4, 5, 6, 0];
            dayOrder.forEach((dow, idx) => {
                const li = document.createElement("li");
                li.textContent = `${CFG.weekdays[idx]}: ${formatShifts(CFG.schedule[dow])}`;
                scheduleEl.appendChild(li);
            });
        }

        // Datos de contacto en footer
        const phoneEl = document.getElementById("footer-phone-link");
        if (phoneEl) { phoneEl.textContent = CFG.business.phone; phoneEl.href = telHref(CFG.business.phone); }
        const emailEl = document.getElementById("footer-email-link");
        if (emailEl) { emailEl.textContent = CFG.business.email; emailEl.href = "mailto:" + CFG.business.email; }

        // Año actual
        const yearEl = document.getElementById("current-year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    function renderServicePreview() {
        const grid = document.getElementById("services-preview-grid");
        if (!grid) return;
        const featured = CFG.services.slice(0, 4);
        grid.innerHTML = "";
        featured.forEach(svc => grid.appendChild(buildServiceCard(svc)));
    }

    function renderServicesFull() {
        const grid = document.getElementById("services-full-grid");
        if (!grid) return;
        grid.innerHTML = "";
        CFG.services.forEach(svc => grid.appendChild(buildServiceCard(svc, true)));
    }

    function buildServiceCard(svc, withDescription) {
        const card = document.createElement("article");
        card.className = "service-card";
        card.innerHTML = `
            <div class="service-card-head">
                <h3>${svc.icon ? svc.icon + " " : ""}${escapeHtml(svc.name)}</h3>
                <span class="service-price">${formatPrice(svc.price)}</span>
            </div>
            <span class="service-duration">⏱ ${svc.durationMin} min</span>
            ${withDescription || svc.description ? `<p class="service-desc">${escapeHtml(svc.description || "")}</p>` : ""}
            <a class="service-cta" href="citas.html?servicio=${encodeURIComponent(svc.id)}">Reservar</a>
        `;
        return card;
    }

    function renderContactPage() {
        const phoneEl = document.getElementById("contact-phone-link");
        if (phoneEl) { phoneEl.textContent = CFG.business.phone; phoneEl.href = telHref(CFG.business.phone); }
        const emailEl = document.getElementById("contact-email-link");
        if (emailEl) { emailEl.textContent = CFG.business.email; emailEl.href = "mailto:" + CFG.business.email; }

        const schedEl = document.getElementById("contact-schedule");
        if (schedEl) {
            schedEl.innerHTML = "";
            const dayOrder = [1, 2, 3, 4, 5, 6, 0];
            dayOrder.forEach((dow, idx) => {
                const li = document.createElement("li");
                li.innerHTML = `<strong style="text-transform:none;letter-spacing:0;color:var(--color-text)">${CFG.weekdays[idx]}:</strong> ${formatShifts(CFG.schedule[dow])}`;
                schedEl.appendChild(li);
            });
        }
    }

    function initContactForm() {
        const form = document.getElementById("contact-form");
        if (!form) return;
        const feedback = document.getElementById("cf-feedback");

        form.addEventListener("submit", (ev) => {
            ev.preventDefault();
            const fd = new FormData(form);
            const data = {
                name: (fd.get("name") || "").toString().trim(),
                email: (fd.get("email") || "").toString().trim(),
                message: (fd.get("message") || "").toString().trim(),
            };
            const errors = {};
            if (data.name.length < 2) errors.name = "Introduce tu nombre.";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = "Email no válido.";
            if (data.message.length < 5) errors.message = "Escribe un mensaje.";

            ["name", "email", "message"].forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                const errEl = form.querySelector(`[data-error-for="${field}"]`);
                if (errors[field]) {
                    input.setAttribute("aria-invalid", "true");
                    if (errEl) errEl.textContent = errors[field];
                } else {
                    input.removeAttribute("aria-invalid");
                    if (errEl) errEl.textContent = "";
                }
            });

            if (Object.keys(errors).length > 0) {
                feedback.className = "form-feedback is-error";
                feedback.textContent = "Revisa los campos marcados.";
                return;
            }

            feedback.className = "form-feedback is-success";
            feedback.textContent = "Gracias, hemos recibido tu mensaje. Te responderemos pronto.";
            form.reset();
        });
    }

    /*
     * Atajo oculto: pulsación larga (1.5 s) sobre el logo → admin.html.
     * Pensado para que el barbero pueda entrar en cualquier dispositivo
     * sin tener que recordar la URL.
     */
    function initLogoSecret() {
        const logo = document.querySelector(".logo");
        if (!logo) return;
        let timer = null;
        const HOLD_MS = 1500;
        const start = () => {
            cancel();
            timer = setTimeout(() => {
                window.location.href = "admin.html";
                timer = null;
            }, HOLD_MS);
        };
        const cancel = () => {
            if (timer) { clearTimeout(timer); timer = null; }
        };
        logo.addEventListener("pointerdown", start);
        logo.addEventListener("pointerup", cancel);
        logo.addEventListener("pointerleave", cancel);
        logo.addEventListener("pointercancel", cancel);
        // Evita el menú contextual en touch durante long-press.
        logo.addEventListener("contextmenu", (ev) => {
            if (timer) ev.preventDefault();
        });
    }

    function initNavToggle() {
        const nav = document.querySelector(".main-nav");
        const toggle = document.querySelector(".nav-toggle");
        if (!nav || !toggle) return;
        toggle.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("is-open");
            toggle.setAttribute("aria-expanded", String(isOpen));
        });
        // Cerrar al pulsar un enlace
        nav.querySelectorAll("a").forEach(a => {
            a.addEventListener("click", () => {
                nav.classList.remove("is-open");
                toggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        initNavToggle();
        initLogoSecret();
        renderFooter();
        renderServicePreview();
        renderServicesFull();
        renderContactPage();
        initContactForm();
    });
})();
