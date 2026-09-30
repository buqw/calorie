"use strict";

// ===== 1. Configuration =====
// null = working frontend preview; no account is created.
// Connect your Express routes here when the backend is ready.
const CONFIG = {
  registerUrl: null, // Example: "/api/auth/register"
  profileUrl: null,  // Example: "/api/users/me/profile"
  loginUrl: "login.html",
  dashboardUrl: null, // Example: "dashboard.html"
};
const PAGES = ["signup.html", "weight.html", "height.html", "birthdate.html",
  "gender.html", "activity.html", "goal.html", "diet.html"];
const STORAGE_KEY = "calorie.setup.v1";
const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const today = new Date();
const step = Number(document.body.dataset.step);
const form = document.querySelector("#step-form");
const nextButton = document.querySelector("#next-button");
const errorBanner = document.querySelector("#form-error");
let busy = false;
let storageAvailable = true;

// ===== 2. Per-tab draft (passwords are NEVER stored) =====
function newDraft() {
  return {
    version: 1,
    account: null,
    completed: [],
    weightKg: 63,
    weightUnit: "kg",
    heightCm: 173,
    heightUnit: "cm",
    birth: { year: today.getFullYear() - 20, month: 1, day: 1 },
    gender: null, activity: null, goal: null, diet: null,
  };
}
function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return newDraft();
    const data = JSON.parse(raw);
    if (data.version !== 1) return newDraft();
    const draft = { ...newDraft(), ...data };
    if (!Number.isFinite(draft.weightKg) || draft.weightKg < 20 || draft.weightKg > 350) draft.weightKg = 63;
    if (!Number.isFinite(draft.heightCm) || draft.heightCm < 50 || draft.heightCm > 250) draft.heightCm = 173;
    if (!["kg", "lb"].includes(draft.weightUnit)) draft.weightUnit = "kg";
    if (!["cm", "in"].includes(draft.heightUnit)) draft.heightUnit = "cm";
    if (!draft.birth || ![draft.birth.year, draft.birth.month, draft.birth.day].every(Number.isInteger)) draft.birth = newDraft().birth;
    if (!Array.isArray(draft.completed)) draft.completed = [];
    return draft;
  } catch {
    storageAvailable = false;
    return newDraft();
  }
}
let draft = loadDraft();
function saveDraft() {
  try {
    // This object has no password or confirmation-password fields.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    storageAvailable = true;
    return true;
  } catch {
    storageAvailable = false;
    showError("Allow browser storage to keep your selections between pages. Open the project with Live Server and try again.");
    return false;
  }
}
function completeStep() {
  if (!draft.completed.includes(step)) draft.completed.push(step);
  return saveDraft();
}
function navigateTo(number) { window.location.assign(PAGES[number - 1]); }
function enforceSequence() {
  if (step === 1) return true;
  for (let previous = 1; previous < step; previous++) {
    if (!draft.completed.includes(previous)) {
      navigateTo(previous);
      return false;
    }
  }
  return true;
}

// ===== 3. Feedback and backend response handling =====
function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}
function clearErrors() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
  document.querySelectorAll(".field-error").forEach((item) => { item.textContent = ""; });
  document.querySelectorAll('[aria-invalid="true"]').forEach((item) => item.removeAttribute("aria-invalid"));
}
function fieldError(name, message) {
  const input = document.getElementById(name);
  const feedback = document.getElementById(`${name}-error`);
  if (input) input.setAttribute("aria-invalid", "true");
  if (feedback) feedback.textContent = message;
}
function focusFirstError() {
  const input = document.querySelector('[aria-invalid="true"]');
  if (input) input.focus();
}
function displayApiError(error) {
  const data = error.data || {};
  if (data.code === "EMAIL_EXISTS") {
    fieldError("email", "This email is already registered. Login instead.");
  } else if (data.code === "USERNAME_EXISTS") {
    fieldError("username", "This username is already taken.");
  } else if (data.errors && typeof data.errors === "object") {
    const allowed = ["username", "email", "password", "confirmPassword"];
    let displayed = false;
    allowed.forEach((name) => {
      if (typeof data.errors[name] === "string") {
        fieldError(name, data.errors[name]);
        displayed = true;
      }
    });
    if (!displayed) showError("Please check your details and try again.");
  } else if (error.status === 429) {
    showError("Too many attempts. Please wait and try again.");
  } else if (error.status === 401) {
    showError("Your session has expired. Please log in again.");
  } else if (error.status === 409) {
    showError("This email or username is already registered. Please check both fields.");
  } else if (error.name === "AbortError") {
    showError("The request timed out. Please try again.");
  } else if (!error.status) {
    showError("Unable to connect. Check your connection and try again.");
  } else {
    showError("Unable to save your details. Please try again.");
  }
  focusFirstError();
}
async function apiRequest(url, method, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method,
      credentials: "include", // Backend should use a secure HttpOnly session cookie.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error("API request failed");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally { clearTimeout(timeout); }
}
function setBusy(value) {
  busy = value;
  form.setAttribute("aria-busy", String(value));
  nextButton.disabled = value;
  nextButton.textContent = value ? "Please wait…" : "Next";
  document.querySelector(".back-link").setAttribute("aria-disabled", String(value));
}

