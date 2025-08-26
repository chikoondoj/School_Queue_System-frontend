const BASE_URL = 'https://school-queue-system-backend.onrender.com';
let socket;
let studentData = null;
let currentTicket = null;
let queueData = {
  services: [],
  totalActiveTickets: 0,
  lastUpdated: null,
};

document.addEventListener("DOMContentLoaded", function () {
  console.log("=== ENHANCED DASHBOARD LOADING ===");
  console.log("Current URL:", window.location.href);

  // Initialize socket connection
  initializeSocket();

  // Load dashboard - authentication is handled by server sessions
  loadDashboard();

  // Set up intervals for real-time updates
  updateCurrentTime();
  setInterval(updateCurrentTime, 60000);
  setInterval(refreshQueueData, 10000); // More frequent queue updates
  setInterval(checkQueuePosition, 15000); // Check position updates
});

// Initialize socket connection with enhanced queue listeners
function initializeSocket() {
  try {
    if (typeof io !== "undefined") {
      socket = io(BASE_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"] // Optional but good for Render
      });
      setupEnhancedSocketListeners();
      console.log("Socket.io initialized with queue tracking");
    } else {
      console.warn("Socket.io not available, creating mock");
      createMockSocket();
    }
  } catch (error) {
    console.warn("Socket connection failed:", error);
    createMockSocket();
  }
}


function setupEnhancedSocketListeners() {
  socket.on("connect", () => {
    console.log("Socket connected - joining queue room");
    socket.emit("joinQueueRoom"); // Join room for queue updates
  });

  socket.on("disconnect", () => console.log("Socket disconnected"));

  // Real-time queue updates for all students
  socket.on("queueUpdate", (data) => {
    console.log("Queue update received:", data);
    updateQueueStatsRealTime(data);
    updateQueueHistory(data);
  });

  // Individual ticket updates
  socket.on("ticketUpdate", (data) => {
    if (currentTicket && data.ticketId === currentTicket.id) {
      updateCurrentTicket(data);
    }
  });

  // Ticket called notifications
  socket.on("ticketCalled", (data) => {
    if (currentTicket && data.ticketId === currentTicket.id) {
      showAlert(
        "success",
        "Your ticket has been called! Please proceed to the service desk."
      );
      playNotificationSound();
    }
  });

  // Someone joined queue notification
  socket.on("studentJoinedQueue", (data) => {
    showQueueActivity(`A student joined ${data.serviceType} queue`, "info");
    refreshQueueStats();
  });

  // Someone left queue notification
  socket.on("studentLeftQueue", (data) => {
    showQueueActivity(`A student left ${data.serviceType} queue`, "warning");
    refreshQueueStats();
  });

  // Service status updates
  socket.on("serviceStatusUpdate", (data) => {
    updateServiceStatus(data);
  });
}

// Enhanced queue data management
async function loadDashboard() {
  try {
    // First, get student profile - this also validates session
    await loadStudentProfile();

    // Load comprehensive dashboard data
    await loadDashboardData();

    // Load queue history and statistics
    await loadQueueHistory();

    console.log("✅ Enhanced dashboard loaded successfully");
  } catch (error) {
    console.error("💥 Dashboard loading failed:", error);

    if (tryLoadCachedData()) {
      showAlert("warning", "Using offline data - some features limited");
    } else {
      showAlert("danger", "Please login again");
      setTimeout(() => (window.location.href = "./studentLogin.html"), 2000);
    }
  }
}

