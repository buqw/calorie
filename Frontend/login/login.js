"use strict";

// ===== 1. Backend routes =====
// Preview mode is intentional: credentials are not accepted as a real login.
// Configure real endpoints when your Express backend is ready.
const LOGIN_CONFIG = {
  loginUrl: null,          // Example: "/api/auth/login"
  forgotPasswordUrl: null, // Example: "/api/auth/forgot-password"
  dashboardUrl: null,      // Example: "dashboard.html"
};
const loginForm = document.querySelector("#login-form");
const resetForm = document.querySelector("#reset-form");
const loginButton = document.querySelector("#login-button");
const resetButton = document.querySelector("#reset-button");
let loginBusy = false;
let resetBusy = false;

// ===== 2. Validation and feedback =====
function clearFeedback(form) {
  form.querySelectorAll(".field-error").forEach((item) => { item.textContent = ""; });
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute("aria-invalid"));
  form.querySelectorAll(".error-banner, .status-banner").forEach((item) => {
    item.textContent = "";
    item.hidden = true;
  });
}
function showMessage(id, message) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.hidden = false;
}
function markField(id, message) {
  document.getElementById(id).setAttribute("aria-invalid", "true");
  document.getElementById(`${id}-error`).textContent = message;
}
function validateEmail(id) {
  const input = document.getElementById(id);
  input.value = input.value.trim();
  if (!input.value) { markField(id, "This field is required."); return false; }
  if (!input.validity.valid || input.value.length > 254) {
    markField(id, "Please enter a valid email address.");
    return false;
  }
  return true;
}
function focusFirstError(form) {
  const input = form.querySelector('[aria-invalid="true"]');
  if (input) input.focus();
}
function setBusy(mode, value) {
  const form = mode === "login" ? loginForm : resetForm;
  const button = mode === "login" ? loginButton : resetButton;
  if (mode === "login") loginBusy = value;
  else resetBusy = value;
  form.setAttribute("aria-busy", String(value));
  button.disabled = value;
  button.textContent = value ? "Please wait…" : mode === "login" ? "Login" : "Send Reset Link";
  document.getElementById("forgot-password").disabled = value;
  document.getElementById("back-to-login").disabled = value;
}

// ===== 3. Password eye button and reset view =====
function togglePassword() {
  const password = document.getElementById("password");
  const button = document.getElementById("toggle-password");
  const visible = password.type === "password";
  password.type = visible ? "text" : "password";
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
}
function showResetView(show) {
  if (loginBusy || resetBusy) return;
  clearFeedback(loginForm);
  clearFeedback(resetForm);
  loginForm.hidden = show;
  resetForm.hidden = !show;
  document.getElementById("page-label").textContent = show ? "Password Reset" : "Login";
  document.getElementById("login-title").textContent = show ? "Forgot your password?" : "Welcome back!";
  document.getElementById("login-subtitle").textContent = show
    ? "Enter your email to request a password reset link."
    : "Log in to continue your nutrition journey.";
  const preview = document.getElementById("preview-note");
  preview.hidden = Boolean(show ? LOGIN_CONFIG.forgotPasswordUrl : LOGIN_CONFIG.loginUrl);
  if (show) {
    document.getElementById("reset-email").value = document.getElementById("email").value;
    document.getElementById("password").value = "";
    document.getElementById("password").type = "password";
    document.getElementById("toggle-password").setAttribute("aria-pressed", "false");
    document.getElementById("toggle-password").setAttribute("aria-label", "Show password");
    document.getElementById("reset-email").focus();
  } else document.getElementById("email").focus();
}

// ===== 4. API requests: no local storage for login credentials =====
async function authRequest(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include", // Secure HttpOnly session cookie set by your backend.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error("Authentication request failed");
      error.status = response.status;
      throw error;
    }
  } finally { clearTimeout(timeout); }
}
function requestError(error, mode) {
  const id = `${mode}-error`;
  if (mode === "login" && (error.status === 400 || error.status === 401 || error.status === 403)) {
    showMessage(id, "Incorrect email or password.");
  } else if (error.status === 429) {
    showMessage(id, "Too many attempts. Please wait and try again.");
  } else if (error.name === "AbortError") {
    showMessage(id, "The request timed out. Please try again.");
  } else if (!error.status) {
    showMessage(id, "Unable to connect. Check your connection and try again.");
  } else {
    showMessage(id, "Unable to complete your request. Please try again.");
  }
}

// ===== 5. Login and password-reset submission =====
async function submitLogin(event) {
  event.preventDefault();
  if (loginBusy) return;
  clearFeedback(loginForm);
  const emailValid = validateEmail("email");
  const password = document.getElementById("password");
  const passwordValid = password.value.length > 0;
  if (!passwordValid) markField("password", "This field is required.");
  if (!emailValid || !passwordValid) { focusFirstError(loginForm); return; }
  if (!LOGIN_CONFIG.loginUrl) {
    showMessage("login-status", "Preview only: connect the login API to sign in. No login has been performed.");
    return;
  }
  setBusy("login", true);
  try {
    await authRequest(LOGIN_CONFIG.loginUrl, {
      email: document.getElementById("email").value,
      password: password.value,
    });
    password.value = "";
    if (LOGIN_CONFIG.dashboardUrl) window.location.assign(LOGIN_CONFIG.dashboardUrl);
    else showMessage("login-status", "You are logged in. Connect your Dashboard page to continue.");
  } catch (error) { requestError(error, "login"); }
  finally { setBusy("login", false); }
}
async function submitReset(event) {
  event.preventDefault();
  if (resetBusy) return;
  clearFeedback(resetForm);
  if (!validateEmail("reset-email")) { focusFirstError(resetForm); return; }
  if (!LOGIN_CONFIG.forgotPasswordUrl) {
    showMessage("reset-status", "Preview only: connect the password-reset API to send email. No email has been sent.");
    return;
  }
  setBusy("reset", true);
  try {
    await authRequest(LOGIN_CONFIG.forgotPasswordUrl, { email: document.getElementById("reset-email").value });
    // A generic response protects account existence and must also be used by the server.
    showMessage("reset-status", "If an account exists with this email, you will receive a password reset link.");
  } catch (error) { requestError(error, "reset"); }
  finally { setBusy("reset", false); }
}

// ===== 6. Initialize =====
document.getElementById("preview-note").hidden = Boolean(LOGIN_CONFIG.loginUrl);
document.getElementById("toggle-password").addEventListener("click", togglePassword);
document.getElementById("forgot-password").addEventListener("click", () => showResetView(true));
document.getElementById("back-to-login").addEventListener("click", () => showResetView(false));
loginForm.addEventListener("submit", submitLogin);
resetForm.addEventListener("submit", submitReset);
