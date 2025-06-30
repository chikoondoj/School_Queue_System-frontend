// Main JavaScript for School Queue System
class QueueSystem {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFormValidation();
        this.setupRealTimeUpdates();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.setActiveNav(link);
            });
        });

        // Form submissions
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                this.handleFormSubmit(e);
            });
        });

        // Queue actions
        document.querySelectorAll('.join-queue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.joinQueue(e.target.dataset.service);
            });
        });

        // Admin actions
        document.querySelectorAll('.next-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.nextStudent(e.target.dataset.service);
            });
        });

        // Real-time updates toggle
        const autoRefreshToggle = document.getElementById('autoRefresh');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.toggleAutoRefresh(e.target.checked);
            });
        }
    }

    setActiveNav(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input[required], select[required]');
            inputs.forEach(input => {
                input.addEventListener('blur', () => {
                    this.validateField(input);
                });
            });
        });
    }

    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';

        // Remove existing error styling
        field.classList.remove('error');
        const existingError = field.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            message = 'This field is required';
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                message = 'Please enter a valid email address';
            }
        }

        // Student code validation (assuming format: STU-YYYY-NNNN)
        if (field.name === 'studentCode' && value) {
            const codeRegex = /^STU-\d{4}-\d{4}$/;
            if (!codeRegex.test(value)) {
                isValid = false;
                message = 'Student code format: STU-YYYY-NNNN';
            }
        }

        // Password validation
        if (field.type === 'password' && value) {
            if (value.length < 6) {
                isValid = false;
                message = 'Password must be at least 6 characters long';
            }
        }

        if (!isValid) {
            field.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            errorDiv.style.color = '#e74c3c';
            errorDiv.style.fontSize = '0.8rem';
            errorDiv.style.marginTop = '0.25rem';
            field.parentNode.appendChild(errorDiv);
        }

        return isValid;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Validate all fields
        const inputs = form.querySelectorAll('input[required], select[required]');
        let isFormValid = true;
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isFormValid = false;
            }
        });

        if (!isFormValid) {
            this.showAlert('Please fix the errors in the form', 'danger');
            return;
        }

        // Show loading
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(form.action, {
                method: form.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert(result.message || 'Success!', 'success');
                if (result.redirect) {
                    setTimeout(() => {
                        window.location.href = result.redirect;
                    }, 1500);
                }
            } else {
                this.showAlert(result.message || 'An error occurred', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            this.showAlert('Network error. Please try again.', 'danger');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    

    async joinQueue(service) {
        const studentData = this.getStudentData();
        if (!studentData) {
            this.showAlert('Please log in first', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/queue/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    studentId: studentData.id,
                    service: service
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert('Successfully joined the queue!', 'success');
                this.displayTicket(result.ticket);
                this.updateQueueDisplay();
            } else {
                this.showAlert(result.message || 'Failed to join queue', 'danger');
            }
        } catch (error) {
            console.error('Error joining queue:', error);
            this.showAlert('Network error. Please try again.', 'danger');
        }
    }

    async nextStudent(service) {
        try {
            const response = await fetch('/api/admin/next-student', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ service })
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert('Next student called!', 'success');
                this.updateQueueDisplay();
            } else {
                this.showAlert(result.message || 'Failed to call next student', 'danger');
            }
        } catch (error) {
            console.error('Error calling next student:', error);
            this.showAlert('Network error. Please try again.', 'danger');
        }
    }

    displayTicket(ticket) {
        const ticketContainer = document.getElementById('ticketContainer');
        if (!ticketContainer) return;

        const now = new Date();
        const ticketHTML = `
            <div class="ticket fade-in">
                <div class="ticket-header">
                    <h3>Queue Ticket</h3>
                    <div class="ticket-number">#${ticket.position}</div>
                </div>
                <div class="ticket-info">
                    <p><strong>Service:</strong> ${ticket.service}</p>
                    <p><strong>Student:</strong> ${ticket.studentName}</p>
                    <p><strong>Date:</strong> ${now.toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${now.toLocaleTimeString()}</p>
                    <p><strong>Status:</strong> <span class="queue-status status-waiting">Waiting</span></p>
                </div>
                <div class="ticket-footer">
                    <p><small>Please keep this ticket for reference</small></p>
                </div>
            </div>
        `;

        ticketContainer.innerHTML = ticketHTML;
    }

    async updateQueueDisplay() {
        const queueContainer = document.getElementById('queueDisplay');
        if (!queueContainer) return;

        try {
            const response = await fetch('/api/queue/status');
            const queues = await response.json();

            let html = '';
            Object.keys(queues).forEach(service => {
                const queue = queues[service];
                html += `
                    <div class="queue-service">
                        <h4>${service}</h4>
                        <div class="queue-stats">
                            <span class="stat">Total: ${queue.total}</span>
                            <span class="stat">Current: ${queue.current || 'None'}</span>
                            <span class="stat">Waiting: ${queue.waiting}</span>
                        </div>
                        <div class="queue-list">
                            ${queue.students.map((student, index) => `
                                <div class="queue-item ${student.status === 'active' ? 'active' : ''}">
                                    <div class="queue-position">${index + 1}</div>
                                    <div class="queue-info">
                                        <h4>${student.name}</h4>
                                        <p>Code: ${student.code} | Time: ${new Date(student.joinTime).toLocaleTimeString()}</p>
                                    </div>
                                    <div class="queue-status status-${student.status}">${student.status}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });

            queueContainer.innerHTML = html;
        } catch (error) {
            console.error('Error updating queue display:', error);
        }
    }

    setupRealTimeUpdates() {
        // Update queue display every 30 seconds
        setInterval(() => {
            this.updateQueueDisplay();
        }, 30000);

        // Update dashboard stats every 60 seconds
        setInterval(() => {
            this.updateDashboardStats();
        }, 60000);
    }

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.autoRefreshInterval = setInterval(() => {
                this.updateQueueDisplay();
                this.updateDashboardStats();
            }, 5000); // Update every 5 seconds when enabled
        } else {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
            }
        }
    }

    async updateDashboardStats() {
        const statsContainer = document.getElementById('dashboardStats');
        if (!statsContainer) return;

        try {
            const response = await fetch('/api/admin/stats');
            const stats = await response.json();

            const statsHTML = `
                <div class="stat-card">
                    <i class="fas fa-users" style="color: #667eea;"></i>
                    <h3>${stats.totalStudents}</h3>
                    <p>Total Students</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-clock" style="color: #f093fb;"></i>
                    <h3>${stats.waiting}</h3>
                    <p>Currently Waiting</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-check-circle" style="color: #4facfe;"></i>
                    <h3>${stats.served}</h3>
                    <p>Served Today</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-chart-line" style="color: #fa709a;"></i>
                    <h3>${stats.avgWaitTime}min</h3>
                    <p>Avg Wait Time</p>
                </div>
            `;

            statsContainer.innerHTML = statsHTML;
        } catch (error) {
            console.error('Error updating dashboard stats:', error);
        }
    }

    getStudentData() {
        // Get student data from session storage or localStorage
        const studentData = sessionStorage.getItem('studentData');
        return studentData ? JSON.parse(studentData) : null;
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fade-in`;
        alert.innerHTML = `
            <span>${message}</span>
            <button type="button" class="close-alert" style="float: right; background: none; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
        `;

        // Insert at top of main content
        const mainContent = document.querySelector('.main-content') || document.body;
        mainContent.insertBefore(alert, mainContent.firstChild);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);

        // Manual close button
        alert.querySelector('.close-alert').addEventListener('click', () => {
            alert.remove();
        });
    }

    // Utility functions
    formatTime(date) {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Print ticket function
    printTicket(ticketData) {
        const printWindow = window.open('', '_blank');
        const ticketHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Queue Ticket</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .ticket { border: 2px dashed #333; padding: 20px; max-width: 300px; }
                    .ticket-header { text-align: center; border-bottom: 1px solid #333; padding-bottom: 10px; }
                    .ticket-number { font-size: 2rem; font-weight: bold; }
                    .ticket-info { margin: 15px 0; }
                    .ticket-info p { margin: 5px 0; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="ticket-header">
                        <h3>School Queue System</h3>
                        <div class="ticket-number">#${ticketData.position}</div>
                    </div>
                    <div class="ticket-info">
                        <p><strong>Service:</strong> ${ticketData.service}</p>
                        <p><strong>Student:</strong> ${ticketData.studentName}</p>
                        <p><strong>Code:</strong> ${ticketData.studentCode}</p>
                        <p><strong>Date:</strong> ${this.formatDate(new Date())}</p>
                        <p><strong>Time:</strong> ${this.formatTime(new Date())}</p>
                    </div>
                    <div style="text-align: center; margin-top: 15px;">
                        <small>Please keep this ticket for reference</small>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(ticketHTML);
        printWindow.document.close();
        printWindow.print();
    }
}

// Initialize the queue system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new QueueSystem();
});

// Additional utility functions
function showLoading(element) {
    const loading = document.createElement('div');
    loading.className = 'loading-spinner';
    loading.id = 'loadingSpinner';
    element.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('loadingSpinner');
    if (loading) {
        loading.remove();
    }
}

// Service Worker registration for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Export for use in other files
window.QueueSystem = QueueSystem;