const BASE_URL = "https://school-queue-system-backend.onrender.com";
let clerkServiceId = null; // Set this dynamically after login

document.addEventListener("DOMContentLoaded", () => {
  loadClerkInfo();
  refreshData();
  setInterval(refreshData, 5000);

  document
    .getElementById("changePasswordForm")
    .addEventListener("submit", changePassword);
});

function loadClerkInfo() {
  const clerkName = localStorage.getItem("clerkName") || "Clerk";
  clerkServiceId = localStorage.getItem("serviceId");
  document.getElementById("clerkWelcome").textContent = `Welcome, ${clerkName}!`;
}

async function refreshData() {
  try {
    const res = await fetch(`${BASE_URL}/api/tickets?serviceId=${clerkServiceId}`);
    const tickets = await res.json();

    updateSummary(tickets);
    renderTickets(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
  }
}

function updateSummary(tickets) {
  const waiting = tickets.filter(t => t.status === "WAITING").length;
  const current = tickets.find(t => t.status === "IN_PROGRESS")?.student?.name || "-";

  document.getElementById("peopleInLine").textContent = waiting;
  document.getElementById("currentTicket").textContent = current;
}

function renderTickets(tickets) {
  const tbody = document.getElementById("ticketTableBody");
  tbody.innerHTML = "";

  if (tickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No tickets found</td></tr>`;
    return;
  }

  tickets.forEach(ticket => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${ticket.student?.name || "Unknown"}</td>
      <td>${ticket.studentCode}</td>
      <td>${ticket.service?.name}</td>
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
    return `<button class="btn btn-success btn-sm action-btn" onclick="callNext(${ticket.id})"><i class="fas fa-bullhorn"></i></button>`;
  } else if (ticket.status === "CALLED") {
    return `<button class="btn btn-warning btn-sm action-btn" onclick="markInProgress(${ticket.id})"><i class="fas fa-play"></i></button>`;
  } else if (ticket.status === "IN_PROGRESS") {
    return `<button class="btn btn-primary btn-sm action-btn" onclick="completeTicket(${ticket.id})"><i class="fas fa-check"></i></button>`;
  }
  return `<button class="btn btn-danger btn-sm action-btn" onclick="cancelTicket(${ticket.id})"><i class="fas fa-times"></i></button>`;
}

async function callNext(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/call-next/${ticketId}`, { method: "PATCH" });
  refreshData();
}

async function markInProgress(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/in-progress/${ticketId}`, { method: "PATCH" });
  refreshData();
}

async function completeTicket(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/complete/${ticketId}`, { method: "PATCH" });
  refreshData();
}

async function cancelTicket(ticketId) {
  await fetch(`${BASE_URL}/api/tickets/cancel/${ticketId}`, { method: "PATCH" });
  refreshData();
}

async function changePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;

  const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  const data = await res.json();
  alert(data.message || "Password updated");
}

function logout() {
  localStorage.clear();
  window.location.href = "studentLogin.html";
}