// Load student profile from server (validates session)
async function loadStudentProfile() {
  console.log("📡 Loading student profile...");

  const response = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status === 401) {
    console.log("🚫 Session expired - redirecting to login");
    window.location.href = "./studentLogin.html";
    throw new Error("Session expired");
  }

  if (!response.ok) {
    throw new Error(`Profile fetch failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.success && result.data && result.data.user) {
    studentData = result.data.user;

    // Cache for offline use (NOT for authentication)
    sessionStorage.setItem("studentData", JSON.stringify(studentData));

    updateStudentInfo();
    console.log("✅ Student profile loaded");
  } else {
    throw new Error("Invalid profile response");
  }
}

// Enhanced dashboard data loading with queue persistence
async function loadDashboardData() {
  console.log("📊 Loading enhanced dashboard data...");

  try {
    // Load services and detailed queue stats
    const servicesResponse = await sessionRequest(
      "/api/queue/services/detailed"
    );
    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      queueData.services = servicesData.services || servicesData;
      queueData.lastUpdated = new Date();
      updateEnhancedServicesDisplay(servicesData);
    }

    // Load current ticket with detailed info
    const ticketResponse = await sessionRequest(
      "/api/queue/my-ticket/detailed"
    );
    if (ticketResponse.ok) {
      const ticketData = await ticketResponse.json();
      if (ticketData && ticketData.ticket) {
        currentTicket = ticketData.ticket;
        displayEnhancedCurrentTicket();
      }
    } else if (ticketResponse.status === 404) {
      hideCurrentTicket();
    }

    // Load queue statistics and history
    await loadQueueStatistics();

    // Load recent activity
    await loadRecentActivity();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showAlert("warning", "Some data could not be loaded");
  }
}

// Load queue history and statistics
async function loadQueueHistory() {
  try {
    const response = await sessionRequest("/api/queue/history");
    if (response.ok) {
      const historyData = await response.json();
      displayQueueTrends(historyData);
    }
  } catch (error) {
    console.log("Queue history not available:", error);
  }
}

// Load detailed queue statistics
async function loadQueueStatistics() {
  try {
    const response = await sessionRequest("/api/queue/statistics/summary");
    if (response.ok) {
      const stats = await response.json();
      displayQueueStatistics(stats);
    }
  } catch (error) {
    console.log("Queue statistics not available:", error);
  }
}

// Enhanced join queue function with better feedback
async function joinQueue(serviceType) {
  try {
    console.log("Joining queue for:", serviceType);

    // Check if already in a queue
    if (currentTicket) {
      showAlert(
        "warning",
        "You are already in a queue. Please leave your current queue first."
      );
      return;
    }

    // Show loading state
    showLoadingState(`Joining ${serviceType} queue...`);

    const response = await sessionRequest("/api/queue/join", {
      method: "POST",
      body: JSON.stringify({
        serviceId: serviceType,
        timestamp: new Date().toISOString(),
        studentInfo: {
          name: studentData.name,
          studentCode: studentData.studentCode,
        },
      }),
    });

    hideLoadingState();

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Join failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.ticket) {
      currentTicket = result.ticket;
      displayEnhancedCurrentTicket();

      // Show success with estimated wait time
      const waitTimeMsg = result.estimatedWaitTime
        ? ` Estimated wait: ${result.estimatedWaitTime} minutes.`
        : "";

      showAlert(
        "success",
        `✅ Joined ${serviceType} queue successfully!<br>
                        📍 Position: ${result.ticket.position}<br>
                        🎫 Ticket: ${result.ticket.ticketNumber}${waitTimeMsg}`
      );

      // Emit socket event for real-time updates
      socket.emit("studentJoinedQueue", {
        serviceType: serviceType,
        ticketNumber: result.ticket.ticketNumber,
        position: result.ticket.position,
      });

      await refreshQueueStats();
    }
  } catch (error) {
    hideLoadingState();
    console.error("Join queue error:", error);
    showAlert("danger", "❌ Failed to join queue: " + error.message);
  }
}

// Enhanced leave queue function
async function leaveQueue() {
  try {
    if (!currentTicket) {
      showAlert("warning", "You are not currently in any queue.");
      return;
    }

    const confirmation = confirm(
      `Are you sure you want to leave the ${currentTicket.serviceType} queue?\n` +
        `Your current position is: ${currentTicket.position}`
    );

    if (!confirmation) return;

    showLoadingState("Leaving queue...");

    const response = await sessionRequest("/api/queue/leave", {
      method: "DELETE",
      body: JSON.stringify({
        ticketId: currentTicket.id,
        serviceType: currentTicket.serviceType,
      }),
    });

    hideLoadingState();

    if (!response.ok) {
      throw new Error(`Leave failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const leftServiceType = currentTicket.serviceType;
      currentTicket = null;
      hideCurrentTicket();

      showAlert("info", `✅ Left ${leftServiceType} queue successfully`);

      // Emit socket event for real-time updates
      socket.emit("studentLeftQueue", {
        serviceType: leftServiceType,
      });

      await refreshQueueStats();
    }
  } catch (error) {
    hideLoadingState();
    console.error("Leave queue error:", error);
    showAlert("danger", "❌ Failed to leave queue: " + error.message);
  }
}

