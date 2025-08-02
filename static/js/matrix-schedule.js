// Enhanced Matrix Schedule System for OpenSchichtplaner5
// Implements infinite horizontal navigation with matrix views

class MatrixScheduleManager {
    constructor() {
        // State management
        this.currentDate = new Date();
        this.currentView = 'dienstplan';
        this.visibleDaysCount = 14; // Show 14 days by default
        this.scheduleData = {};
        this.employees = [];
        this.shifts = [];
        this.employeeNames = new Map(); // ID -> {name, firstname}
        
        // Initialize the system
        this.init();
    }
    
    async init() {
        console.log('🗓️ Initializing Matrix Schedule System...');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadBaseData();
        
        // Load employee names mapping
        await this.loadEmployeeNames();
        
        // Set initial view - NO AUTO LOADING
        this.currentView = 'dienstplan';
        
        // Update display
        this.updateDateDisplay();
        
        // Don't auto-load - let HTML template functions control loading
        console.log('✅ MatrixScheduleManager ready for manual control');
    }
    
    setupEventListeners() {
        // Tab navigation - DISABLED to prevent double loading
        // The HTML template functions handle tab switching now
        /*
        document.querySelectorAll('.schedule-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchToView(view);
            });
        });
        */
        
        // Date navigation
        document.getElementById('nav-day-backward')?.addEventListener('click', () => {
            this.navigateBy(-1);
        });
        
        document.getElementById('nav-day-forward')?.addEventListener('click', () => {
            this.navigateBy(1);
        });
        
        document.getElementById('nav-fast-backward')?.addEventListener('click', () => {
            this.navigateBy(-7);
        });
        
        document.getElementById('nav-fast-forward')?.addEventListener('click', () => {
            this.navigateBy(7);
        });
        
        document.getElementById('nav-today')?.addEventListener('click', () => {
            this.goToToday();
        });
    }
    
    async loadBaseData() {
        try {
            // Load employees
            const employeesResponse = await fetch('/api/employees?limit=500');
            if (employeesResponse.ok) {
                this.employees = await employeesResponse.json();
            }
            
            // Load shifts
            const shiftsResponse = await fetch('/api/shifts');
            if (shiftsResponse.ok) {
                this.shifts = await shiftsResponse.json();
            }
            
            console.log(`✅ Loaded ${this.employees.length} employees and ${this.shifts.length} shifts`);
        } catch (error) {
            console.error('❌ Failed to load base data:', error);
        }
    }
    
    async loadEmployeeNames() {
        try {
            console.log('👥 Loading employee names...');
            const response = await fetch('/api/employees');
            if (response.ok) {
                const employees = await response.json();
                employees.forEach(emp => {
                    this.employeeNames.set(emp.id, {
                        name: emp.name,
                        firstname: emp.firstname,
                        fullName: `${emp.firstname} ${emp.name}`.trim()
                    });
                });
                console.log(`✅ Loaded ${employees.length} employee names`);
            }
        } catch (error) {
            console.error('❌ Failed to load employee names:', error);
        }
    }
    
    getEmployeeName(employeeId) {
        const employee = this.employeeNames.get(employeeId);
        return employee ? employee.fullName : `Mitarbeiter ${employeeId}`;
    }
    
    switchToView(viewName) {
        // Update active tab
        document.querySelectorAll('.schedule-tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            }
        });
        
        // Hide all views
        document.querySelectorAll('.schedule-view').forEach(view => {
            view.classList.add('hidden');
            view.classList.remove('active');
        });
        
        // Show current view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }
        
        this.currentView = viewName;
        
