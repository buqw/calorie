"use strict";

// ===== 1. Connect your existing backend here =====
// null endpoints = clearly labeled local preview, without server actions.
const PROFILE_CONFIG = {
  getProfileUrl: null,    // Set the actual GET route that returns { user: {...} }.
  updateProfileUrl: null, // Your screenshot uses PUT /api/profile.
  changePasswordUrl: null,
  changePasswordMethod: "POST",
  deleteAccountUrl: null,
  deleteAccountMethod: "DELETE",
  logoutUrl: null,
  loginPage: "login.html", // Existing Login page, in the same folder.
  getAuthHeaders: () => ({}), // Add Authorization here if your API uses a bearer token.
  routes: { home: null, meals: null, ai: null, history: null, friends: null },
};
const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const demoMode = !PROFILE_CONFIG.getProfileUrl && !PROFILE_CONFIG.updateProfileUrl;
const today = new Date();
const labels = {
  gender: { male: "Male", female: "Female" },
  goal: { lose_weight: "Lose Fat", gain_muscle: "Build Muscle", maintain_weight: "Maintain Weight" },
  activityLevel: { sedentary: "Sedentary", light: "Lightly Active", moderate: "Moderately Active", very_active: "Very Active", extremely_active: "Extremely Active" },
  dietType: { no_preference: "No Preference", vegetarian: "Vegetarian", vegan: "Vegan" },
};
const sampleUser = {
  username: "Hassan", email: "hassan@example.com", birthDate: "2006-05-10",
  gender: "male", height: { value: 173, unit: "cm" }, weight: { value: 75.8, unit: "kg" },
  goal: "lose_weight", activityLevel: "moderate", dietType: "no_preference",
  dislikedFoods: ["Eggs", "Mushrooms"], healthNotes: "",
};
let currentUser = null;
let draft = null;
let editing = false;
let busy = false;
let dialogBusy = false;