// Real-time queue updates
function updateQueueStatsRealTime(data) {
  console.log("Updating queue stats in real-time:", data);

  if (data.services) {
    queueData.services = data.services;
    queueData.lastUpdated = new Date();
    updateEnhancedServicesDisplay({ services: data.services });
  }

  if (data.totalActiveTickets !== undefined) {
    queueData.totalActiveTickets = data.totalActiveTickets;
    updateTotalQueueCount(data.totalActiveTickets);
  }
}

// Enhanced services display with more details
function updateEnhancedServicesDisplay(servicesData) {
  let services = [];
  if (Array.isArray(servicesData)) {
    services = servicesData;
  } else if (servicesData.services) {
    services = servicesData.services;
  } else if (servicesData.data) {
    services = servicesData.data;
  }

  let counts = {
    admission: { count: 0, avgWait: 0, status: "active" },
    registration: { count: 0, avgWait: 0, status: "active" },
    financial: { count: 0, avgWait: 0, status: "active" },
    counseling: { count: 0, avgWait: 0, status: "active" },
  };

  services.forEach((service) => {
    const serviceType = (
      service.name ||
      service.serviceType ||
      ""
    ).toLowerCase();
    const queueCount =
      service.queueCount || service.currentQueue || service.count || 0;
    const avgWait = service.averageWaitTime || 0;
    const status = service.status || "active";

    switch (serviceType) {
      case "student admission":
        counts.admission = { count: queueCount, avgWait, status };
        break;
      case "student registration":
        counts.registration = { count: queueCount, avgWait, status };
        break;
      case "financial aid":
        counts.financial = { count: queueCount, avgWait, status };
        break;
      case "counseling":
        counts.counseling = { count: queueCount, avgWait, status };
        break;
    }
  });

  // Update individual service cards with enhanced info
  updateServiceCard("admission", counts.admission);
  updateServiceCard("registration", counts.registration);
  updateServiceCard("financial", counts.financial);
  updateServiceCard("counseling", counts.counseling);

  // Update overview section with enhanced display
  const totalInQueue = Object.values(counts).reduce(
    (sum, service) => sum + service.count,
    0
  );
  updateQueueOverview(counts, totalInQueue);
}

// Update individual service card
function updateServiceCard(serviceKey, serviceData) {
  const card = document.getElementById(`${serviceKey}Card`);
  if (!card) return;

  const { count, avgWait, status } = serviceData;
  const statusClass = status === "active" ? "success" : "warning";
  const statusIcon = status === "active" ? "circle" : "pause-circle";

  // Update queue count
  document.getElementById(`${serviceKey}Queue`).textContent = count;

  // Add wait time and status indicators
  const waitTimeElement = card.querySelector(".wait-time");
  if (waitTimeElement) {
    waitTimeElement.textContent =
      avgWait > 0 ? `~${avgWait} min wait` : "No wait";
  }

  const statusElement = card.querySelector(".service-status");
  if (statusElement) {
    statusElement.innerHTML = `
                    <i class="fas fa-${statusIcon} text-${statusClass}"></i>
                    <small class="text-${statusClass}">${
      status.charAt(0).toUpperCase() + status.slice(1)
    }</small>
                `;
  }
}

// Enhanced queue overview
function updateQueueOverview(counts, totalInQueue) {
  document.getElementById("queueOverview").innerHTML = `
                <div class="row">
                    <div class="col-md-2 text-center">
                        <i class="fas fa-users fa-2x text-primary mb-2"></i>
                        <h3 class="text-primary">${totalInQueue}</h3>
                        <small class="text-muted">Total in Queue</small>
                    </div>
                    <div class="col-md-2 text-center">
                        <i class="fas fa-graduation-cap fa-2x text-primary mb-2"></i>
                        <h4>${counts.admission.count}</h4>
                        <small>Admission</small>
                        <div class="mt-1">
                            <small class="text-muted">${
                              counts.admission.avgWait
                            }min avg</small>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
                        <i class="fas fa-user-plus fa-2x text-success mb-2"></i>
                        <h4>${counts.registration.count}</h4>
                        <small>Registration</small>
                        <div class="mt-1">
                            <small class="text-muted">${
                              counts.registration.avgWait
                            }min avg</small>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
                        <i class="fas fa-dollar-sign fa-2x text-warning mb-2"></i>
                        <h4>${counts.financial.count}</h4>
                        <small>Financial Aid</small>
                        <div class="mt-1">
                            <small class="text-muted">${
                              counts.financial.avgWait
                            }min avg</small>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
                        <i class="fas fa-comments fa-2x text-info mb-2"></i>
                        <h4>${counts.counseling.count}</h4>
                        <small>Counseling</small>
                        <div class="mt-1">
                            <small class="text-muted">${
                              counts.counseling.avgWait
                            }min avg</small>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
                        <i class="fas fa-clock fa-2x text-secondary mb-2"></i>
                        <small class="text-muted">Last Updated</small>
                        <div class="mt-1">
                            <small>${
                              queueData.lastUpdated
                                ? queueData.lastUpdated.toLocaleTimeString()
                                : "Never"
                            }</small>
                        </div>
                    </div>
                </div>
            `;
}

