/* Protein icon: Lucide BicepsFlexed
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
"use strict";
// ===== 1. Put your API URLs here. No mock nutrition data is used. =====
const API_CONFIG = {
  dashboardUrl: "", // e.g. "http://localhost:3000/api/dashboard"
  userUrl: "",      // Optional: profile/gamification endpoint if not in dashboard response.
  logoutUrl: "",    // Optional POST endpoint for ending the real session.
  credentials: "include", // Cookie authentication.
  getHeaders: function () { return {}; }, // Bearer auth? Return { Authorization: "Bearer " + yourExistingToken }.
};
const PAGE_ROUTES = {
  dashboard: "dashboard.html", meals: "add-meal.html", addMeal: "add-meal.html",
  ai: "chatbot.html", history: "history.html", friends: "friends.html",
  profile: "profile.html", login: "login.html",
};
// If your account API uses different field names, change this one function.
// Supported example: {user:{username,streak,level,xp,xpTarget}}.
// Or: {user:{username,gamification:{streak,level,xp,xpTarget}}}.
function mapUserData(response) {
  const user = response.user || response.profile || response;
  const game = user.gamification || response.gamification || user;
  return { username: user.username, streak: game.streak, level: game.level,
    xp: game.xp, xpTarget: game.xpTarget };
}

// ===== 2. Small data helpers =====
const byId = function (id) { return document.getElementById(id); };
let dayData = [];
let availableDates = [];
let selectedDate = "";
let todayDate = "";
let loading = false;
const macroInfo = [
  { key: "protein", label: "Protein", icon: "protein-muscle" },
  { key: "carbs", label: "Carbs", icon: "bi-lightning" },
  { key: "fat", label: "Fat", icon: "bi-droplet" },
];
const vitaminInfo = [["vitaminA", "Vitamin A"], ["vitaminC", "Vitamin C"], ["vitaminD", "Vitamin D"], ["vitaminB12", "Vitamin B12"]];
const mineralInfo = [["calcium", "Calcium"], ["iron", "Iron"], ["magnesium", "Magnesium"], ["potassium", "Potassium"]];
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function formatNumber(value) {
  return numberOrNull(value) === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
function localDateString(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function dateFromString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = value.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return localDateString(date) === value ? date : null;
}
function longDate(value) {
  const date = dateFromString(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function lastSevenDates(anchor) {
  const result = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = dateFromString(anchor); date.setDate(date.getDate() - offset);
    result.push(localDateString(date));
  }
  return result;
}
function getDay(date) { return dayData.find(function (day) { return day.date === date; }) || null; }
function nutrientProgress(item) {
  if (!item || numberOrNull(item.consumed) === null || numberOrNull(item.target) === null || item.target === 0) return 0;
  const reported = numberOrNull(item.percentage);
  const percentage = reported === null ? item.consumed / item.target * 100 : reported;
  return Math.min(100, Math.max(0, percentage));
}
function nutrientStatus(item, unit) {
  if (!item || numberOrNull(item.consumed) === null || numberOrNull(item.target) === null) return { text: "Data unavailable", type: "" };
  if (item.target === 0) return { text: "No target set", type: "" };
  // Compute this from actual consumed/target: remaining may be capped at 0 by the API.
  const difference = Math.round((item.target - item.consumed) * 100) / 100;
  if (difference < 0) return { text: formatNumber(-difference) + " " + unit + " over target", type: "over" };
  if (difference === 0) return { text: "Target reached", type: "met" };
  return { text: formatNumber(difference) + " " + unit + " remaining", type: "" };
}
function setProgress(element, percent) {
  element.setAttribute("aria-valuenow", String(Math.round(percent)));
  element.querySelector("span").style.width = percent + "%";
}
function makeProgress(label, percent) {
  const track = document.createElement("div"); track.className = "progress-track";
  track.setAttribute("role", "progressbar"); track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", "0"); track.setAttribute("aria-valuemax", "100");
  track.append(document.createElement("span")); setProgress(track, percent); return track;
}
function statusElement(status) {
  const span = document.createElement("span"); span.className = "nutrition-status " + status.type;
  span.textContent = status.text; return span;
}
function showError(message) { byId("error-message").textContent = message; byId("error-message").hidden = false; }

// ===== 3. Render only real API values. textContent protects server text. =====
function renderUser(user) {
  byId("welcome").textContent = typeof user.username === "string" && user.username.trim()
    ? "Welcome back, " + user.username : "Your daily nutrition at a glance.";
  byId("streak").textContent = numberOrNull(user.streak) === null ? "Streak —" : formatNumber(user.streak) + " Day Streak";
  byId("level").textContent = numberOrNull(user.level) === null ? "Level —" : "Level " + formatNumber(user.level);
  byId("xp-text").textContent = formatNumber(user.xp) + " / " + formatNumber(user.xpTarget) + " XP";
  const validXP = numberOrNull(user.xp) !== null && numberOrNull(user.xpTarget) !== null && user.xpTarget > 0;
  setProgress(byId("xp-progress"), validXP ? Math.min(100, user.xp / user.xpTarget * 100) : 0);
}
function renderWeek() {
  const container = byId("week-days"); container.replaceChildren();
  byId("week-range").textContent = longDate(availableDates[0]) + " – " + longDate(todayDate);
  availableDates.forEach(function (date) {
    const day = getDay(date); const calendar = dateFromString(date);
    const button = document.createElement("button"); button.type = "button";
    button.className = "day-tile" + (date === selectedDate ? " selected" : "");
    button.setAttribute("aria-pressed", String(date === selectedDate));
    button.setAttribute("aria-label", longDate(date) + (date === todayDate ? ", Today" : ""));
    const weekday = document.createElement("span"); weekday.className = "weekday";
    weekday.textContent = calendar.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    const number = document.createElement("span"); number.className = "day-number"; number.textContent = calendar.getDate();
    const today = document.createElement("span"); today.className = "today-label"; today.textContent = date === todayDate ? "Today" : "";
    const calories = document.createElement("span"); calories.className = "day-calories";
    calories.textContent = formatNumber(day && day.calories ? day.calories.consumed : null) + " kcal";
    button.append(weekday, number, today, calories, makeProgress("Calories on " + longDate(date), nutrientProgress(day && day.calories)));
    button.addEventListener("click", function () { selectDay(date); }); container.append(button);
  });
}
function renderMacros(day) {
  const container = byId("macro-cards"); container.replaceChildren();
  macroInfo.forEach(function (info) {
    const item = day ? day[info.key] : null;
    const card = document.createElement("section"); card.className = "card";
    const heading = document.createElement("div"); heading.className = "macro-heading";
    const title = document.createElement("h2"); const icon = document.createElement("i");
    icon.setAttribute("aria-hidden", "true");
    if (info.key === "protein") {
      // Local arm/muscle icon: same green outline style, without a font dependency.
      icon.className = "protein-muscle-icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"/><path d="M15 14a5 5 0 0 0-7.584 2"/><path d="M9.964 6.825C8.019 7.977 9.5 13 8 15"/></svg>';
    } else { icon.className = "bi " + info.icon; }
    title.append(icon, document.createTextNode(info.label));
    const value = document.createElement("span"); value.className = "macro-value";
    const consumed = document.createElement("strong"); consumed.textContent = formatNumber(item && item.consumed);
    value.append(consumed, document.createTextNode(" / " + formatNumber(item && item.target) + " g"));
    heading.append(title, value); card.append(heading, makeProgress(info.label, nutrientProgress(item)), statusElement(nutrientStatus(item, "g")));
    container.append(card);
  });
}
function renderMicros(id, infos, data) {
  const container = byId(id); container.replaceChildren();
  infos.forEach(function (info) {
    const item = data ? data[info[0]] : null; const percent = nutrientProgress(item);
    const row = document.createElement("div"); row.className = "micro-row";
    const name = document.createElement("span"); name.textContent = info[1];
    const value = document.createElement("span"); value.className = "percentage";
    const hasData = item && numberOrNull(item.consumed) !== null && numberOrNull(item.target) !== null && item.target > 0;
    value.textContent = hasData ? Math.round(percent) + "%" : "—";
    // Hover exposes actual consumed/target numbers without inventing micronutrient units.
    row.title = info[1] + ": " + formatNumber(item && item.consumed) + " / " + formatNumber(item && item.target);
    row.append(name, makeProgress(info[1], percent), value); container.append(row);
  });
}
function updateRoutes() {
  document.querySelectorAll("[data-route]").forEach(function (link) {
    const key = link.dataset.route; let route = PAGE_ROUTES[key === "viewMeals" ? "history" : key];
    if (key === "viewMeals" && selectedDate) route += (route.includes("?") ? "&" : "?") + "date=" + encodeURIComponent(selectedDate);
    link.href = route;
  });
}
function selectDay(date) {
  if (!availableDates.includes(date)) return;
  selectedDate = date; const day = getDay(date); const calories = day ? day.calories : null;
  byId("selected-date").textContent = longDate(date);
  byId("previous-day").disabled = availableDates.indexOf(date) === 0;
  byId("next-day").disabled = date === todayDate; byId("today-button").disabled = date === todayDate;
  byId("calorie-consumed").textContent = formatNumber(calories && calories.consumed);
  byId("calorie-target").textContent = formatNumber(calories && calories.target);
  const percent = nutrientProgress(calories); const ring = byId("calorie-ring");
  ring.style.setProperty("--percentage", percent + "%"); ring.setAttribute("aria-valuenow", String(Math.round(percent)));
  const status = nutrientStatus(calories, "kcal"); byId("calorie-status").textContent = status.text;
  byId("calorie-status").className = "nutrition-status " + status.type;
  byId("meals-count").textContent = formatNumber(day && day.mealsCount);
  renderWeek(); renderMacros(day); renderMicros("vitamin-rows", vitaminInfo, day && day.vitamins);
  renderMicros("mineral-rows", mineralInfo, day && day.minerals); updateRoutes();
  byId("load-status").textContent = day ? "Showing " + longDate(date) : "No data returned for " + longDate(date) + ".";
}

// ===== 4. API requests and meaningful error states =====
async function apiRequest(url, method = "GET") {
  const controller = new AbortController(); const timer = setTimeout(function () { controller.abort(); }, 20000);
  try {
    const response = await fetch(url, { method: method, credentials: API_CONFIG.credentials,
      headers: { Accept: "application/json", ...API_CONFIG.getHeaders() }, signal: controller.signal });
    let data = null; try { data = await response.json(); } catch (_) { /* Handled below for GET. */ }
    if (!response.ok) { const error = new Error("API request failed"); error.status = response.status; throw error; }
    if (method === "GET" && (!data || typeof data !== "object")) throw new Error("The API must return JSON. Check that the URL points to your backend, not the Live Server page.");
    if (data && data.success === false) throw new Error("The API reported that this request did not succeed.");
    return data || {};
  } finally { clearTimeout(timer); }
}
function errorText(error) {
  if (error.status === 401) return "Your session has expired. Please log in again.";
  if (error.status === 403) return "You do not have permission to view this dashboard.";
  if (error.status === 429) return "Too many requests. Please try again shortly.";
  if (error.status) return "The API returned HTTP " + error.status + ". Please try again.";
  if (error.name === "AbortError") return "The request timed out. Please try again.";
  if (error instanceof TypeError) return "Unable to reach the API. Check the backend URL, connection and CORS settings.";
  return error.message || "Unable to load your dashboard.";
}
async function loadDashboard() {
  if (loading) return; loading = true;
  byId("dashboard-content").setAttribute("aria-busy", "true"); byId("refresh").disabled = true;
  byId("error-message").hidden = true; byId("load-status").textContent = "Loading your dashboard…";
  try {
    if (!API_CONFIG.dashboardUrl.trim()) throw new Error("Set API_CONFIG.dashboardUrl in dashboard.js to your dashboard API URL, then refresh.");
    const response = await apiRequest(API_CONFIG.dashboardUrl);
    if (!Array.isArray(response.days)) throw new Error("Expected {success:true, days:[...]} from your dashboard API.");
    const days = response.days.filter(function (day) { return day && dateFromString(day.date); });
    // Use the server's isToday date when available; otherwise use local calendar date.
    const serverToday = days.find(function (day) { return day.isToday === true; });
    const anchor = serverToday ? serverToday.date : localDateString(new Date());
    const dates = lastSevenDates(anchor);
    dayData = days; todayDate = anchor; availableDates = dates;
    renderUser(mapUserData(response));
    selectDay(dates.includes(selectedDate) ? selectedDate : todayDate);
    if (!days.length) byId("load-status").textContent = "No nutrition data returned. Log a meal to get started.";
    // Optional account request: failure must not erase successfully loaded nutrition data.
    if (API_CONFIG.userUrl.trim()) {
      try { renderUser(mapUserData(await apiRequest(API_CONFIG.userUrl))); }
      catch (error) { showError("Nutrition loaded, but account information could not be loaded. " + errorText(error)); }
    }
  } catch (error) {
    showError(errorText(error));
    byId("load-status").textContent = dayData.length ? "Refresh failed. Previously loaded values are still displayed." : "Dashboard not loaded.";
  } finally {
    loading = false; byId("refresh").disabled = false; byId("dashboard-content").setAttribute("aria-busy", "false");
  }
}
async function logout() {
  if (!API_CONFIG.logoutUrl.trim()) { showError("Set API_CONFIG.logoutUrl to your logout endpoint. Your session has not been changed."); return; }
  const button = byId("logout"); button.disabled = true;
  try { await apiRequest(API_CONFIG.logoutUrl, "POST"); window.location.assign(PAGE_ROUTES.login); }
  catch (error) { showError(errorText(error)); }
  finally { button.disabled = false; }
}
// ===== 5. Events and first request =====
byId("previous-day").addEventListener("click", function () { selectDay(availableDates[availableDates.indexOf(selectedDate) - 1]); });
byId("next-day").addEventListener("click", function () { selectDay(availableDates[availableDates.indexOf(selectedDate) + 1]); });
byId("today-button").addEventListener("click", function () { selectDay(todayDate); });
byId("refresh").addEventListener("click", loadDashboard); byId("logout").addEventListener("click", logout);
updateRoutes(); renderUser({}); renderMacros(null); renderMicros("vitamin-rows", vitaminInfo, null); renderMicros("mineral-rows", mineralInfo, null);
loadDashboard();