// ===== 2. Data normalization and safe plain text rendering =====
function cleanFoods(items) {
  if (!Array.isArray(items)) return [];
  const result = [];
  items.forEach((item) => {
    if (typeof item !== "string") return;
    const food = item.trim();
    if (food && !result.some((value) => value.toLocaleLowerCase() === food.toLocaleLowerCase())) result.push(food);
  });
  return result;
}
function normalizeUser(source) {
  const user = source && typeof source === "object" ? source : {};
  function measurement(key, allowed) {
    const item = user[key];
    return item && typeof item.value === "number" && Number.isFinite(item.value) && allowed.includes(item.unit)
      ? { value: item.value, unit: item.unit } : null;
  }
  return {
    username: typeof user.username === "string" ? user.username : "Your Profile",
    email: typeof user.email === "string" ? user.email : "",
    birthDate: typeof user.birthDate === "string" ? user.birthDate.slice(0, 10) : "",
    gender: typeof user.gender === "string" ? user.gender : "",
    height: measurement("height", ["cm", "in"]), weight: measurement("weight", ["kg", "lb"]),
    goal: typeof user.goal === "string" ? user.goal : "",
    activityLevel: typeof user.activityLevel === "string" ? user.activityLevel : "",
    dietType: typeof user.dietType === "string" ? user.dietType : "",
    dislikedFoods: cleanFoods(user.dislikedFoods),
    healthNotes: typeof user.healthNotes === "string" ? user.healthNotes : "",
  };
}
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  $("notice").classList.toggle("is-error", error);
}
function clearNotice() { $("notice").hidden = true; $("notice").textContent = ""; }
function isDateValid(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date <= today;
}
function formatBirth(value) {
  if (!isDateValid(value)) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function displayMeasure(item) { return item ? `${Number(item.value.toFixed(1))} ${item.unit}` : "Not set"; }
function updateGenderIcon(gender) {
  // Direct text replacement: no SVG symbol reference or external icon dependency.
  const selected = String(gender || "").trim().toLowerCase();
  $("gender-icon").textContent = selected === "male" ? "♂" : selected === "female" ? "♀" : "⚥";
}
function usernameError(message = "") {
  $("username-error").textContent = message;
  $("username-input").setAttribute("aria-invalid", String(Boolean(message)));
}
function isUsernameConflict(error) {
  return error.data?.code === "USERNAME_EXISTS" ||
    (error.status === 409 && error.data?.field === "username");
}
function renderProfile() {
  $("username").textContent = currentUser.username;
  $("email").textContent = currentUser.email;
  updateGenderIcon(currentUser.gender);
  $("avatar").textContent = Array.from(currentUser.username)[0]?.toUpperCase() || "C";
  $("view-birthDate").textContent = formatBirth(currentUser.birthDate);
  ["gender", "goal", "activityLevel", "dietType"].forEach((key) => {
    $("view-" + key).textContent = labels[key][currentUser[key]] || currentUser[key] || "Not set";
  });
  ["height", "weight"].forEach((key) => { $("view-" + key).textContent = displayMeasure(currentUser[key]); });
  $("view-healthNotes").textContent = currentUser.healthNotes || "No notes added yet.";
  renderFoods();
}
function renderFoods(focusIndex = null) {
  const foods = editing ? draft.dislikedFoods : currentUser.dislikedFoods;
  const container = $("food-tags");
  container.replaceChildren();
  if (!foods.length) {
    const empty = document.createElement("span");
    empty.className = "detail-label";
    empty.textContent = "No foods added.";
    container.append(empty);
  }
  foods.forEach((food, index) => {
    const tag = document.createElement("span"); tag.className = "food-tag";
    const name = document.createElement("span"); name.textContent = food; tag.append(name);
    if (editing) {
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "remove-food"; remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${food}`);
      remove.disabled = busy;
      remove.addEventListener("click", () => {
        if (busy) return;
        draft.dislikedFoods.splice(index, 1);
        renderFoods(Math.min(index, draft.dislikedFoods.length - 1));
      });
      tag.append(remove);
    }
    container.append(tag);
  });
  if (focusIndex !== null) {
    const buttons = container.querySelectorAll("button");
    if (focusIndex >= 0 && buttons[focusIndex]) buttons[focusIndex].focus();
    else $("food-input").focus();
  }
}

// ===== 3. Edit mode, calendar selections and measurement units =====
function setEditing(value) {
  editing = value;
  $("username").hidden = value;
  $("edit-profile").hidden = value;
  $("cancel-edit").hidden = !value;
  $("save-profile").hidden = !value;
  $("page-description").textContent = value ? "Editing your profile." : "Manage your details and nutrition preferences.";
  document.querySelectorAll(".editor").forEach((element) => { element.hidden = !value; });
  document.querySelectorAll(".view-value").forEach((element) => { element.hidden = value; });
  $("view-healthNotes").hidden = value;
  renderFoods();
}
function options(select, values, chosen, format = String) {
  const fragment = document.createDocumentFragment();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value); option.textContent = format(value);
    option.selected = Number(value) === Number(chosen);
    fragment.append(option);
  });
  select.replaceChildren(fragment);
}
function range(min, max) { return Array.from({ length: max - min + 1 }, (_, index) => min + index); }
function initializeBirth() {
  const parts = isDateValid(draft.birthDate) ? draft.birthDate.split("-").map(Number) : [today.getFullYear() - 20, 1, 1];
  const firstYear = Math.min(parts[0], today.getFullYear() - 120);
  options($("birth-year"), range(firstYear, today.getFullYear()).reverse(), parts[0]);
  options($("birth-month"), range(1, 12), parts[1], (value) => String(value).padStart(2, "0"));
  options($("birth-day"), range(1, 31), parts[2], (value) => String(value).padStart(2, "0"));
  updateCalendar();
}
function updateCalendar() {
  const year = Number($("birth-year").value);
  const previousMonth = Number($("birth-month").value) || 1;
  const maxMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  const month = Math.min(previousMonth, maxMonth);
  options($("birth-month"), range(1, maxMonth), month, (value) => String(value).padStart(2, "0"));
  const days = year === today.getFullYear() && month === today.getMonth() + 1
    ? today.getDate() : new Date(year, month, 0).getDate();
  const day = Math.min(Number($("birth-day").value) || 1, days);
  options($("birth-day"), range(1, days), day, (value) => String(value).padStart(2, "0"));
}
function convertMeasure(key, item, unit) {
  if (item.unit === unit) return { ...item };
  const factor = key === "weight" ? 2.2046226218 : 2.54;
  const value = key === "weight" ? (unit === "lb" ? item.value * factor : item.value / factor)
    : (unit === "in" ? item.value / factor : item.value * factor);
  return { value, unit };
}
function renderMeasurement(key) {
  const item = draft[key];
  const limits = key === "weight" ? (item.unit === "kg" ? [20, 350, .1] : [44.1, 771.6, .1])
    : (item.unit === "cm" ? [50, 250, 1] : [19.7, 98.4, .1]);
  const [min, max, increment] = limits;
  const values = [];
  for (let index = 0; index <= Math.round((max - min) / increment); index++) values.push(Number((min + index * increment).toFixed(1)));
  // Preserve exact converted value in an option; repeated unit toggles do not drift.
  if (!values.includes(item.value)) values.push(item.value);
  values.sort((a, b) => a - b);
  options($(key + "-value"), values, item.value, (value) => String(Number(value.toFixed(1))));
  document.querySelectorAll(`input[name="${key}-unit"]`).forEach((radio) => { radio.checked = radio.value === item.unit; });
}
function selectValue(id, value) {
  const select = $(id);
  // Keep a server-provided enum even if your team's schema differs from these examples.
  if (value && !Array.from(select.options).some((option) => option.value === value)) {
    const option = document.createElement("option"); option.value = value; option.textContent = value; select.append(option);
  }
  if (value) select.value = value;
}
function beginEdit() {
  if (!currentUser || busy) return;
  clearNotice();
  draft = clone(currentUser);
  $("username-input").value = draft.username;
  usernameError();
  draft.height ||= { value: 173, unit: "cm" };
  draft.weight ||= { value: 70, unit: "kg" };
  initializeBirth();
  ["gender", "goal", "activityLevel", "dietType"].forEach((key) => selectValue(key, draft[key]));
  renderMeasurement("height"); renderMeasurement("weight");
  $("healthNotes").value = draft.healthNotes;
  $("food-input").value = ""; $("food-error").textContent = "";
  setEditing(true);
  updateGenderIcon($("gender").value);
  $("username-input").focus();
}
function cancelEdit() {
  if (busy) return;
  draft = null;
  usernameError();
  $("food-input").value = "";
  setEditing(false);
  renderProfile(); clearNotice();
  $("edit-profile").focus();
}
function addFood() {
  if (!editing || busy) return false;
  const food = $("food-input").value.trim();
  $("food-error").textContent = "";
  if (!food) { $("food-error").textContent = "Enter a food name first."; return false; }
  if (food.length > 80) { $("food-error").textContent = "Use no more than 80 characters."; return false; }
  if (draft.dislikedFoods.some((value) => value.toLocaleLowerCase() === food.toLocaleLowerCase())) {
    $("food-error").textContent = "This food is already in your list."; return false;
  }
  draft.dislikedFoods.push(food);
  $("food-input").value = "";
  renderFoods(); $("food-input").focus();
  return true;
}
function collectProfile() {
  const username = $("username-input").value.trim();
  usernameError();
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    const message = "Use 3–30 letters, numbers or underscores for your username.";
    usernameError(message);
    $("username-input").focus();
    throw new Error(message);
  }
  const birthDate = `${$("birth-year").value}-${$("birth-month").value.padStart(2, "0")}-${$("birth-day").value.padStart(2, "0")}`;
  const payload = {
    username, birthDate,
    gender: $("gender").value,
    height: { ...draft.height }, weight: { ...draft.weight },
    goal: $("goal").value, activityLevel: $("activityLevel").value, dietType: $("dietType").value,
    dislikedFoods: cleanFoods(draft.dislikedFoods),
    healthNotes: $("healthNotes").value,
  };
  if (!isDateValid(payload.birthDate)) throw new Error("Choose a valid date of birth.");
  const cm = convertMeasure("height", payload.height, "cm").value;
  const kg = convertMeasure("weight", payload.weight, "kg").value;
  if (cm < 50 || cm > 250 || kg < 20 || kg > 350) throw new Error("Choose a height and weight within the available range.");
  if (payload.healthNotes.length > 2000) throw new Error("Keep health notes within 2,000 characters.");
  return payload;
}

// ===== 4. Requests, live loading and saving =====
async function request(url, method, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method, credentials: "include",
      headers: { ...(payload ? { "Content-Type": "application/json" } : {}), ...PROFILE_CONFIG.getAuthHeaders() },
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error("Request failed"); error.status = response.status; error.data = data; throw error; }
    return data;
  } finally { clearTimeout(timeout); }
}
function requestMessage(error) {
  if (error.status === 401) return "Your session has expired. Please log in again.";
  if (error.status === 403) return "You do not have permission to complete this action.";
  if (error.status === 400 || error.status === 422) return "Some values were rejected. Check your details and try again.";
  if (error.status === 409) return "A value is already in use. Check your details and try again.";
  if (error.status === 429) return "Too many attempts. Please wait and try again.";
  if (error.name === "AbortError") return "The request timed out. Please try again.";
  if (!error.status && error instanceof TypeError) return "Unable to connect. Check your connection and try again.";
  if (!error.status) return error.message || "Unable to complete the action.";
  return "Unable to complete your request. Please try again.";
}
function setBusy(value) {
  busy = value;
  $("profile-form").setAttribute("aria-busy", String(value));
  document.querySelectorAll("button, #username-input, #profile-form input, #profile-form select, #profile-form textarea").forEach((control) => { control.disabled = value; });
  $("save-profile").textContent = value ? "Saving…" : "Save Changes";
  // Delete requires confirmation even after another request ends.
  $("delete-submit").disabled = value || $("delete-confirm").value !== "DELETE";
}
async function loadProfile() {
  $("demo-note").hidden = !demoMode;
  $("edit-profile").disabled = true;
  if (demoMode) currentUser = normalizeUser(sampleUser);
  else {
    $("username").textContent = "Loading your profile…";
    $("email").textContent = "";
    try {
      if (!PROFILE_CONFIG.getProfileUrl) throw new Error("Configure your GET profile route before using live mode.");
      const response = await request(PROFILE_CONFIG.getProfileUrl, "GET");
      const user = response.user || response;
      if (!user || typeof user !== "object" || typeof user.username !== "string") throw new Error("The profile API must return your user data.");
      currentUser = normalizeUser(user);
    } catch (error) { $("username").textContent = "Profile unavailable"; notice(requestMessage(error), true); return; }
  }
  renderProfile(); $("edit-profile").disabled = false;
}
async function saveProfile(event) {
  event.preventDefault();
  if (!editing || busy) return;
  clearNotice();
  if ($("food-input").value.trim() && !addFood()) return;
  let payload;
  try { payload = collectProfile(); } catch (error) { notice(error.message, true); return; }
  setBusy(true);
  try {
    let updated = { ...currentUser, ...payload };
    if (!demoMode) {
      if (!PROFILE_CONFIG.updateProfileUrl) throw new Error("Configure the PUT profile route to save your changes.");
      const response = await request(PROFILE_CONFIG.updateProfileUrl, "PUT", payload);
      if (response.user) updated = { ...updated, ...response.user };
    }
    currentUser = normalizeUser(updated);
    setEditing(false); draft = null; renderProfile();
    notice(demoMode ? "Preview updated. Changes are kept on this page only and were not saved to a server." : "Your profile was saved successfully.");
    $("edit-profile").focus();
  } catch (error) {
    if (isUsernameConflict(error)) {
      usernameError("This username is already taken. Please choose another.");
      notice("This username is already taken. Please choose another.", true);
    } else { notice(requestMessage(error), true); }
  } finally {
    setBusy(false);
    if (editing && $("username-error").textContent) $("username-input").focus();
    else if (!editing) $("edit-profile").focus();
  }
}

// ===== 5. Account settings (backend endpoints are configured separately) =====
function openDialog(id) {
  if (busy || dialogBusy) return;
  if (editing) { notice("Save or cancel your profile changes before opening account settings.", true); return; }
  const dialog = $(id);
  dialog.querySelector("form").reset();
  dialog.querySelector(".dialog-message").textContent = "";
  if (id === "delete-dialog") $("delete-submit").disabled = true;
  dialog.showModal();
}
function setDialogBusy(id, value) {
  dialogBusy = value;
  $(id).querySelectorAll("button, input").forEach((element) => { element.disabled = value; });
  if (id === "delete-dialog") $("delete-submit").disabled = value || $("delete-confirm").value !== "DELETE";
}
async function changePassword(event) {
  event.preventDefault();
  if (dialogBusy) return;
  const currentPassword = $("current-password").value;
  const newPassword = $("new-password").value;
  const confirmPassword = $("confirm-password").value;
  const feedback = $("password-message");
  if (!currentPassword || !newPassword || !confirmPassword) { feedback.textContent = "Complete all password fields."; return; }
  if (newPassword.length < 8 || newPassword.length > 128) { feedback.textContent = "Use 8–128 characters for the new password."; return; }
  if (newPassword !== confirmPassword) { feedback.textContent = "New passwords do not match."; return; }
  if (!PROFILE_CONFIG.changePasswordUrl) { feedback.textContent = "Connect the change-password API. No password has been changed."; return; }
  setDialogBusy("password-dialog", true);
  try {
    await request(PROFILE_CONFIG.changePasswordUrl, PROFILE_CONFIG.changePasswordMethod, { currentPassword, newPassword });
    $("password-form").reset(); $("password-dialog").close();
    notice("Your password was updated.");
  } catch (error) { feedback.textContent = requestMessage(error); }
  finally { setDialogBusy("password-dialog", false); }
}
async function deleteAccount(event) {
  event.preventDefault();
  if (dialogBusy || $("delete-confirm").value !== "DELETE") return;
  const feedback = $("delete-message");
  if (!PROFILE_CONFIG.deleteAccountUrl) { feedback.textContent = "Connect the delete-account API. No account has been deleted."; return; }
  setDialogBusy("delete-dialog", true);
  try {
    await request(PROFILE_CONFIG.deleteAccountUrl, PROFILE_CONFIG.deleteAccountMethod);
    currentUser = null; draft = null;
    window.location.assign(PROFILE_CONFIG.loginPage);
  } catch (error) { feedback.textContent = requestMessage(error); }
  finally { setDialogBusy("delete-dialog", false); }
}
async function logout() {
  if (busy || dialogBusy) return;
  if (editing) { notice("Save or cancel your profile changes before logging out.", true); return; }
  if (!PROFILE_CONFIG.logoutUrl) { notice("Connect the logout API to end your server session. No server session has been changed."); return; }
  setBusy(true);
  try {
    await request(PROFILE_CONFIG.logoutUrl, "POST");
    window.location.assign(PROFILE_CONFIG.loginPage);
  } catch (error) { notice(requestMessage(error), true); }
  finally { setBusy(false); }
}

// ===== 6. Events =====
$("gender").addEventListener("change", () => {
  if (!editing || busy) return;
  draft.gender = $("gender").value;
  updateGenderIcon(draft.gender);
});
$("username-input").addEventListener("input", () => { usernameError(); });
$("edit-profile").addEventListener("click", beginEdit);
$("cancel-edit").addEventListener("click", cancelEdit);
$("profile-form").addEventListener("submit", saveProfile);
$("add-food").addEventListener("click", addFood);
$("food-input").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addFood(); } });
["birth-year", "birth-month", "birth-day"].forEach((id) => $(id).addEventListener("change", updateCalendar));
["height", "weight"].forEach((key) => {
  $(key + "-value").addEventListener("change", () => { draft[key].value = Number($(key + "-value").value); });
  document.querySelectorAll(`input[name="${key}-unit"]`).forEach((radio) => radio.addEventListener("change", () => {
    if (!editing || busy) return;
    draft[key] = convertMeasure(key, draft[key], radio.value);
    renderMeasurement(key);
  }));
});
$("change-password").addEventListener("click", () => openDialog("password-dialog"));
$("delete-account").addEventListener("click", () => openDialog("delete-dialog"));
$("password-form").addEventListener("submit", changePassword);
$("delete-form").addEventListener("submit", deleteAccount);
$("delete-confirm").addEventListener("input", () => { $("delete-submit").disabled = $("delete-confirm").value !== "DELETE"; });
$("logout").addEventListener("click", logout);
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => { if (!dialogBusy) $(button.dataset.close).close(); }));
["password-dialog", "delete-dialog"].forEach((id) => {
  $(id).addEventListener("cancel", (event) => { if (dialogBusy) event.preventDefault(); });
  $(id).addEventListener("close", () => { $(id).querySelector("form").reset(); });
});
document.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.nav === "profile") return;
  if (editing) { notice("Save or cancel your changes before leaving this page.", true); return; }
  const route = PROFILE_CONFIG.routes[button.dataset.nav];
  if (route) window.location.assign(route);
  else notice("This page is not connected yet.");
}));
// ===== 7. Initialize =====
loadProfile();
