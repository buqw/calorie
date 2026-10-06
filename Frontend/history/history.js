"use strict";
// Connect your backend here. The response contract is in HISTORY-README.txt.
const HISTORY_API = {
  historyUrl: "", // GET returns { success: true, meals: [...] }
  logoutUrl: "", // POST; use the same logout endpoint as your other pages.
  credentials: "include",
  getHeaders: function () { return {}; }, // Supply your existing auth headers.
};
const HISTORY_ROUTES = {
  dashboard: "dashboard.html", meals: "add-meal.html", ai: "chatbot.html",
  history: "history.html", friends: "friends.html", profile: "profile.html", login: "login.html",
};
const el = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
let currentRequest = null;
let requestNumber = 0;
function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}
function amount(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}
function shown(value, unit) { return value === null ? "—" : numberFormat.format(value) + (unit || ""); }
function localDateKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function dateLimits() {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(end); start.setHours(0, 0, 0, 0);
  const range = el("history-range").value;
  if (range !== "all") start.setDate(start.getDate() - (Number(range) - 1));
  return { start: range === "all" ? null : start, end };
}
function buildHistoryUrl() {
  const url = new URL(HISTORY_API.historyUrl, location.href);
  const limits = dateLimits();
  if (limits.start) url.searchParams.set("from", limits.start.toISOString());
  else url.searchParams.delete("from");
  url.searchParams.set("to", limits.end.toISOString());
  return url.toString();
}
// Adapt this function if your backend uses different field names.
function normalizeResponse(response) {
  if (!response || !Array.isArray(response.meals)) throw new Error("The history API must return a meals array.");
  return response.meals.map((meal) => {
    if (!meal || typeof meal !== "object") throw new Error("A meal record is invalid.");
    const timestamp = meal.createdAt || meal.loggedAt;
    // Require a timezone in API timestamps to avoid assigning meals to the wrong day.
    if (typeof timestamp !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) throw new Error("Each meal needs a valid createdAt timestamp with a timezone.");
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) throw new Error("A meal has an invalid timestamp.");
    const nutrition = meal.nutrition || {};
    return {
      name: typeof meal.name === "string" && meal.name.trim() ? meal.name : "Unnamed meal",
      mealType: typeof meal.mealType === "string" ? meal.mealType : "",
      date,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients.map((item) => typeof item === "string" ? item : item && typeof item.name === "string" ? item.name : "").filter(Boolean) : [],
      calories: amount(nutrition.calories), protein: amount(nutrition.protein), carbs: amount(nutrition.carbs), fat: amount(nutrition.fat),
    };
  });
}
function mealCard(meal) {
  const card = node("article", "meal-card");
  const symbol = node("span", "meal-symbol");
  symbol.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-food"/></svg>';
  const info = node("div", "meal-info");
  if (meal.mealType) info.append(node("span", "meal-type", meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)));
  info.append(node("h2", "", meal.name));
  if (meal.ingredients.length) {
    const ingredients = node("ul", "ingredients");
    ingredients.setAttribute("aria-label", "Ingredients");
    meal.ingredients.forEach((item) => ingredients.append(node("li", "", item)));
    info.append(ingredients);
  }
  const numbers = node("div", "meal-numbers");
  const top = node("div", "meal-topline");
  const time = node("time", "meal-time");
  time.dateTime = meal.date.toISOString();
  time.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>';
  time.append(document.createTextNode(meal.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })));
  top.append(time, node("strong", "meal-calories", shown(meal.calories, " kcal")));
  const macros = node("div", "meal-macros");
  for (const [key, label] of [["protein", "Protein"], ["carbs", "Carbs"], ["fat", "Fat"]]) {
    const chip = node("div", "macro-chip");
    chip.append(node("span", "", label), node("b", "", shown(meal[key], " g")));
    macros.append(chip);
  }
  numbers.append(top, macros); card.append(symbol, info, numbers);
  return card;
}
function renderHistory(meals) {
  const container = el("history-days");
  const previouslyOpen = new Set(Array.from(container.querySelectorAll("details[open]")).map((item) => item.dataset.date));
  const firstLoad = !container.children.length;
  const limits = dateLimits();
  const filtered = meals.filter((meal) => (!limits.start || meal.date >= limits.start) && meal.date <= limits.end);
  const groups = new Map();
  filtered.sort((a, b) => b.date - a.date).forEach((meal) => {
    const key = localDateKey(meal.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meal);
  });
  const today = localDateKey(new Date());
  const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);
  const fragment = document.createDocumentFragment();
  let index = 0;
  for (const [key, dayMeals] of groups) {
    const day = node("details", "history-day"); day.dataset.date = key;
    day.open = previouslyOpen.has(key) || (firstLoad && index === 0); index++;
    const summary = node("summary", "day-heading");
    const title = node("span", "day-title");
    const fullDate = dayMeals[0].date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    title.append(node("strong", "", key === today ? "Today" : key === yesterday ? "Yesterday" : fullDate));
    if (key === today || key === yesterday) title.append(node("small", "", fullDate));
    const total = node("span", "day-total");
    const knownCalories = dayMeals.every((meal) => meal.calories !== null);
    const calories = knownCalories ? dayMeals.reduce((sum, meal) => sum + meal.calories, 0) : null;
    total.append(node("span", "", dayMeals.length + (dayMeals.length === 1 ? " meal" : " meals")), node("b", "", shown(calories, " kcal")));
    summary.append(title, total);
    const list = node("div", "day-meals");
    dayMeals.sort((a, b) => a.date - b.date).forEach((meal) => list.append(mealCard(meal)));
    day.append(summary, list); fragment.append(day);
  }
  container.replaceChildren(fragment);
  el("history-empty").hidden = filtered.length !== 0;
  el("history-status").textContent = filtered.length + (filtered.length === 1 ? " meal" : " meals") + " across " + groups.size + (groups.size === 1 ? " day." : " days.");
}
async function loadHistory() {
  const sequence = ++requestNumber;
  if (currentRequest) currentRequest.abort();
  el("history-error").hidden = true;
  if (!HISTORY_API.historyUrl.trim()) {
    el("history-status").textContent = "History is not connected yet.";
    el("history-error").textContent = "Add your history API URL to HISTORY_API.historyUrl in history.js.";
    el("history-error").hidden = false;
    return;
  }
  currentRequest = new AbortController();
  const controller = currentRequest;
  const timer = setTimeout(() => controller.abort(), 30000);
  el("history-content").setAttribute("aria-busy", "true");
  el("refresh").disabled = true;
  el("history-status").textContent = "Loading your meal history…";
  try {
    const response = await fetch(buildHistoryUrl(), { method: "GET", credentials: HISTORY_API.credentials, headers: { Accept: "application/json", ...HISTORY_API.getHeaders() }, signal: controller.signal });
    const body = await response.json().catch(() => { throw new Error("The history API did not return JSON."); });
    if (!response.ok || body.success === false) throw new Error(typeof body.message === "string" ? body.message : "Could not load history (HTTP " + response.status + ").");
    if (sequence !== requestNumber) return;
    renderHistory(normalizeResponse(body));
  } catch (error) {
    if (sequence !== requestNumber) return;
    el("history-error").textContent = error.name === "AbortError" ? "The request timed out. Please try again." : error.message || "Could not load your history.";
    el("history-error").hidden = false;
    el("history-status").textContent = "History could not be refreshed.";
  } finally {
    clearTimeout(timer);
    if (sequence === requestNumber) {
      el("history-content").setAttribute("aria-busy", "false");
      el("refresh").disabled = false; currentRequest = null;
    }
  }
}
async function logout() {
  const button = el("logout");
  if (!HISTORY_API.logoutUrl.trim()) {
    el("history-error").textContent = "Connect your logout endpoint in HISTORY_API.logoutUrl.";
    el("history-error").hidden = false; return;
  }
  button.disabled = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(HISTORY_API.logoutUrl, { method: "POST", credentials: HISTORY_API.credentials, headers: HISTORY_API.getHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error("Could not log out. Please try again.");
    location.assign(HISTORY_ROUTES.login);
  } catch (error) {
    el("history-error").textContent = error.name === "AbortError" ? "Logout timed out. Please try again." : error.message;
    el("history-error").hidden = false;
  } finally { clearTimeout(timer); button.disabled = false; }
}
document.querySelectorAll("[data-route]").forEach((link) => { if (HISTORY_ROUTES[link.dataset.route]) link.href = HISTORY_ROUTES[link.dataset.route]; });
el("refresh").addEventListener("click", loadHistory);
el("history-range").addEventListener("change", loadHistory);
el("logout").addEventListener("click", logout);
loadHistory();