// ===== 4. Signup validation and password visibility =====
function validateSignup() {
  const username = document.getElementById("username").value.trim();
  const emailInput = document.getElementById("email");
  const email = emailInput.value.trim();
  emailInput.value = email;
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;
  let valid = true;
  function reject(name, message) { fieldError(name, message); valid = false; }
  if (!username) reject("username", "This field is required.");
  else if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) reject("username", "Use 3–30 letters, numbers, or underscores.");
  if (!email) reject("email", "This field is required.");
  else if (!emailInput.validity.valid || email.length > 254) reject("email", "Please enter a valid email address.");
  if (!password) reject("password", "This field is required.");
  else if (password.length < 8 || password.length > 128) reject("password", "Use 8–128 characters.");
  if (!confirm) reject("confirmPassword", "This field is required.");
  else if (password !== confirm) reject("confirmPassword", "Passwords do not match.");
  if (!valid) { focusFirstError(); return null; }
  return { username, email, password };
}
function initializeSignup() {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute("aria-pressed", String(visible));
      button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${input.id === "password" ? "password" : "confirm password"}`);
    });
  });
  document.querySelector("#login-link").addEventListener("click", () => {
    if (CONFIG.loginUrl) window.location.assign(CONFIG.loginUrl);
    else showError("The Login page is not connected yet.");
  });
  if (draft.account) {
    document.getElementById("username").value = draft.account.username;
    document.getElementById("email").value = draft.account.email;
    ["username", "email"].forEach((name) => { document.getElementById(name).readOnly = true; });
    document.querySelectorAll(".password-field").forEach((item) => { item.hidden = true; });
    const note = document.getElementById("existing-account-note");
    note.hidden = false;
    note.textContent = draft.account.mode === "demo"
      ? "Your details are ready for this preview. No account has been created. Continue to edit your setup."
      : "Your account has been created. Continue to finish your setup.";
  }
}
async function submitSignup() {
  if (draft.account) {
    if (completeStep()) navigateTo(2);
    return;
  }
  const credentials = validateSignup();
  if (!credentials) return;
  setBusy(true);
  try {
    if (!saveDraft()) return; // Verify storage before sending registration.
    if (CONFIG.registerUrl) await apiRequest(CONFIG.registerUrl, "POST", credentials);
    draft.account = { username: credentials.username, email: credentials.email,
      mode: CONFIG.registerUrl ? "live" : "demo" };
    // Passwords remain only in the current form and request. Never persist them.
    document.getElementById("password").value = "";
    document.getElementById("confirmPassword").value = "";
    if (completeStep()) navigateTo(2);
  } catch (error) { displayApiError(error); }
  finally { setBusy(false); }
}

// ===== 5. Selection-only number wheels and units =====
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function normalizeBirth() {
  const b = draft.birth;
  b.year = clamp(b.year, today.getFullYear() - 120, today.getFullYear());
  const maxMonth = b.year === today.getFullYear() ? today.getMonth() + 1 : 12;
  b.month = clamp(b.month, 1, maxMonth);
  const maxDay = b.year === today.getFullYear() && b.month === today.getMonth() + 1
    ? today.getDate() : daysInMonth(b.year, b.month);
  b.day = clamp(b.day, 1, maxDay);
}
function pickerSpec(key) {
  if (key === "weight") {
    const lb = draft.weightUnit === "lb";
    return { min: lb ? 44.1 : 20, max: lb ? 771.6 : 350, increment: .1,
      value: lb ? draft.weightKg * LB_PER_KG : draft.weightKg, unit: draft.weightUnit };
  }
  if (key === "height") {
    const inches = draft.heightUnit === "in";
    return { min: inches ? 19.7 : 50, max: inches ? 98.4 : 250, increment: inches ? .1 : 1,
      value: inches ? draft.heightCm / CM_PER_IN : draft.heightCm, unit: draft.heightUnit };
  }
  const b = draft.birth;
  if (key === "year") return { min: today.getFullYear() - 120, max: today.getFullYear(), increment: 1, value: b.year, unit: "" };
  if (key === "month") return { min: 1, max: b.year === today.getFullYear() ? today.getMonth() + 1 : 12, increment: 1, value: b.month, unit: "" };
  return { min: 1, max: b.year === today.getFullYear() && b.month === today.getMonth() + 1
    ? today.getDate() : daysInMonth(b.year, b.month), increment: 1, value: b.day, unit: "" };
}
function formatNumber(key, value) {
  if (key === "month" || key === "day") return String(value).padStart(2, "0");
  return Number(value.toFixed(1)).toString();
}
function renderPicker(key) {
  const element = document.querySelector(`[data-picker="${key}"]`);
  if (!element) return;
  const spec = pickerSpec(key);
  const rows = element.querySelector(".picker-rows");
  rows.replaceChildren();
  for (let offset = -2; offset <= 2; offset++) {
    const value = spec.value + offset * spec.increment;
    const row = document.createElement("div");
    row.className = `picker-row${offset === 0 ? " is-selected" : ""}`;
    row.dataset.offset = String(offset);
    if (value >= spec.min - .05 && value <= spec.max + .05) {
      row.textContent = formatNumber(key, value);
      if (!offset && spec.unit) {
        const unit = document.createElement("span");
        unit.className = "picker-unit";
        unit.textContent = spec.unit;
        row.append(unit);
      }
    }
    rows.append(row);
  }
  element.setAttribute("aria-valuemin", String(spec.min));
  element.setAttribute("aria-valuemax", String(spec.max));
  element.setAttribute("aria-valuenow", String(Number(spec.value.toFixed(3))));
  element.setAttribute("aria-valuetext", `${formatNumber(key, spec.value)} ${spec.unit}`.trim());
}
function renderAllPickers() {
  document.querySelectorAll("[data-picker]").forEach((item) => renderPicker(item.dataset.picker));
}
function changePicker(key, moves) {
  if (busy) return;
  const spec = pickerSpec(key);
  // Round only on user selection; changing units alone preserves the exact value.
  const value = Number(clamp(spec.value + moves * spec.increment, spec.min, spec.max).toFixed(1));
  if (key === "weight") draft.weightKg = clamp(draft.weightUnit === "lb" ? value / LB_PER_KG : value, 20, 350);
  else if (key === "height") draft.heightCm = clamp(draft.heightUnit === "in" ? value * CM_PER_IN : value, 50, 250);
  else { draft.birth[key] = Math.round(value); normalizeBirth(); }
  renderAllPickers();
  saveDraft();
}
function initializePickers() {
  normalizeBirth();
  document.querySelectorAll('.units input').forEach((input) => {
    input.checked = draft[input.name] === input.value;
    input.addEventListener("change", () => {
      draft[input.name] = input.value;
      renderAllPickers();
      saveDraft();
    });
  });
  renderAllPickers();
  document.querySelectorAll("[data-picker-change]").forEach((button) => {
    button.addEventListener("click", () => changePicker(button.dataset.pickerChange, Number(button.dataset.direction)));
  });
  document.querySelectorAll("[data-picker]").forEach((element) => {
    const key = element.dataset.picker;
    let wheelDelta = 0;
    let lastWheel = 0;
    let pointerStart = null;
    let suppressClick = false;
    element.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (Date.now() - lastWheel > 200) wheelDelta = 0;
      lastWheel = Date.now();
      wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      if (Math.abs(wheelDelta) >= 24) {
        changePicker(key, Math.sign(wheelDelta) * Math.min(5, Math.floor(Math.abs(wheelDelta) / 24)));
        wheelDelta = 0;
      }
    }, { passive: false });
    element.addEventListener("keydown", (event) => {
      const moves = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
      if (event.key in moves) {
        event.preventDefault();
        changePicker(key, moves[event.key]);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const spec = pickerSpec(key);
        changePicker(key, ((event.key === "Home" ? spec.min : spec.max) - spec.value) / spec.increment);
      }
    });
    element.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary) return;
      pointerStart = event.clientY;
      suppressClick = false;
      if (event.pointerType !== "mouse") element.setPointerCapture(event.pointerId);
    });
    element.addEventListener("pointerup", (event) => {
      if (pointerStart === null) return;
      const distance = pointerStart - event.clientY;
      if (Math.abs(distance) > 18) {
        suppressClick = true;
        changePicker(key, Math.sign(distance) * Math.max(1, Math.round(Math.abs(distance) / 35)));
      }
      pointerStart = null;
    });
    element.addEventListener("pointercancel", () => { pointerStart = null; });
    element.addEventListener("click", (event) => {
      if (suppressClick) { suppressClick = false; return; }
      const row = event.target.closest("[data-offset]");
      if (row && row.textContent) changePicker(key, Number(row.dataset.offset));
      element.focus({ preventScroll: true });
    });
  });
}

// ===== 6. Choice cards, final profile, and submit =====
function initializeChoices() {
  document.querySelectorAll('.choice-card input').forEach((input) => {
    input.checked = draft[input.name] === input.value;
    input.closest(".choice-card").classList.toggle("is-selected", input.checked);
    input.addEventListener("change", () => {
      draft[input.name] = input.value;
      document.querySelectorAll(`input[name="${input.name}"]`).forEach((radio) => {
        radio.closest(".choice-card").classList.toggle("is-selected", radio.checked);
      });
      const error = document.getElementById(`${input.name}-error`);
      if (error) error.textContent = "";
      saveDraft();
    });
    input.addEventListener("focus", () => input.closest(".choice-card").classList.add("has-focus"));
    input.addEventListener("blur", () => input.closest(".choice-card").classList.remove("has-focus"));
  });
}
function getProfile() {
  return {
    weightKg: Number(draft.weightKg.toFixed(4)),
    heightCm: Number(draft.heightCm.toFixed(4)),
    dateOfBirth: `${draft.birth.year}-${String(draft.birth.month).padStart(2, "0")}-${String(draft.birth.day).padStart(2, "0")}`,
    gender: draft.gender, activityLevel: draft.activity, goal: draft.goal,
    dietaryPreference: draft.diet,
    preferredUnits: { weight: draft.weightUnit, height: draft.heightUnit },
  };
}
function showCompletion() {
  form.hidden = true;
  document.querySelector("#completion").hidden = false;
  const demo = draft.account.mode === "demo";
  document.querySelector("#completion-message").textContent = demo
    ? "Preview complete. Your selections are kept in this browser tab; no account was created or sent to a server."
    : "Your profile has been saved successfully.";
  const names = {
    male: "Male", female: "Female", sedentary: "Sedentary", light: "Lightly Active",
    moderate: "Moderately Active", very: "Very Active", extreme: "Extremely Active",
    "lose-fat": "Lose Fat", "build-muscle": "Build Muscle", maintain: "Maintain Weight",
    "no-preference": "No Preference", vegetarian: "Vegetarian", vegan: "Vegan",
  };
  const profile = getProfile();
  const summary = document.querySelector("#summary");
  summary.replaceChildren();
  const weight = pickerSpec("weight"), height = pickerSpec("height");
  const items = [["Username", draft.account.username], ["Weight", `${formatNumber("weight", weight.value)} ${weight.unit}`],
    ["Height", `${formatNumber("height", height.value)} ${height.unit}`], ["Date of birth", profile.dateOfBirth],
    ["Gender", names[draft.gender]], ["Activity", names[draft.activity]], ["Goal", names[draft.goal]], ["Diet", names[draft.diet]]];
  items.forEach(([label, value]) => {
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = value;
    summary.append(dt, dd);
  });
  document.querySelector("#completion-title").focus();
}
async function submitStep(event) {
  event.preventDefault();
  if (busy) return;
  clearErrors();
  if (step === 1) { await submitSignup(); return; }
  if (!storageAvailable && !saveDraft()) return;
  const choiceKey = { 5: "gender", 6: "activity", 7: "goal", 8: "diet" }[step];
  if (choiceKey && !document.querySelector(`input[name="${choiceKey}"]:checked`)) {
    document.getElementById(`${choiceKey}-error`).textContent = "Please select an option to continue.";
    document.querySelector(`input[name="${choiceKey}"]`).focus();
    return;
  }
  if (step === 4) normalizeBirth();
  if (step < 8) {
    if (completeStep()) navigateTo(step + 1);
    return;
  }
  setBusy(true);
  try {
    if (draft.account.mode === "live") {
      if (!CONFIG.profileUrl) { showError("Connect the profile API to save your setup."); return; }
      await apiRequest(CONFIG.profileUrl, "PUT", getProfile());
    }
    if (!completeStep()) return;
    if (CONFIG.dashboardUrl && draft.account.mode === "live") window.location.assign(CONFIG.dashboardUrl);
    else showCompletion();
  } catch (error) { displayApiError(error); }
  finally { setBusy(false); }
}

// ===== 7. Initialize this standalone step page =====
if (enforceSequence()) {
  document.querySelector("#preview-note").hidden = Boolean(CONFIG.registerUrl);
  if (step === 1) initializeSignup();
  if (step >= 2 && step <= 4) initializePickers();
  if (step >= 5) initializeChoices();
  form.addEventListener("submit", submitStep);
  document.querySelector(".back-link").addEventListener("click", (event) => {
    if (busy || !saveDraft()) event.preventDefault();
  });
  document.querySelector("#edit-preferences").addEventListener("click", () => {
    document.querySelector("#completion").hidden = true;
    form.hidden = false;
    document.querySelector("#step-title").focus();
  });
  if (!storageAvailable) showError("Open this project using Live Server and allow browser storage to continue.");
}
