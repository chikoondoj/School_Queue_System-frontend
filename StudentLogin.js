const BASE_URL = "https://school-queue-system-backend.onrender.com";
fetch(`${BASE_URL}/api/auth/profile`, {
  method: "GET",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
})
  .then((res) => {
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    return res.json();
  })
  .then((data) => {
    console.log("✅ Cookie test response:", data);
  })
  .catch((err) => {
    console.error("❌ Cookie test failed:", err);
  });


// Toggle password visibility
document
  .getElementById("togglePassword")
  .addEventListener("click", function () {
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.getElementById("eyeIcon");

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      eyeIcon.classList.remove("fa-eye");
      eyeIcon.classList.add("fa-eye-slash");
    } else {
      passwordInput.type = "password";
      eyeIcon.classList.remove("fa-eye-slash");
      eyeIcon.classList.add("fa-eye");
    }
  });

// Handle form submission - SESSION-BASED VERSION
document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitButton = document.getElementById("loginBtn");
    const alertContainer = document.getElementById("alertContainer");

    // Clear previous alerts
    alertContainer.innerHTML = "";

    // Show loading state
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Logging in...';
    submitButton.disabled = true;

    const formData = new FormData(this);
    const loginData = {
      identifier: formData.get("studentCode") || formData.get("email"), // support email for clerks
      password: formData.get("password"),
    };

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      const result = await response.json();
      console.log("Login response:", result);

      if (result.success && result.user) {
        // Show success message
        showAlert("Login successful! Redirecting...", "success");

        // Store minimal user data in sessionStorage (optional)
        sessionStorage.setItem(
          "userData",
          JSON.stringify({
            name: result.user.name,
            studentCode: result.user.studentCode || null,
            role: result.user.role,
            serviceId: result.user.serviceId || null 
          })
        );

        // Redirect based on role
        setTimeout(() => {
          switch (result.user.role) {
            case "CLERK":
              window.location.href = "./clerkDashboard.html";
              break;
            default:
              window.location.href = "./studentDashboard.html";
          }
        }, 1500);
      } else {
        showAlert(
          result.message || "Login failed. Please check your credentials.",
          "danger"
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      showAlert("An error occurred. Please try again later.", "danger");
    } finally {
      // Reset button state
      submitButton.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
      submitButton.disabled = false;
    }
  });


function showAlert(message, type) {
  const alertContainer = document.getElementById("alertContainer");
  const alertHtml = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    <i class="fas fa-${
                      type === "success" ? "check-circle" : "exclamation-circle"
                    } me-2"></i>
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
  alertContainer.innerHTML = alertHtml;
}

// Clear form validation on input
document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", function () {
    this.classList.remove("is-invalid");
  });
});
