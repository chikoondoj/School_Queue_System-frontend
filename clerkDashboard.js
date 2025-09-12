const BASE_URL = "https://school-queue-system-backend.onrender.com";
let clerkServiceId = null; // Assigned service for this clerk

document.addEventListener("DOMContentLoaded", () => {
  loadClerkInfo();
  refreshData();
  setInterval(refreshData, 5000); // Refresh every 5 seconds

  document
    .getElementById("changePasswordForm")
    .addEventListener("submit", changePassword);
});

function loadClerkInfo() {
  // Get clerk info from sessionStorage (set on login)
  const clerkData = JSON.parse(sessionStorage.getItem("userData")) || {};
  const clerkName = clerkData.name || "Clerk";
  clerkServiceId = clerkData.serviceId;
  document.getElementById("clerkWelcome").textContent = `Welcome, ${clerkName}!`;
}

async function refreshData() {
  try {
    // Fetch tickets for the clerk's assigned service
    const res = await fetch(`${BASE_URL}/api/tickets/queue/${clerkServiceId}`, {
      credentials: "include",
    });
    const data = await res.json();
    const tickets = data.data || [];

    updateSummary(tickets);
    renderTickets(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
  }
}

function updateSummary(tickets) {
  const waiting = tickets.filter(t => t.status === "WAITING").length;
  const current = tickets.find(t => t.status === "IN_PROGRESS")?.user?.name || "-";

  document.getElementById("peopleInLine").textContent = waiting;
  document.getElementById("currentTicket").textContent = current;
}

function renderTickets(tickets) {
  const tbody = document.getElementById("ticketTableBody");
  tbody.innerHTML = "";

  if (!tickets || tickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No tickets found</td></tr>`;
    return;
  }

  tickets.forEach(ticket => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${ticket.user?.name || "Unknown"}</td>
      <td>${ticket.user?.studentCode || "--"}</td>
      <td>${ticket.service?.name || ticket.serviceId}</td>
      <td><span class="badge bg-${getStatusColor(ticket.status)}">${ticket.status}</span></td>
      <td>${new Date(ticket.createdAt).toLocaleString()}</td>
      <td>
        ${getActionButtons(ticket)}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function getStatusColor(status) {
  switch (status) {
    case "WAITING": return "secondary";
    case "CALLED": return "info";
    case "IN_PROGRESS": return "warning";
    case "COMPLETED": return "success";
    case "CANCELLED": return "danger";
    default: return "dark";
  }
}

function getActionButtons(ticket) {
  if (ticket.status === "WAITING") {
    return `<button class="btn btn-success btn-sm" onclick="callNext('${ticket.id}')"><i class="fas fa-bullhorn"></i></button>`;
  } else if (ticket.status === "CALLED") {
    return `<button class="btn btn-warning btn-sm" onclick="markInProgress('${ticket.id}')"><i class="fas fa-play"></i></button>`;
  } else if (ticket.status === "IN_PROGRESS") {
    return `<button class="btn btn-primary btn-sm" onclick="completeTicket('${ticket.id}')"><i class="fas fa-check"></i></button>`;
  }
  return `<button class="btn btn-danger btn-sm" onclick="cancelTicket('${ticket.id}')"><i class="fas fa-times"></i></button>`;
}

// Ticket actions
async function callNext(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/call-next/${ticketId}`, { method: "PATCH", credentials: "include" });
  refreshData();
}

async function markInProgress(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/in-progress/${ticketId}`, { method: "PATCH", credentials: "include" });
  refreshData();
}

async function completeTicket(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/complete/${ticketId}`, { method: "PATCH", credentials: "include" });
  refreshData();
}

async function cancelTicket(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/cancel/${ticketId}`, { method: "PATCH", credentials: "include" });
  refreshData();
}

// Change password
async function changePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;

  const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  const data = await res.json();
  alert(data.message || "Password updated");
}

// Logout
function logout() {
  sessionStorage.clear();
  window.location.href = "studentLogin.html"; // Redirect to student login page
}
