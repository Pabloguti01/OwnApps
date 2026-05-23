/* ============================================================
   Oscar Barber — Calendario y cálculo de slots disponibles
   ============================================================ */

(function () {
    const CFG = window.OB_CONFIG;

    /* Utilidades de fecha/hora ---------------------------------- */

    function pad2(n) { return String(n).padStart(2, "0"); }

    function toDateStr(date) {
        return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
    }

    function parseDateStr(str) {
        // "YYYY-MM-DD" -> Date en zona local a medianoche
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    function parseTime(str) {
        const [h, m] = str.split(":").map(Number);
        return h * 60 + m;
    }

    function formatTime(totalMinutes) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return pad2(h) + ":" + pad2(m);
    }

    function isoWeekdayMondayFirst(date) {
        // 0=Lunes, ..., 6=Domingo
        const js = date.getDay(); // 0=Domingo, 1=Lunes, ...
        return (js + 6) % 7;
    }

    function addMonths(date, delta) {
        return new Date(date.getFullYear(), date.getMonth() + delta, 1);
    }

    function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    }

    function todayStr() { return toDateStr(new Date()); }

    /* Disponibilidad -------------------------------------------- */

    function getShiftsForDate(dateStr) {
        if (CFG.closedDates.includes(dateStr)) return null;
        const date = parseDateStr(dateStr);
        const dow = date.getDay();
        const shifts = CFG.schedule[dow];
        return shifts || null;
    }

    /**
     * Devuelve los horarios libres ("HH:MM") para una fecha,
     * dada la duración del servicio en minutos.
     */
    function getAvailableSlots(dateStr, serviceDurationMin) {
        const shifts = getShiftsForDate(dateStr);
        if (!shifts) return [];

        const interval = CFG.booking.slotIntervalMin;
        const leadTime = CFG.booking.minLeadTimeMin;
        const isToday = dateStr === todayStr();
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        // Días pasados no se reservan
        const targetDay = parseDateStr(dateStr);
        if (targetDay < startOfDay(now)) return [];

        // Citas existentes para esa fecha (intervalos ocupados)
        const existing = (window.OBStorage ? OBStorage.getForDate(dateStr) : [])
            .map(a => {
                const start = parseTime(a.time);
                return { start, end: start + (a.durationMin || 30) };
            });

        const slots = [];
        for (const shift of shifts) {
            const shiftStart = parseTime(shift.open);
            const shiftEnd = parseTime(shift.close);

            for (let t = shiftStart; t + serviceDurationMin <= shiftEnd; t += interval) {
                const slotEnd = t + serviceDurationMin;

                // Saltar slots que se superpongan con citas existentes
                const overlaps = existing.some(e => t < e.end && slotEnd > e.start);
                if (overlaps) continue;

                // Hoy: solo slots con suficiente antelación
                if (isToday && t <= nowMin + leadTime) continue;

                slots.push(formatTime(t));
            }
        }
        return slots;
    }

    function isDateBookable(dateStr, serviceDurationMin) {
        if (!getShiftsForDate(dateStr)) return false;
        const targetDay = parseDateStr(dateStr);
        if (targetDay < startOfDay(new Date())) return false;
        return getAvailableSlots(dateStr, serviceDurationMin).length > 0;
    }

    /* Renderizado del calendario -------------------------------- */

    function create(options) {
        const {
            titleEl,
            daysEl,
            prevBtn,
            nextBtn,
            onSelect = () => {},
        } = options;

        let serviceDurationMin = options.serviceDurationMin || 30;
        let viewDate = new Date(); // primer día del mes visible
        viewDate.setDate(1);
        let selectedDateStr = null;

        const today = startOfDay(new Date());
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + CFG.booking.maxDaysAhead);

        function render() {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();

            titleEl.textContent = `${CFG.months[month]} ${year}`;

            const firstOfMonth = new Date(year, month, 1);
            const lastOfMonth = new Date(year, month + 1, 0);
            const startWeekday = isoWeekdayMondayFirst(firstOfMonth);
            const totalDays = lastOfMonth.getDate();

            // Cuántos días en total renderizar (múltiplo de 7)
            const totalCells = Math.ceil((startWeekday + totalDays) / 7) * 7;

            daysEl.innerHTML = "";

            for (let i = 0; i < totalCells; i++) {
                const dayNum = i - startWeekday + 1;
                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "cal-day";

                if (dayNum < 1 || dayNum > totalDays) {
                    cell.classList.add("is-other-month");
                    cell.setAttribute("tabindex", "-1");
                    cell.setAttribute("aria-hidden", "true");
                    daysEl.appendChild(cell);
                    continue;
                }

                const cellDate = new Date(year, month, dayNum);
                const cellStr = toDateStr(cellDate);

                cell.textContent = String(dayNum);
                cell.setAttribute("data-date", cellStr);

                const isPast = cellDate < today;
                const isBeyond = cellDate > maxDate;
                const isToday = cellStr === todayStr();
                const bookable = !isPast && !isBeyond && isDateBookable(cellStr, serviceDurationMin);

                if (isToday) cell.classList.add("is-today");

                if (bookable) {
                    cell.classList.add("is-available");
                    cell.setAttribute("aria-label", `Reservar para ${dayNum} de ${CFG.months[month]}`);
                    if (cellStr === selectedDateStr) cell.classList.add("is-selected");
                    cell.addEventListener("click", () => handleSelect(cellStr));
                } else {
                    cell.classList.add("is-disabled");
                    cell.disabled = true;
                    cell.setAttribute("aria-disabled", "true");
                }

                daysEl.appendChild(cell);
            }

            // Habilitar/deshabilitar navegación
            const currentMonthStart = new Date(year, month, 1);
            const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            prevBtn.disabled = currentMonthStart <= todayMonthStart;

            const maxMonthStart = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
            nextBtn.disabled = currentMonthStart >= maxMonthStart;
        }

        function handleSelect(dateStr) {
            selectedDateStr = dateStr;
            render();
            onSelect(dateStr);
        }

        prevBtn.addEventListener("click", () => {
            viewDate = addMonths(viewDate, -1);
            render();
        });
        nextBtn.addEventListener("click", () => {
            viewDate = addMonths(viewDate, 1);
            render();
        });

        render();

        return {
            setServiceDuration(min) {
                serviceDurationMin = min;
                // Si el día seleccionado deja de ser reservable, lo limpiamos
                if (selectedDateStr && !isDateBookable(selectedDateStr, min)) {
                    selectedDateStr = null;
                }
                render();
            },
            getSelectedDate() { return selectedDateStr; },
            clearSelection() { selectedDateStr = null; render(); },
            refresh: render,
        };
    }

    window.OBCalendar = {
        create,
        getAvailableSlots,
        isDateBookable,
        toDateStr,
        parseDateStr,
        parseTime,
        formatTime,
    };
})();
