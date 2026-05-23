/* ============================================================
   Oscar Barber — Panel de administración (admin.html)
   ============================================================ */

(function () {
    const CFG = window.OB_CONFIG;
    const SESSION_KEY = "ob_admin_session_v1";

    document.addEventListener("DOMContentLoaded", () => {
        if (!document.getElementById("admin-login")) return;

        const els = {
            login: document.getElementById("admin-login"),
            panel: document.getElementById("admin-panel"),
            loginForm: document.getElementById("login-form"),
            loginInput: document.getElementById("login-pass"),
            loginError: document.getElementById("login-error"),
            logoutBtn: document.getElementById("logout-btn"),
            exportBtn: document.getElementById("export-btn"),
            // KPIs
            kpiTotal: document.getElementById("kpi-total"),
            kpiUpcoming: document.getElementById("kpi-upcoming"),
            kpiToday: document.getElementById("kpi-today"),
            kpiRevenue: document.getElementById("kpi-revenue"),
            // Calendar
            admTitle: document.getElementById("adm-title"),
            admDays: document.getElementById("adm-days"),
            admPrev: document.getElementById("adm-prev"),
            admNext: document.getElementById("adm-next"),
            // Day list
            dayTitle: document.getElementById("day-title"),
            dayStats: document.getElementById("day-stats"),
            dayList: document.getElementById("day-list"),
        };

        let viewDate = new Date();
        viewDate.setDate(1);
        let selectedDateStr = OBCalendar.toDateStr(new Date());

        /* ---- Sesión ---- */
        function isAuthenticated() {
            return sessionStorage.getItem(SESSION_KEY) === "ok";
        }
        function login(pass) {
            const expected = (CFG.admin && CFG.admin.password) || "";
            if (!expected) {
                els.loginError.textContent = "No hay contraseña configurada en config.js.";
                return false;
            }
            if (pass === expected) {
                sessionStorage.setItem(SESSION_KEY, "ok");
                return true;
            }
            return false;
        }
        function logout() {
            sessionStorage.removeItem(SESSION_KEY);
            renderAuthState();
        }

        function renderAuthState() {
            if (isAuthenticated()) {
                els.login.hidden = true;
                els.panel.hidden = false;
                renderAll();
            } else {
                els.login.hidden = false;
                els.panel.hidden = true;
                els.loginInput.value = "";
                els.loginError.textContent = "";
                setTimeout(() => els.loginInput.focus(), 50);
            }
        }

        /* ---- Helpers ---- */
        function formatPrice(n) { return n.toFixed(0).replace(/\.0+$/, "") + " €"; }

        function formatDateLong(dateStr) {
            const d = OBCalendar.parseDateStr(dateStr);
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

        function startOfDay(d) {
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        }

        /* ---- KPIs ---- */
        function renderKpis() {
            const all = OBStorage.getAll();
            const todayStr = OBCalendar.toDateStr(new Date());
            const today = startOfDay(new Date());

            const upcoming = all.filter(a => OBCalendar.parseDateStr(a.date) >= today);
            const todayList = all.filter(a => a.date === todayStr);
            const revenue = upcoming.reduce((sum, a) => sum + (a.price || 0), 0);

            els.kpiTotal.textContent = all.length;
            els.kpiUpcoming.textContent = upcoming.length;
            els.kpiToday.textContent = todayList.length;
            els.kpiRevenue.textContent = formatPrice(revenue);
        }

        /* ---- Calendario admin ---- */
        function isoWeekdayMondayFirst(date) {
            return (date.getDay() + 6) % 7;
        }
        function addMonths(date, delta) {
            return new Date(date.getFullYear(), date.getMonth() + delta, 1);
        }

        function getCountsForMonth(year, month) {
            const counts = {};
            OBStorage.getAll().forEach(a => {
                const d = OBCalendar.parseDateStr(a.date);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    counts[a.date] = (counts[a.date] || 0) + 1;
                }
            });
            return counts;
        }

        function renderCalendar() {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const counts = getCountsForMonth(year, month);
            const todayStr = OBCalendar.toDateStr(new Date());

            els.admTitle.textContent = `${CFG.months[month]} ${year}`;

            const firstOfMonth = new Date(year, month, 1);
            const lastOfMonth = new Date(year, month + 1, 0);
            const startWeekday = isoWeekdayMondayFirst(firstOfMonth);
            const totalDays = lastOfMonth.getDate();
            const totalCells = Math.ceil((startWeekday + totalDays) / 7) * 7;

            els.admDays.innerHTML = "";

            for (let i = 0; i < totalCells; i++) {
                const dayNum = i - startWeekday + 1;
                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "cal-day adm-day";

                if (dayNum < 1 || dayNum > totalDays) {
                    cell.classList.add("is-other-month");
                    cell.setAttribute("tabindex", "-1");
                    cell.setAttribute("aria-hidden", "true");
                    els.admDays.appendChild(cell);
                    continue;
                }

                const cellDate = new Date(year, month, dayNum);
                const cellStr = OBCalendar.toDateStr(cellDate);

                const hasAppointments = (counts[cellStr] || 0) > 0;
                const isToday = cellStr === todayStr;
                const isSelected = cellStr === selectedDateStr;

                cell.setAttribute("data-date", cellStr);
                cell.innerHTML = `<span class="day-num">${dayNum}</span>` +
                    (hasAppointments ? `<span class="day-badge">${counts[cellStr]}</span>` : "");

                cell.classList.add("is-available");
                if (isToday) cell.classList.add("is-today");
                if (isSelected) cell.classList.add("is-selected");
                if (hasAppointments) cell.classList.add("has-appointments");

                cell.addEventListener("click", () => {
                    selectedDateStr = cellStr;
                    renderCalendar();
                    renderDayList();
                });

                els.admDays.appendChild(cell);
            }
        }

        /* ---- Lista de citas del día ---- */
        function renderDayList() {
            if (!selectedDateStr) {
                els.dayTitle.textContent = "Selecciona un día";
                els.dayStats.textContent = "—";
                els.dayList.innerHTML = `<p class="empty-msg">Pulsa cualquier día del calendario para ver sus citas.</p>`;
                return;
            }

            const list = OBStorage.getForDate(selectedDateStr)
                .slice()
                .sort((a, b) => a.time.localeCompare(b.time));

            els.dayTitle.textContent = formatDateLong(selectedDateStr);

            if (list.length === 0) {
                els.dayStats.textContent = "Sin citas";
                els.dayList.innerHTML = `<p class="empty-msg">No hay reservas para este día.</p>`;
                return;
            }

            const totalRevenue = list.reduce((s, a) => s + (a.price || 0), 0);
            const totalMin = list.reduce((s, a) => s + (a.durationMin || 0), 0);
            els.dayStats.textContent = `${list.length} cita${list.length === 1 ? "" : "s"} · ${totalMin} min · ${formatPrice(totalRevenue)}`;

            els.dayList.innerHTML = "";
            list.forEach(a => els.dayList.appendChild(buildAppointmentCard(a)));
        }

        function buildAppointmentCard(a) {
            const card = document.createElement("article");
            card.className = "appt-card";
            const phoneClean = (a.customer.phone || "").replace(/\s+/g, "");
            card.innerHTML = `
                <div class="appt-time">
                    <span class="appt-hour">${escapeHtml(a.time)}</span>
                    <span class="appt-duration">${a.durationMin} min</span>
                </div>
                <div class="appt-body">
                    <header class="appt-head">
                        <h3>${escapeHtml(a.customer.name || "(sin nombre)")}</h3>
                        <span class="appt-price">${formatPrice(a.price || 0)}</span>
                    </header>
                    <p class="appt-service">${escapeHtml(a.serviceName)}</p>
                    <ul class="appt-meta">
                        ${a.customer.phone ? `<li>📞 <a href="tel:${escapeHtml(phoneClean)}">${escapeHtml(a.customer.phone)}</a></li>` : ""}
                        ${a.customer.email ? `<li>✉ <a href="mailto:${escapeHtml(a.customer.email)}">${escapeHtml(a.customer.email)}</a></li>` : ""}
                        ${a.customer.notes ? `<li>📝 ${escapeHtml(a.customer.notes)}</li>` : ""}
                    </ul>
                    <footer class="appt-actions">
                        <button type="button" class="btn-link-danger" data-cancel="${escapeHtml(a.id)}">Cancelar cita</button>
                    </footer>
                </div>
            `;
            card.querySelector("[data-cancel]").addEventListener("click", () => {
                if (confirm(`¿Cancelar la cita de ${a.customer.name} (${a.time})?`)) {
                    OBStorage.remove(a.id);
                    renderAll();
                }
            });
            return card;
        }

        /* ---- Export CSV ---- */
        function exportCSV() {
            const all = OBStorage.getAll()
                .slice()
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
            const headers = ["Fecha", "Hora", "Cliente", "Teléfono", "Email", "Servicio", "Duración (min)", "Precio (€)", "Notas", "Creada"];
            const rows = all.map(a => [
                a.date, a.time, a.customer.name, a.customer.phone,
                a.customer.email || "", a.serviceName, a.durationMin, a.price,
                a.customer.notes || "", a.createdAt
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
            link.download = `oscar-barber-citas-${OBCalendar.toDateStr(new Date())}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        /* ---- Render global ---- */
        function renderAll() {
            renderKpis();
            renderCalendar();
            renderDayList();
        }

        /* ---- Bindings ---- */
        els.loginForm.addEventListener("submit", (ev) => {
            ev.preventDefault();
            const pass = els.loginInput.value;
            if (login(pass)) {
                renderAuthState();
            } else {
                els.loginError.textContent = "Contraseña incorrecta.";
                els.loginInput.select();
            }
        });
        els.logoutBtn.addEventListener("click", logout);
        els.exportBtn.addEventListener("click", exportCSV);
        els.admPrev.addEventListener("click", () => {
            viewDate = addMonths(viewDate, -1);
            renderCalendar();
        });
        els.admNext.addEventListener("click", () => {
            viewDate = addMonths(viewDate, 1);
            renderCalendar();
        });

        // Refresca si cambian las citas en otra pestaña
        window.addEventListener("storage", (ev) => {
            if (ev.key === OBStorage.STORAGE_KEY && isAuthenticated()) {
                renderAll();
            }
        });

        renderAuthState();
    });
})();