        // Don't auto-load - HTML template functions control loading
        console.log(`🔄 Switched to ${viewName} view (manual control mode)`);
    }
    
    navigateBy(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.updateDateDisplay();
        
        // Load schedule data asynchronously
        this.loadScheduleForCurrentRange().catch(error => {
            console.error('❌ Failed to load schedule data during navigation:', error);
        });
        
        console.log(`📅 Navigated ${days > 0 ? 'forward' : 'backward'} by ${Math.abs(days)} days to ${this.currentDate.toDateString()}`);
    }
    
    goToToday() {
        this.currentDate = new Date();
        this.updateDateDisplay();
        
        // Load schedule data asynchronously
        this.loadScheduleForCurrentRange().catch(error => {
            console.error('❌ Failed to load schedule data when jumping to today:', error);
        });
        
        console.log('📅 Jumped to today:', this.currentDate.toDateString());
    }
    
    updateDateDisplay() {
        const displayElement = document.getElementById('current-date-display');
        const weekElement = document.getElementById('current-week');
        
        if (displayElement) {
            const options = { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            };
            displayElement.textContent = this.currentDate.toLocaleDateString('de-DE', options);
        }
        
        if (weekElement) {
            const weekNumber = this.getWeekNumber(this.currentDate);
            weekElement.textContent = `KW ${weekNumber} • ${this.visibleDaysCount} Tage sichtbar`;
        }
    }
    
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }
    
    getDateRange() {
        const startDate = new Date(this.currentDate);
        const endDate = new Date(this.currentDate);
        endDate.setDate(startDate.getDate() + this.visibleDaysCount - 1);
        
        return { startDate, endDate };
    }
    
    async loadScheduleForCurrentRange() {
        const { startDate, endDate } = this.getDateRange();
        
        // Show loading animation
        if (typeof showScheduleLoading === 'function') {
            showScheduleLoading();
        }
        
        try {
            if (this.currentView === 'dienstplan') {
                await this.loadDienstplanData(startDate, endDate);
            } else if (this.currentView === 'einsatzplan') {
                await this.loadEinsatzplanData(startDate, endDate);
            } else if (this.currentView === 'jahresuebersicht') {
                await this.loadJahresuebersichtData();
            }
            
            // Hide loading animation after successful load
            if (typeof hideScheduleLoading === 'function') {
                hideScheduleLoading();
            }
        } catch (error) {
            console.error('❌ Failed to load schedule data:', error);
            // Hide loading animation on error
            if (typeof hideScheduleLoading === 'function') {
                hideScheduleLoading();
            }
            // Show error message
            if (typeof showScheduleError === 'function') {
                showScheduleError('Fehler beim Laden der Schichtdaten');
            }
        }
    }
    
    async loadDienstplanData(startDate, endDate) {
        console.log('📊 Loading Dienstplan data...');
        
        try {
            // Always use the monthly API since it provides the correct nested structure
            await this.generateDienstplanFromMonthly(startDate, endDate);
        } catch (error) {
            console.error('❌ Dienstplan loading failed:', error);
            // Show error message
            if (typeof showScheduleError === 'function') {
                showScheduleError('Fehler beim Laden der Dienstplandaten');
            }
        }
    }
    
    async generateDienstplanFromMonthly(startDate, endDate) {
        // Generate multiple API calls to cover the date range
        const months = new Set();
        const currentMonth = new Date(startDate);
        
        while (currentMonth <= endDate) {
            months.add({
                year: currentMonth.getFullYear(),
                month: currentMonth.getMonth() + 1
            });
            currentMonth.setMonth(currentMonth.getMonth() + 1);
        }
        
        let combinedData = { employees: [] };
        const employeeMap = new Map(); // Track unique employees by ID
        
        for (const monthData of months) {
            try {
                const response = await fetch(`/api/schedule/dienstplan?year=${monthData.year}&month=${monthData.month}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.employees) {
                        // Merge employee schedules, avoiding duplicates
                        data.employees.forEach(empData => {
                            const empId = empData.employee.id;
                            if (!employeeMap.has(empId)) {
                                employeeMap.set(empId, {
                                    employee: empData.employee,
                                    schedule: { ...empData.schedule }
                                });
                            } else {
                                // Merge schedules
                                const existing = employeeMap.get(empId);
                                existing.schedule = { ...existing.schedule, ...empData.schedule };
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to load month', monthData, error);
            }
        }
        
        // Convert map back to array
        combinedData.employees = Array.from(employeeMap.values());
        
        this.renderDienstplanMatrix(combinedData, startDate, endDate);
    }
    
    renderDienstplanMatrix(data, startDate, endDate) {
        const container = document.getElementById('dienstplan-view');
        const headerContainer = document.getElementById('dienstplan-day-headers');
        const tbody = document.getElementById('dienstplan-tbody');
        
        if (!container || !tbody) {
            console.error('❌ Required DOM elements not found for Dienstplan view');
            return;
        }
        
        // Keep view hidden during rendering to prevent FOUC
        container.classList.add('hidden');
        
        // Generate day headers
        const dayHeaders = this.generateDayHeaders(startDate, endDate);
        
        // Generate employee rows
        let employeeRows = '';
        const employees = data.employees || []; 
        
        console.log(`📊 Rendering ${employees.length} employees for Dienstplan`);
        
        if (employees.length === 0) {
            employeeRows = `
                <tr>
                    <td colspan="${this.visibleDaysCount + 1}" class="px-4 py-8 text-center text-gray-500">
                        Keine Mitarbeiterdaten verfügbar
                    </td>
                </tr>
            `;
        } else {
            employees.forEach((employeeData, index) => {
                // Handle nested structure from API
                const employee = employeeData.employee || employeeData;
                
                // Construct employee name with fallbacks
                let employeeName = 'Unbekannter Mitarbeiter';
                if (employee.firstname && employee.name) {
                    employeeName = `${employee.firstname} ${employee.name}`.trim();
                } else if (employee.name) {
                    employeeName = employee.name;
                } else if (employee.firstname) {
                    employeeName = employee.firstname;
                } else {
                    employeeName = `Mitarbeiter ${employee.id}`;
                }
                
                console.log(`👤 Employee ${index + 1}: ${employeeName} (ID: ${employee.id})`);
                
                employeeRows += `
                    <tr class="border-b border-gray-200 hover:bg-gray-50">
                        <td class="dienstplan-employee-header px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300 min-w-[200px]">
                            ${employeeName}
                        </td>
                        ${this.generateEmployeeDayCells(employeeData, startDate, endDate, data)}
                    </tr>
                `;
            });
        }
        
        // Batch DOM updates to prevent FOUC
        requestAnimationFrame(() => {
            // Update all content in one frame
            if (headerContainer) {
                headerContainer.innerHTML = dayHeaders;
            }
            tbody.innerHTML = employeeRows;
            
            // Show view after all content is rendered with styles
            document.querySelectorAll('.schedule-view').forEach(view => view.classList.add('hidden'));
            container.classList.remove('hidden');
            
            console.log('✅ Dienstplan matrix rendered with optimized styling');
        });
    }
    
    async loadEinsatzplanData(startDate, endDate) {
        console.log('📊 Loading Einsatzplan data...');
        
        try {
            // Use the einsatzplan-range API endpoint directly
            const response = await fetch(`/api/schedule/einsatzplan-range?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`);
            
            if (response.ok) {
                const data = await response.json();
                await this.renderEinsatzplanMatrix(data, startDate, endDate);
            } else {
                console.warn('Einsatzplan-range API not available, falling back to shifts view');
                await this.generateEinsatzplanFromShifts(startDate, endDate);
            }
        } catch (error) {
            console.error('❌ Einsatzplan loading failed:', error);
            await this.generateEinsatzplanFromShifts(startDate, endDate);
        }
    }
    
    async generateEinsatzplanFromShifts(startDate, endDate) {
        // Generate a basic shifts view using the available shifts data
        console.log('📊 Generating basic Einsatzplan view...');
        
        // Create a basic structure with available shifts  
        let combinedData = { 
            shifts: this.shifts.map(shift => ({
                ...shift,
                assignments: [] // Empty assignments for now
            }))
        };
        
        await this.renderEinsatzplanMatrix(combinedData, startDate, endDate);
    }
    
    async renderEinsatzplanMatrix(data, startDate, endDate) {
        const container = document.getElementById('einsatzplan-view');
        const headerContainer = document.getElementById('einsatzplan-day-headers');
        const tbody = document.getElementById('einsatzplan-tbody');
        
        if (!container || !tbody) {
            console.error('❌ Required DOM elements not found for Einsatzplan view');
            return;
        }
        
        // Keep view hidden during rendering to prevent FOUC (Flash of Unstyled Content)
        container.classList.add('hidden');
        
        // Generate day headers
        const dayHeaders = this.generateDayHeaders(startDate, endDate);
        
        // Generate shift type rows
        let shiftRows = '';
        const shifts = data.shifts || this.shifts.slice(0, 15); // Fallback to first 15 shifts
        
        console.log('📊 Rendering Einsatzplan with shifts:', shifts.length);
        
        if (shifts.length === 0) {
            shiftRows = `
                <tr>
                    <td colspan="${this.visibleDaysCount + 1}" class="px-4 py-8 text-center text-gray-500">
                        Keine Schichtdaten verfügbar
                    </td>
                </tr>
            `;
        } else {
            for (let index = 0; index < shifts.length; index++) {
                const shift = shifts[index];
                const shiftName = shift.name || shift.description || `Schicht ${shift.id}`;
                const shiftTime = shift.start_time && shift.end_time ? `${shift.start_time} - ${shift.end_time}` : '';
                
                console.log(`📋 Shift ${index + 1}: ${shiftName}, assignments:`, shift.assignments?.length || 0);
                
                const dayCells = await this.generateShiftDayCells(shift, startDate, endDate, data);
                
                shiftRows += `
                    <tr class="border-b border-gray-200 hover:bg-blue-50">
                        <td class="einsatzplan-shift-header px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300 min-w-[200px]">
                            <div class="font-semibold">${shiftName}</div>
                            <div class="text-xs text-gray-600">${shiftTime}</div>
                        </td>
                        ${dayCells}
                    </tr>
                `;
            }
        }
        
        // Batch DOM updates to prevent FOUC
        requestAnimationFrame(() => {
            // Update all content in one frame
            if (headerContainer) {
                headerContainer.innerHTML = dayHeaders;
            }
            tbody.innerHTML = shiftRows;
            
            // Show view after all content is rendered with styles
            document.querySelectorAll('.schedule-view').forEach(view => view.classList.add('hidden'));
            container.classList.remove('hidden');
            
            console.log('✅ Einsatzplan matrix rendered with optimized styling');
        });
    }
    
    generateDayHeaders(startDate, endDate) {
        let headers = '';
        const currentDate = new Date(startDate);
        const today = new Date();
        let dayCount = 0;
        
        while (currentDate <= endDate && dayCount < this.visibleDaysCount) {
            const isToday = currentDate.toDateString() === today.toDateString();
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
            const dayName = currentDate.toLocaleDateString('de-DE', { weekday: 'short' });
            const dayNumber = currentDate.getDate();
            const monthName = currentDate.toLocaleDateString('de-DE', { month: 'short' });
            
            const headerClass = `day-header px-2 py-2 text-center border-r border-gray-200 min-w-[50px] ${isToday ? 'bg-blue-100 text-blue-900 today' : ''} ${isWeekend ? 'bg-gray-100' : ''}`;
            
            headers += `
                <th class="${headerClass}">
                    <div class="text-xs text-gray-600">${dayName}</div>
                    <div class="font-bold text-sm">${dayNumber}</div>
                    <div class="text-xs text-gray-500">${monthName}</div>
                </th>
            `;
            
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
        
        console.log(`📅 Generated ${dayCount} day headers`);
        return headers;
    }
    
    generateEmployeeDayCells(employee, startDate, endDate, data) {
        let cells = '';
        const currentDate = new Date(startDate);
        let dayCount = 0;
        
        while (currentDate <= endDate && dayCount < this.visibleDaysCount) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const day = currentDate.getDate().toString();
            
            const hasShift = this.employeeHasShiftOnDate(employee, dateKey, data);
            const shiftInfo = hasShift ? this.getEmployeeShiftInfo(employee, dateKey, data) : '';
            const colorData = hasShift ? this.getEmployeeShiftColors(employee, dateKey, data) : null;
            
            // Use DBF colors from API or fallback to default
            let cellStyle = '';
            let cellClass = 'bg-gray-50 text-gray-400';
            
            if (hasShift && colorData) {
                const bgColor = this.convertColorToHex(colorData.background);
                const textColor = this.convertColorToHex(colorData.text);
                cellStyle = `background-color: ${bgColor}; color: ${textColor};`;
                cellClass = 'has-shift border-l-2';
            }
            
            const displayText = shiftInfo || '-';
            
            cells += `
                <td class="employee-cell px-2 py-2 text-xs text-center border-r border-gray-100 ${cellClass}" 
                    style="${cellStyle}" title="${shiftInfo}">
                    ${displayText}
                </td>
            `;
            
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
        
        return cells;
    }
    
    async generateShiftDayCells(shift, startDate, endDate, data) {
        let cells = '';
        const currentDate = new Date(startDate);
        let dayCount = 0;
        
        while (currentDate <= endDate && dayCount < this.visibleDaysCount) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const employeeAssignments = await this.getEmployeeAssignmentsForShiftOnDate(shift, dateKey);
            const employeeNames = employeeAssignments.map(emp => emp.name).join('\n');
            
            let cellClass = 'bg-gray-50 text-gray-400';
            let cellStyle = '';
            
            if (employeeAssignments.length > 0) {
                // Use the first employee's color for the cell
                const firstEmployee = employeeAssignments[0];
                if (firstEmployee.colors) {
                    const textColor = this.convertColorToHex(firstEmployee.colors.text);
                    const bgColor = this.convertColorToHex(firstEmployee.colors.background);
                    cellStyle = `background-color: ${bgColor}; color: ${textColor};`;
                    cellClass = 'has-assignment font-medium';
                } else {
                    cellClass = 'has-assignment bg-blue-50 text-blue-900 font-medium';
                }
            }
            
            const displayText = employeeAssignments.length > 0 
                ? (employeeAssignments.length <= 2 
                    ? employeeAssignments.map(emp => emp.name).join(', ') 
                    : `${employeeAssignments.slice(0, 2).map(emp => emp.name).join(', ')}...`)
                : '-';
            
            cells += `
                <td class="shift-cell px-2 py-2 text-xs text-center border-r border-gray-100 ${cellClass}" 
                    style="${cellStyle}" title="${employeeNames}">
                    ${displayText}
                </td>
            `;
            
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
        }
        
        return cells;
    }
    
    employeeHasShiftOnDate(employeeData, dateKey, data) {
        // Extract day from dateKey (e.g., "2025-07-31" -> "31")
        const day = new Date(dateKey).getDate().toString();
        
        // Check if employee has schedule for this day
        if (employeeData.schedule && employeeData.schedule[day]) {
            const dayData = employeeData.schedule[day];
            return dayData.shift_name || dayData.shift_code || dayData.description;
        }
        return false;
    }
    
    getEmployeeShiftInfo(employeeData, dateKey, data) {
        // Extract day from dateKey (e.g., "2025-07-31" -> "31")
        const day = new Date(dateKey).getDate().toString();
        
        // Get shift info for this day
        if (employeeData.schedule && employeeData.schedule[day]) {
            const dayData = employeeData.schedule[day];
            
            // Prefer shift_code as it's more concise for table display
            if (dayData.shift_code) {
                // Extract just the main part (e.g., "G 5:20-14:34" from "G 5:20-14:34")
                const match = dayData.shift_code.match(/^([A-Z]+)\s+(.+)$/);
                if (match) {
                    return match[1]; // Return just the letter part (e.g., "G")
                }
                return dayData.shift_code;
            }
            
            return dayData.shift_name || dayData.description || 'S';
        }
        return '';
    }
    
    getEmployeeShiftColors(employeeData, dateKey, data) {
        // Extract day from dateKey (e.g., "2025-07-31" -> "31")
        const day = new Date(dateKey).getDate().toString();
        
        // Get color info for this day
        if (employeeData.schedule && employeeData.schedule[day]) {
            const dayData = employeeData.schedule[day];
            if (dayData.colors) {
                return dayData.colors;
            } else {
                // Check if there are colors at employee level
                if (employeeData.employee && employeeData.employee.colors) {
                    return employeeData.employee.colors;
                }
            }
        }
        return null;
    }
    
    convertColorToHex(colorValue) {
        // Convert DBF color value (RGB packed integer) to hex color
        if (!colorValue && colorValue !== 0) return '#f3f4f6'; // Default gray
        
        // Handle the color conversion from DBF format
        // DBF colors are often stored as BGR (Blue-Green-Red) packed integers
        const blue = (colorValue >> 16) & 0xFF;
        const green = (colorValue >> 8) & 0xFF;
        const red = colorValue & 0xFF;
        
        return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
    }
    
    getEmployeesForShiftOnDate(shift, dateKey) {
        // Get employees assigned to this shift on this date
        if (shift.assignments && Array.isArray(shift.assignments)) {
            return shift.assignments
                .filter(a => a.date === dateKey)
                .map(a => {
                    // Prefer real employee name from our map, fallback to API name
                    const realName = this.getEmployeeName(a.employee_id);
                    if (realName && !realName.startsWith('Mitarbeiter ')) {
                        return realName;
                    }
                    // Fallback to employee_name from API or constructed name
                    return a.employee_name || `Mitarbeiter ${a.employee_id}`;
                });
        }
        
        return [];
    }
    
    async getEmployeeAssignmentsForShiftOnDate(shift, dateKey) {
        // Get employees with their color information for this shift on this date
        if (shift.assignments && Array.isArray(shift.assignments)) {
            const assignments = shift.assignments.filter(a => a.date === dateKey);
            const employeeDetails = [];
            
            for (const assignment of assignments) {
                const employeeId = assignment.employee_id;
                
                // Get employee name
                const realName = this.getEmployeeName(employeeId);
                const name = (realName && !realName.startsWith('Mitarbeiter ')) 
                    ? realName 
                    : assignment.employee_name || `Mitarbeiter ${employeeId}`;
                
                // Get employee colors from our cache or fetch them
                let colors = null;
                if (this.employeeColors && this.employeeColors.has(employeeId)) {
                    colors = this.employeeColors.get(employeeId);
                } else {
                    // Fetch employee colors if not cached
                    colors = await this.fetchEmployeeColors(employeeId);
                }
                
                employeeDetails.push({
                    id: employeeId,
                    name: name,
                    colors: colors
                });
            }
            
            return employeeDetails;
        }
        
        return [];
    }
    
    async fetchEmployeeColors(employeeId) {
        // Initialize employee colors cache if not exists
        if (!this.employeeColors) {
            this.employeeColors = new Map();
        }
        
        try {
            const response = await fetch(`/api/employees/${employeeId}`);
            if (response.ok) {
                const employee = await response.json();
                const colors = {
                    text: employee.cfglabel || 0,
                    background: employee.cbklabel || 16777215
                };
                this.employeeColors.set(employeeId, colors);
                return colors;
            }
        } catch (error) {
            console.warn(`Failed to fetch colors for employee ${employeeId}:`, error);
        }
        
        return null;
    }
    
    async loadJahresuebersichtData() {
        // Enhanced Jahresübersicht with improved cell sizing
        console.log('📊 Loading Jahresübersicht data...');
        
        try {
            const year = this.currentDate.getFullYear();
            const response = await fetch(`/api/statistics/yearly-overview?year=${year}`);
            
            if (response.ok) {
                const data = await response.json();
                this.renderJahresuebersichtData(data);
            } else {
                // Fallback: show basic year view
                this.renderJahresuebersichtData({
                    year: year,
                    total_employees: this.employees.length,
                    total_shifts: this.shifts.length,
                    months: []
                });
            }
        } catch (error) {
            console.error('❌ Jahresübersicht loading failed:', error);
            this.renderJahresuebersichtData({
                year: this.currentDate.getFullYear(),
                total_employees: 0,
                total_shifts: 0,
                months: []
            });
        }
    }
    
    renderJahresuebersichtData(data) {
        const container = document.getElementById('jahresuebersicht-view');
        
        if (!container) {
            console.error('❌ Required DOM elements not found for Jahresübersicht view');
            return;
        }
        
        // Show the jahresübersicht view and hide others
        document.querySelectorAll('.schedule-view').forEach(view => view.classList.add('hidden'));
        container.classList.remove('hidden');
        
        // Initialize employee selector and proper matrix display
        this.initializeEmployeeSelector();
        
        console.log('✅ Jahresübersicht view displayed with employee selector');
    }
    
    jumpToMonth(year, month) {
        // Jump to a specific month
        this.currentDate = new Date(year, month - 1, 1);
        this.switchToView('dienstplan');
        console.log(`📅 Jumped to ${month}/${year}`);
    }
    
    async initializeEmployeeSelector() {
        const selector = document.getElementById('employee-selector');
        if (!selector) return;
        
        // Clear existing options
        selector.innerHTML = '<option value="">Mitarbeiter wählen...</option>';
        
        // Load employees if not already loaded
        if (this.employees.length === 0) {
            await this.loadBaseData();
        }
        
        // Populate selector
        this.employees.forEach(emp => {
            const name = emp.firstname && emp.name ? `${emp.firstname} ${emp.name}` : `Mitarbeiter ${emp.id}`;
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = name;
            selector.appendChild(option);
        });
        
        // Add change listener
        selector.addEventListener('change', (e) => {
            if (e.target.value) {
                this.renderEmployeeYearMatrix(parseInt(e.target.value));
            } else {
                document.getElementById('jahresuebersicht-content').innerHTML = 'Wählen Sie einen Mitarbeiter aus';
            }
        });
    }
    
    async renderEmployeeYearMatrix(employeeId) {
        const content = document.getElementById('jahresuebersicht-content');
        if (!content) return;
        
        const year = this.currentDate.getFullYear();
        const employee = this.employees.find(e => e.id === employeeId);
        const employeeName = employee ? `${employee.firstname} ${employee.name}` : `Mitarbeiter ${employeeId}`;
        
        try {
            // Load employee schedule for the year using dienstplan API for each month
            let scheduleData = {};
            
            // Load all 12 months of data
            for (let month = 1; month <= 12; month++) {
                try {
                    const response = await fetch(`/api/schedule/dienstplan?year=${year}&month=${month}`);
                    if (response.ok) {
                        const monthData = await response.json();
                        const employeeData = monthData.employees.find(emp => emp.employee.id === employeeId);
                        if (employeeData && employeeData.schedule) {
                            // Convert day numbers to full date keys for the matrix
                            Object.entries(employeeData.schedule).forEach(([day, shiftData]) => {
                                const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.padStart(2, '0')}`;
                                scheduleData[dateKey] = shiftData;
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to load month ${month}:`, error);
                }
            }
            
            // Render the matrix with toggle button
            this.renderYearMatrix(content, year, employeeName, scheduleData);
            
        } catch (error) {
            console.error('❌ Failed to load employee year data:', error);
            content.innerHTML = `<div class="p-4 text-red-600">Fehler beim Laden der Jahresübersicht</div>`;
        }
    }
    
    renderYearMatrix(content, year, employeeName, scheduleData) {
        if (!this.yearViewLayout) {
            this.yearViewLayout = 'days-horizontal'; // Standard: Tage horizontal, Monate vertikal
        }
        
        const isDaysHorizontal = this.yearViewLayout === 'days-horizontal';
        const toggleText = isDaysHorizontal ? 'Monate als Spalten' : 'Tage als Spalten';
        
        let matrixHTML = `
            <div class="p-4">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">Jahresübersicht ${year} - ${employeeName}</h3>
                    <button id="year-layout-toggle" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                        ${toggleText}
                    </button>
                </div>
                <div class="overflow-auto max-h-[600px]">
                    <table class="table-fixed border-collapse">
        `;
        
        if (isDaysHorizontal) {
            // Layout 1: Tage horizontal (1-31), Monate vertikal
            matrixHTML += this.renderDaysHorizontalMatrix(year, scheduleData);
        } else {
            // Layout 2: Monate horizontal, Tage vertikal (1-31)
            matrixHTML += this.renderMonthsHorizontalMatrix(year, scheduleData);
        }
        
        matrixHTML += '</table></div></div>';
        content.innerHTML = matrixHTML;
        
        // Add event listener for toggle button
        const toggleButton = document.getElementById('year-layout-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleYearLayout();
            });
        }
    }
    
    renderDaysHorizontalMatrix(year, scheduleData) {
        const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        
        // Sammle alle Zellinhalte und finde die maximale Breite
        let maxCellWidth = 60; // Minimum width
        const monthData = {};
        
        // Pre-process all data to find maximum cell content width
        months.forEach((monthName, monthIndex) => {
            monthData[monthIndex] = {};
            const month = monthIndex + 1;
            const daysInMonth = new Date(year, month, 0).getDate();
            
            for (let day = 1; day <= 31; day++) {
                if (day <= daysInMonth) {
                    const dayData = scheduleData[month] && scheduleData[month][day] ? scheduleData[month][day] : null;
                    if (dayData) {
                        const shiftCode = dayData.shift_code || dayData.shift_name || 'S';
                        // Calculate width more accurately: base width + character width + padding
                        const cellWidth = Math.max(50, Math.min(shiftCode.toString().length * 9 + 20, 120)); 
                        maxCellWidth = Math.max(maxCellWidth, cellWidth);
                        monthData[monthIndex][day] = { data: dayData, width: cellWidth };
                    }
                }
            }
        });
        
        // Use the calculated maximum width for all cells
        const cellWidth = Math.min(maxCellWidth, 120); // Cap at 120px
        console.log(`📊 Calculated optimal cell width: ${cellWidth}px (max content was ${maxCellWidth}px)`);
        
        // Header mit Tagen 1-31  
        let html = '<thead><tr><th class="border border-gray-300 p-2 bg-gray-100" style="width: 120px; min-width: 120px;">MONAT</th>';
        for (let day = 1; day <= 31; day++) {
            html += `<th class="border border-gray-300 p-1 bg-gray-100 text-xs" style="width: ${cellWidth}px; min-width: ${cellWidth}px; max-width: ${cellWidth}px;">${day}</th>`;
        }
        html += '</tr></thead><tbody>';
        
        // Monate als Zeilen
        months.forEach((monthName, monthIndex) => {
            const month = monthIndex + 1;
            const monthDays = new Date(year, month, 0).getDate(); // Tage im Monat
            
            html += `<tr><td class="border border-gray-300 p-2 bg-gray-50 font-bold text-sm">${monthName}<br><span class="text-xs text-gray-600">${monthDays} Tage</span></td>`;
            
            for (let day = 1; day <= 31; day++) {
                const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const dayData = scheduleData[dateKey];
                const shiftCode = dayData?.shift_code || '';
                
                // Prüfen ob dieser Tag im Monat existiert
                const dayExists = day <= monthDays;
                
                let cellStyle = '';
                let cellClass = 'border border-gray-300 p-1 text-xs text-center';
                
                if (!dayExists) {
                    cellClass += ' bg-gray-200';
                } else if (dayData && dayData.colors) {
                    const bgColor = this.convertColorToHex(dayData.colors.background);
                    const textColor = this.convertColorToHex(dayData.colors.text);
                    cellStyle = `background-color: ${bgColor}; color: ${textColor};`;
                    cellClass += ' font-semibold';
                }
                
                html += `<td class="${cellClass}" style="width: ${cellWidth}px; min-width: ${cellWidth}px; max-width: ${cellWidth}px; ${cellStyle}" title="${dayExists ? shiftCode : ''}">${dayExists ? shiftCode : ''}</td>`;
            }
            html += '</tr>';
        });
        
        return html + '</tbody>';
    }
    
    renderMonthsHorizontalMatrix(year, scheduleData) {
        const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        
        // Header mit Monaten
        let html = '<thead><tr><th class="border border-gray-300 p-2 bg-gray-100 w-16">Tag</th>';
        months.forEach(month => {
            html += `<th class="border border-gray-300 p-2 bg-gray-100 w-20">${month}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Tage als Zeilen (1-31)
        for (let day = 1; day <= 31; day++) {
            html += `<tr><td class="border border-gray-300 p-2 text-center font-bold bg-gray-50">${day}</td>`;
            
            for (let month = 1; month <= 12; month++) {
                const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const dayData = scheduleData[dateKey];
                const shiftCode = dayData?.shift_code || '';
                
                // Prüfen ob dieser Tag im Monat existiert
                const monthDays = new Date(year, month, 0).getDate();
                const dayExists = day <= monthDays;
                
                let cellStyle = '';
                let cellClass = 'border border-gray-300 p-1 text-xs text-center';
                
                if (!dayExists) {
                    cellClass += ' bg-gray-200';
                } else if (dayData && dayData.colors) {
                    const bgColor = this.convertColorToHex(dayData.colors.background);
                    const textColor = this.convertColorToHex(dayData.colors.text);
                    cellStyle = `background-color: ${bgColor}; color: ${textColor};`;
                    cellClass += ' font-semibold';
                }
                
                html += `<td class="${cellClass}" style="width: ${cellWidth}px; min-width: ${cellWidth}px; max-width: ${cellWidth}px; ${cellStyle}" title="${dayExists ? shiftCode : ''}">${dayExists ? shiftCode : ''}</td>`;
            }
            html += '</tr>';
        }
        
        return html + '</tbody>';
    }
    
    toggleYearLayout() {
        this.yearViewLayout = this.yearViewLayout === 'days-horizontal' ? 'months-horizontal' : 'days-horizontal';
        
        // Aktuellen Mitarbeiter neu rendern
        const selector = document.getElementById('employee-selector');
        if (selector && selector.value) {
            this.renderEmployeeYearMatrix(parseInt(selector.value));
        }
    }
}

// Note: MatrixScheduleManager is initialized in the main HTML file