// Enhanced current ticket display
function displayEnhancedCurrentTicket() {
  if (currentTicket) {
    document.getElementById("ticketNumber").textContent =
      currentTicket.ticketNumber;
    document.getElementById("currentPosition").textContent =
      currentTicket.position;
    document.getElementById("serviceType").textContent =
      currentTicket.serviceType;

    // Add estimated wait time if available
    if (currentTicket.estimatedWaitTime) {
      document.getElementById(
        "estimatedWait"
      ).textContent = `${currentTicket.estimatedWaitTime} minutes`;
    }

    // Add join time
    if (currentTicket.joinedAt) {
      const joinTime = new Date(currentTicket.joinedAt);
      document.getElementById("joinTime").textContent =
        joinTime.toLocaleTimeString();
    }

    document.getElementById("currentTicketSection").style.display = "block";
  }
}

// Check queue position updates
async function checkQueuePosition() {
  if (!currentTicket) return;

  try {
    const response = await sessionRequest(
      "/api/queue/position/" + currentTicket.id
    );
    if (response.ok) {
      const positionData = await response.json();
      if (positionData.position !== currentTicket.position) {
        const oldPosition = currentTicket.position;
        currentTicket.position = positionData.position;

        if (positionData.position < oldPosition) {
          showAlert(
            "info",
            `📈 Your position improved! Now at position ${positionData.position}`
          );
        }

        displayEnhancedCurrentTicket();
      }
    }
  } catch (error) {
    console.error("Error checking position:", error);
  }
}

// Refresh queue data more frequently
async function refreshQueueData() {
  try {
    const response = await sessionRequest("/api/queue/services/detailed");
    if (response.ok) {
      const data = await response.json();
      updateQueueStatsRealTime(data);
    }
  } catch (error) {
    console.error("Queue refresh failed:", error);
  }
}

// Show queue activity notifications
function showQueueActivity(message, type = "info") {
  const activityContainer = document.getElementById("queueActivity");
  if (activityContainer) {
    const activityItem = document.createElement("div");
    activityItem.className = `alert alert-${type} alert-sm fade show`;
    activityItem.innerHTML = `
                    <small>
                        <i class="fas fa-info-circle me-1"></i>
                        ${message}
                        <span class="float-end">${new Date().toLocaleTimeString()}</span>
                    </small>
                `;

    activityContainer.insertBefore(activityItem, activityContainer.firstChild);

    // Remove after 10 seconds
    setTimeout(() => {
      if (activityItem.parentNode) {
        activityItem.remove();
      }
    }, 10000);

    // Keep only last 5 activities
    while (activityContainer.children.length > 5) {
      activityContainer.removeChild(activityContainer.lastChild);
    }
  }
}

// Play notification sound
function playNotificationSound() {
  try {
    const audio = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjiR1/LNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS2fLNeSsGJHfH8N2QQAoUXrTp66hVFApGn+DyvmkjBjqS"
    );
    audio.play().catch(() => console.log("Could not play notification sound"));
  } catch (error) {
    console.log("Notification sound not available");
  }
}

// Loading state functions
function showLoadingState(message) {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) {
    document.getElementById("loadingMessage").textContent = message;
    loadingOverlay.style.display = "flex";
  }
}

function hideLoadingState() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) {
    loadingOverlay.style.display = "none";
  }
}

// Update total queue count display
function updateTotalQueueCount(total) {
  const totalElement = document.getElementById("totalQueueCount");
  if (totalElement) {
    totalElement.textContent = total;
  }
}

