"use strict";
// ===== 1. Connect your actual backend endpoints here. =====
// These POST contracts are documented in ADD-MEAL-README.txt; adapt if yours differ.
const MEAL_API = {
  saveUrl: "",
  analyzeIngredientsUrl: "",
  analyzePhotoUrl: "",
  logoutUrl: "",
  credentials: "include",
  getHeaders: function () { return {}; }, // Use the same auth headers as Dashboard.
};
const MEAL_ROUTES = {
  dashboard: "dashboard.html", meals: "add-meal.html", ai: "chatbot.html",
  history: "history.html", friends: "friends.html", profile: "profile.html", login: "login.html",
};
const field = function (id) { return document.getElementById(id); };
let method = "nutrition";
let busy = false;
let saved = false;
let analysisReady = false;
let photoFile = null;
let previewUrl = null;
let rowNumber = 0;
const macroKeys = ["protein", "carbs", "fat"];
const nutritionKeys = ["calories", ...macroKeys];
let analysisNutrition = null;

// ===== 2. Messages, method buttons and numeric validation =====
function clearMessages() { field("meal-error").hidden = true; field("meal-message").hidden = true; }
function mealError(message) { field("meal-error").textContent = message; field("meal-error").hidden = false; }
function mealMessage(message) { field("meal-message").textContent = message; field("meal-message").hidden = false; }
function numericValue(raw, label, allowZero = true) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Enter " + label + ".");
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) {
    throw new Error(label + " must be a " + (allowZero ? "nonnegative" : "positive") + " number.");
  }
  return number;
}
function collectMetadata() {
  const name = field("meal-name").value.trim();
  if (!name || name.length > 100) { field("meal-name").focus(); throw new Error("Enter a meal name of 1–100 characters."); }
  const mealType = field("meal-type").value;
  if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) throw new Error("Choose a valid meal type.");
  return { name: name, mealType: mealType };
}
// Standard macro energy estimate: protein/carbs 4 kcal/g, fat 9 kcal/g.
function caloriesFromMacros(nutrition) {
  return Math.round((nutrition.protein * 4 + nutrition.carbs * 4 + nutrition.fat * 9) * 100) / 100;
}
function withCalories(nutrition) {
  const unchangedAnalysis = method !== "nutrition" && analysisNutrition && macroKeys.every(function (key) { return nutrition[key] === analysisNutrition[key]; });
  return { calories: unchangedAnalysis ? analysisNutrition.calories : caloriesFromMacros(nutrition), ...nutrition };
}
function updateCalculatedCalories() {
  const values = {};
  for (const key of macroKeys) {
    const raw = field(key).value;
    if (!raw.trim() || !Number.isFinite(Number(raw)) || Number(raw) < 0) { field("calculated-calories").textContent = "—"; return; }
    values[key] = Number(raw);
  }
  field("calculated-calories").textContent = new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(withCalories(values).calories);
}
function collectNutrition() {
  const nutrition = {};
  macroKeys.forEach(function (key) {
    const input = field(key); input.removeAttribute("aria-invalid");
    try { nutrition[key] = numericValue(input.value, key); }
    catch (error) { input.setAttribute("aria-invalid", "true"); input.focus(); throw error; }
  });
  return withCalories(nutrition);
}
function updateModeUI() {
  field("ingredients-panel").hidden = method !== "ingredients";
  field("photo-panel").hidden = method !== "photo";
  field("nutrition-panel").hidden = method !== "nutrition" && !analysisReady;
  field("analyze-meal").hidden = method === "nutrition";
  field("analyze-meal").textContent = method === "photo" ? "Analyze Photo" : "Analyze Ingredients";
  field("save-meal").hidden = method !== "nutrition" && !analysisReady;
  field("nutrition-heading").textContent = method === "nutrition" ? "Calories & Macronutrients" : "Review Estimated Nutrition";
  field("nutrition-help").textContent = method === "nutrition"
    ? "Enter protein, carbs and fat in grams. Calories are calculated automatically."
    : "Check and adjust these estimates before adding your meal.";
  document.querySelectorAll("[data-method]").forEach(function (button) {
    const selected = button.dataset.method === method;
    button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
  macroKeys.forEach(function (key) { field(key).disabled = busy || saved || field("nutrition-panel").hidden; });
}
function switchMethod(value) {
  if (busy || saved || !["nutrition", "ingredients", "photo"].includes(value) || value === method) return;
  method = value; analysisReady = false; clearMessages();
  macroKeys.forEach(function (key) { field(key).value = ""; });
  analysisNutrition = null; updateCalculatedCalories();
  updateModeUI();
}
function invalidateAnalysis() {
  if (busy || method === "nutrition") return;
  const previous = analysisReady; analysisReady = false; analysisNutrition = null; updateModeUI(); updateCalculatedCalories();
  if (previous) mealMessage("Your inputs changed. Analyze again before adding this meal.");
}
function setBusy(value) {
  busy = value; field("meal-form").setAttribute("aria-busy", String(value));
  document.querySelectorAll("button, #meal-form input, #meal-form select, #meal-form textarea").forEach(function (control) { control.disabled = value || saved; });
  // Avoid navigation while a save/analysis request is pending.
  ["back-dashboard", "cancel-meal"].forEach(function (id) { field(id).setAttribute("aria-disabled", String(value)); });
  updateModeUI();
}

// ===== 3. Ingredients: names + constrained quantities + units =====
function addIngredient(values = {}) {
  if (busy || saved) return;
  rowNumber++; const id = rowNumber;
  const row = document.createElement("div"); row.className = "ingredient-row";
  const name = document.createElement("input"); name.type = "text"; name.maxLength = 100;
  name.placeholder = "Ingredient name"; name.className = "ingredient-name"; name.value = values.name || "";
  name.setAttribute("aria-label", "Ingredient " + id + " name");
  const amount = document.createElement("input"); amount.type = "number"; amount.min = "0"; amount.step = "any";
  amount.inputMode = "decimal"; amount.placeholder = "Quantity"; amount.className = "ingredient-quantity";
  amount.value = values.quantity === undefined ? "" : String(values.quantity); amount.setAttribute("aria-label", "Ingredient " + id + " quantity");
  const unit = document.createElement("select"); unit.className = "ingredient-unit"; unit.setAttribute("aria-label", "Ingredient " + id + " unit");
  ["g", "ml", "piece", "tbsp", "tsp", "cup"].forEach(function (value) {
    const option = document.createElement("option"); option.value = value; option.textContent = value; unit.append(option);
  }); unit.value = values.unit || "g";
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-ingredient";
  remove.setAttribute("aria-label", "Remove ingredient " + id); remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
  remove.addEventListener("click", function () {
    if (busy || saved) return; row.remove(); invalidateAnalysis();
    if (!field("ingredient-rows").children.length) addIngredient();
  });
  row.append(name, amount, unit, remove); field("ingredient-rows").append(row);
  name.addEventListener("input", invalidateAnalysis); amount.addEventListener("input", invalidateAnalysis); unit.addEventListener("change", invalidateAnalysis);
  invalidateAnalysis();
}
function collectIngredients() {
  const ingredients = [];
  document.querySelectorAll(".ingredient-row").forEach(function (row) {
    const name = row.querySelector(".ingredient-name").value.trim();
    const raw = row.querySelector(".ingredient-quantity").value;
    if (!name && !raw.trim()) return; // Ignore wholly empty starter rows.
    if (!name || name.length > 100) throw new Error("Enter a name for each ingredient.");
    const unit = row.querySelector(".ingredient-unit").value;
    if (!["g", "ml", "piece", "tbsp", "tsp", "cup"].includes(unit)) throw new Error("Choose a valid ingredient unit.");
    ingredients.push({ name: name, quantity: numericValue(raw, "quantity for " + name, false), unit: unit });
  });
  if (!ingredients.length) throw new Error("Add at least one ingredient with a quantity.");
  return ingredients;
}

// ===== 4. Photo selection, preview and drop zone =====
function setPhoto(file) {
  if (busy || saved) return;
  if (file && !["image/jpeg", "image/png"].includes(file.type)) { mealError("Choose a JPG or PNG image."); field("meal-photo").value = ""; return; }
  if (file && (file.size <= 0 || file.size > 10 * 1024 * 1024)) { mealError("Choose a nonempty photo smaller than 10 MB."); field("meal-photo").value = ""; return; }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  photoFile = file || null; previewUrl = photoFile ? URL.createObjectURL(photoFile) : null;
  if (previewUrl) field("photo-preview").src = previewUrl; else field("photo-preview").removeAttribute("src");
  field("photo-preview").hidden = !photoFile; field("empty-preview").hidden = Boolean(photoFile);
  field("remove-photo").hidden = !photoFile; field("file-name").textContent = photoFile ? photoFile.name : "";
  clearMessages(); invalidateAnalysis();
}
function requirePhoto() { if (!photoFile) throw new Error("Choose a meal photo first."); return photoFile; }

// ===== 5. API contracts: change these adapters to match your backend =====
function mapAnalysisResponse(response) {
  const nutrition = response.nutrition || (response.data && response.data.nutrition);
  if (!nutrition || typeof nutrition !== "object") throw new Error("Analysis must return {nutrition:{calories,protein,carbs,fat}}.");
  const result = {};
  nutritionKeys.forEach(function (key) {
    const value = nutrition[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Analysis returned an invalid " + key + " value.");
    result[key] = value;
  }); return result;
}
function buildSavePayload(metadata, nutrition, ingredients) {
  const payload = { ...metadata, method: method, nutrition: nutrition };
  if (method === "ingredients") payload.ingredients = ingredients;
  // No date/time from browser: backend assigns the authoritative timestamp on create.
  return payload;
}
function photoFormData(metadata, nutrition) {
  const form = new FormData(); form.append("photo", requirePhoto());
  form.append("name", metadata.name); form.append("mealType", metadata.mealType);
  form.append("method", "photo");
  if (nutrition) form.append("nutrition", JSON.stringify(nutrition));
  return form;
}
async function mealRequest(url, body, requestMethod = "POST") {
  const controller = new AbortController(); const timer = setTimeout(function () { controller.abort(); }, 60000);
  const isForm = body instanceof FormData;
  try {
    const headers = { Accept: "application/json", ...MEAL_API.getHeaders() };
    if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";
    if (isForm) { delete headers["Content-Type"]; delete headers["content-type"]; } // Browser supplies multipart boundary.
    const response = await fetch(url, { method: requestMethod, credentials: MEAL_API.credentials,
      headers: headers, signal: controller.signal, ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}) });
    let data = null; try { data = await response.json(); } catch (_) { /* May be an empty successful save response. */ }
    if (!response.ok) { const error = new Error("Meal request failed"); error.status = response.status; throw error; }
    if (data && data.success === false) throw new Error("The API reported that this request did not succeed.");
    if (!data && response.status !== 204) throw new Error("The API must return JSON or HTTP 204. Check that the URL points to your backend, not Live Server.");
    return data || {};
  } finally { clearTimeout(timer); }
}
function mealRequestError(error) {
  if (error.status === 401) return "Your session has expired. Please log in again.";
  if (error.status === 413) return "The server rejected this photo as too large.";
  if (error.status === 400 || error.status === 422) return "The server rejected some values. Check your meal details.";
  if (error.status === 429) return "Too many attempts. Please wait and try again.";
  if (error.status) return "Request failed (HTTP " + error.status + "). Please try again.";
  if (error.name === "AbortError") return "The request timed out. For a save request, check your History before submitting again.";
  if (error instanceof TypeError) return "Unable to reach the API. Check your backend URL, connection and CORS settings. If saving, check History before trying again.";
  return error.message || "Unable to complete this action.";
}
async function analyzeMeal() {
  if (busy || saved || method === "nutrition") return;
  clearMessages(); let url, body;
  try {
    const metadata = collectMetadata();
    if (method === "ingredients") {
      url = MEAL_API.analyzeIngredientsUrl;
      body = { ...metadata, ingredients: collectIngredients() };
    } else { url = MEAL_API.analyzePhotoUrl; body = photoFormData(metadata); }
    if (!url.trim()) throw new Error("Set the " + (method === "photo" ? "analyzePhotoUrl" : "analyzeIngredientsUrl") + " API URL in add-meal.js.");
  } catch (error) { mealError(error.message); return; }
  setBusy(true); mealMessage("Analyzing your meal…");
  try {
    const result = mapAnalysisResponse(await mealRequest(url, body));
    analysisNutrition = result;
    macroKeys.forEach(function (key) { field(key).value = String(result[key]); });
    updateCalculatedCalories();
    analysisReady = true; mealMessage("Review the estimated nutrition, then click Add Meal to save.");
  } catch (error) { analysisReady = false; field("meal-message").hidden = true; mealError(mealRequestError(error)); }
  finally { setBusy(false); }
}
async function saveMeal(event) {
  event.preventDefault(); if (busy || saved) return; clearMessages(); let body;
  try {
    const metadata = collectMetadata();
    if (method !== "nutrition" && !analysisReady) throw new Error("Analyze and review your meal before adding it.");
    const nutrition = collectNutrition();
    body = method === "photo" ? photoFormData(metadata, nutrition)
      : buildSavePayload(metadata, nutrition, method === "ingredients" ? collectIngredients() : undefined);
    if (!MEAL_API.saveUrl.trim()) throw new Error("Set MEAL_API.saveUrl to your meal-creation API URL in add-meal.js. No meal has been saved.");
  } catch (error) { mealError(error.message); return; }
  setBusy(true); mealMessage("Saving your meal…");
  try {
    await mealRequest(MEAL_API.saveUrl, body); saved = true;
    mealMessage("Meal saved successfully. Returning to your dashboard…");
    // Dashboard reload makes a fresh GET so totals reflect the saved meal.
    window.location.assign(MEAL_ROUTES.dashboard);
  } catch (error) { field("meal-message").hidden = true; mealError(mealRequestError(error)); }
  finally { setBusy(false); }
}
async function mealLogout() {
  if (busy || saved) return;
  if (!MEAL_API.logoutUrl.trim()) { mealError("Set the logout API URL. Your session has not been changed."); return; }
  setBusy(true);
  try { await mealRequest(MEAL_API.logoutUrl, undefined); window.location.assign(MEAL_ROUTES.login); }
  catch (error) { mealError(mealRequestError(error)); }
  finally { setBusy(false); }
}

// ===== 6. Events and initial view =====
document.querySelectorAll("[data-route]").forEach(function (link) { link.href = MEAL_ROUTES[link.dataset.route]; });
field("back-dashboard").href = MEAL_ROUTES.dashboard; field("cancel-meal").href = MEAL_ROUTES.dashboard;
document.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", function (event) { if (busy) event.preventDefault(); }); });
document.querySelectorAll("[data-method]").forEach(function (button) { button.addEventListener("click", function () { switchMethod(button.dataset.method); }); });
field("add-ingredient").addEventListener("click", function () { addIngredient(); });
field("analyze-meal").addEventListener("click", analyzeMeal); field("meal-form").addEventListener("submit", saveMeal);
macroKeys.forEach(function (key) { field(key).addEventListener("input", updateCalculatedCalories); });
field("meal-photo").addEventListener("change", function () { setPhoto(this.files[0]); });
field("remove-photo").addEventListener("click", function () { field("meal-photo").value = ""; setPhoto(null); });
field("logout").addEventListener("click", mealLogout);
const dropzone = field("photo-dropzone");
["dragenter", "dragover"].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); if (!busy) dropzone.classList.add("drag-over"); }); });
["dragleave", "drop"].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.remove("drag-over"); }); });
dropzone.addEventListener("drop", function (event) {
  if (busy || saved) return;
  const files = event.dataTransfer.files;
  if (files.length !== 1) { mealError("Choose one meal photo at a time."); return; }
  setPhoto(files[0]);
});
window.addEventListener("beforeunload", function (event) { if (busy) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("pagehide", function () { if (previewUrl) URL.revokeObjectURL(previewUrl); });
addIngredient(); updateModeUI(); updateCalculatedCalories();