// Display queue trends and statistics
function displayQueueTrends(historyData) {
  // This would create charts showing queue trends over time
  console.log("Queue trends data:", historyData);
}

function displayQueueStatistics(stats) {
  // Display additional statistics like peak hours, average wait times, etc.
  console.log("Queue statistics:", stats);
}

// Session request helper (unchanged)
async function sessionRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    console.log("🚫 Session expired during request");
    window.location.href = "./studentLogin.html";
    throw new Error("Session expired");
  }

  return response;
}

// Additional utility functions...
function updateStudentInfo() {
  if (!studentData) return;

  const { name, studentCode, course, year } = studentData;

  document.getElementById("studentName").textContent = name || "Student";
  document.getElementById("studentCode").textContent = studentCode || "-";
  document.getElementById("studentCourse").textContent = course || "-";
  document.getElementById("studentYear").textContent = year || "-";

  const hour = new Date().getHours();
  let greeting = "Good day";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 17) greeting = "Good afternoon";
  else greeting = "Good evening";

  document.getElementById("welcomeMessage").textContent = `${greeting}, ${
    name || "Student"
  }!`;
}

function updateCurrentTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("currentTime").textContent = timeString;
}

function hideCurrentTicket() {
  document.getElementById("currentTicketSection").style.display = "none";
}

function updateCurrentTicket(data) {
  if (data.position !== undefined) {
    document.getElementById("currentPosition").textContent = data.position;
  }
  if (data.status === "called") {
    showAlert("success", "Your ticket has been called!");
  }
}

async function loadRecentActivity() {
  try {
    const response = await sessionRequest("/api/auth/activity");
    if (response.ok) {
      const activities = await response.json();
      displayRecentActivity(activities);
    }
  } catch (error) {
    console.log("Recent activity failed (non-critical):", error);
  }
}

function displayRecentActivity(activities) {
  const container = document.getElementById("recentActivity");

  if (!activities || activities.length === 0) {
    container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-clock fa-3x mb-3"></i>
                        <p>No recent activity</p>
                    </div>
                `;
    return;
  }

  const activityHTML = activities
    .map(
      (activity) => `
                <div class="d-flex align-items-start mb-3 pb-3 border-bottom">
                    <div class="flex-shrink-0 me-3">
                        <i class="fas fa-circle-dot text-primary"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${activity.action}</h6>
                        <p class="mb-1 text-muted">${activity.description}</p>
                        <small class="text-muted">
                            <i class="fas fa-clock me-1"></i>
                            ${new Date(activity.timestamp).toLocaleString()}
                        </small>
                    </div>
                </div>
            `
    )
    .join("");

  container.innerHTML = activityHTML;
}

async function logout() {
  console.log("🚪 Logging out...");

  try {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.log("Logout request failed:", error);
  }

  sessionStorage.clear();

  if (socket && socket.disconnect) {
    socket.disconnect();
  }

  window.location.href = "./studentLogin.html";
}

function showAlert(type, message, duration = 5000) {
  const alertContainer = document.getElementById("alertContainer");
  const alertId = "alert_" + Date.now();

  const icons = {
    success: "check-circle",
    danger: "exclamation-triangle",
    warning: "exclamation-circle",
    info: "info-circle",
  };

  const alertHTML = `
                <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                    <i class="fas fa-${icons[type] || "info-circle"} me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;

  alertContainer.insertAdjacentHTML("beforeend", alertHTML);

  setTimeout(() => {
    const alertElement = document.getElementById(alertId);
    if (alertElement) {
      alertElement.remove();
    }
  }, duration);
}

function tryLoadCachedData() {
  const cached = sessionStorage.getItem("studentData");
  if (cached) {
    try {
      studentData = JSON.parse(cached);
      updateStudentInfo();
      console.log("🔄 Using cached student data");
      return true;
    } catch (error) {
      console.error("Failed to parse cached data:", error);
      sessionStorage.removeItem("studentData");
    }
  }
  return false;
}

function createMockSocket() {
  socket = {
    on: () => {},
    emit: () => {},
    disconnect: () => {},
  };
}

// Update queue history for analytics
function updateQueueHistory(data) {
  try {
    let queueHistory = JSON.parse(
      sessionStorage.getItem("queueHistory") || "[]"
    );

    // Add current data point
    queueHistory.push({
      timestamp: new Date().toISOString(),
      data: data,
      totalInQueue: queueData.totalActiveTickets,
    });

    // Keep only last 100 entries
    if (queueHistory.length > 100) {
      queueHistory = queueHistory.slice(-100);
    }

    sessionStorage.setItem("queueHistory", JSON.stringify(queueHistory));
  } catch (error) {
    console.error("Error updating queue history:", error);
  }
}

// Update service status
function updateServiceStatus(data) {
  const serviceCard = document.getElementById(`${data.serviceType}Card`);
  if (serviceCard) {
    const statusElement = serviceCard.querySelector(".service-status");
    if (statusElement) {
      const statusClass = data.status === "active" ? "success" : "warning";
      const statusIcon = data.status === "active" ? "circle" : "pause-circle";

      statusElement.innerHTML = `
                        <i class="fas fa-${statusIcon} text-${statusClass}"></i>
                        <small class="text-${statusClass}">${
        data.status.charAt(0).toUpperCase() + data.status.slice(1)
      }</small>
                    `;
    }
  }
}

// Enhanced refresh function with better error handling
async function refreshData() {
  try {
    console.log("🔄 Refreshing dashboard data...");
    await loadDashboardData();

    // Update last refresh time
    const lastRefreshElement = document.getElementById("lastRefresh");
    if (lastRefreshElement) {
      lastRefreshElement.textContent = new Date().toLocaleTimeString();
    }

    showAlert("info", "✅ Data refreshed successfully", 2000);
  } catch (error) {
    console.error("Refresh failed:", error);
    showAlert("warning", "⚠️ Some data could not be refreshed");
  }
}

// Export queue data function for admin use
function exportQueueData() {
  try {
    const queueHistory = JSON.parse(
      sessionStorage.getItem("queueHistory") || "[]"
    );
    const dataStr = JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        studentInfo: {
          name: studentData?.name,
          studentCode: studentData?.studentCode,
        },
        currentQueueData: queueData,
        queueHistory: queueHistory,
      },
      null,
      2
    );

    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `queue-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    showAlert("success", "📁 Queue data exported successfully");
  } catch (error) {
    console.error("Export failed:", error);
    showAlert("danger", "❌ Failed to export queue data");
  }
}

// Initialize queue monitoring
function initializeQueueMonitoring() {
  // Set up periodic queue health checks
  setInterval(async () => {
    try {
      const response = await sessionRequest("/api/queue/health");
      if (response.ok) {
        const healthData = await response.json();
        updateSystemHealth(healthData);
      }
    } catch (error) {
      console.error("Queue health check failed:", error);
    }
  }, 30000); // Check every 30 seconds
}

// Update system health indicators
function updateSystemHealth(healthData) {
  const healthIndicator = document.getElementById("systemHealth");
  if (healthIndicator) {
    const isHealthy = healthData.status === "healthy";
    healthIndicator.className = `badge bg-${isHealthy ? "success" : "warning"}`;
    healthIndicator.textContent = isHealthy ? "System Online" : "System Issues";

    if (!isHealthy && healthData.message) {
      showAlert("warning", `⚠️ System Alert: ${healthData.message}`);
    }
  }
}

// Enhanced error handling
window.addEventListener("error", function (event) {
  console.error("Global error:", event.error);
  showAlert(
    "danger",
    "❌ An unexpected error occurred. Please refresh the page."
  );
});

// Handle offline/online status
window.addEventListener("online", function () {
  showAlert("success", "🌐 Connection restored", 3000);
  refreshData();
});

window.addEventListener("offline", function () {
  showAlert("warning", "📡 Connection lost - using cached data", 5000);
});

// Initialize everything when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize queue monitoring
  initializeQueueMonitoring();

  // Set up keyboard shortcuts
  document.addEventListener("keydown", function (event) {
    // Ctrl/Cmd + R for refresh
    if ((event.ctrlKey || event.metaKey) && event.key === "r") {
      event.preventDefault();
      refreshData();
    }

    // Escape to close alerts
    if (event.key === "Escape") {
      const alerts = document.querySelectorAll(".alert");
      alerts.forEach((alert) => alert.remove());
    }
  });

  // Add visibility change handler for tab switching
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && socket) {
      // Refresh data when tab becomes visible
      setTimeout(refreshData, 1000);
    }
  });
});
