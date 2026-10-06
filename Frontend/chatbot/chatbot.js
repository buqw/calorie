"use strict";
// Switch mode to "api" when your backend is ready. No OpenAI key belongs here.
const CHAT_CONFIG = {
  mode: "mock", // "mock" or "api"
  apiUrl: "/api/chat",
  logoutUrl: "",
  credentials: "include",
  getHeaders: function () { return {}; }, // Existing app authentication headers.
  timeoutMs: 30000,
};
const CHAT_ROUTES = {
  dashboard: "dashboard.html", meals: "add-meal.html", ai: "chatbot.html",
  history: "history.html", friends: "friends.html", profile: "profile.html", login: "login.html",
};
const element = (id) => document.getElementById(id);
let sending = false;
let failedMessage = null;
let failedPhoto = null;
let selectedPhoto = null;
let selectedPhotoUrl = null;
const messagePhotoUrls = [];
function clearSelectedPhoto() {
  if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
  selectedPhotoUrl = null; selectedPhoto = null;
  element("photo-input").value = "";
  element("camera-input").value = "";
  element("preview-image").removeAttribute("src");
  element("photo-preview").hidden = true;
  updateControls();
}
function selectPhoto(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showError("Choose a JPG, PNG or WebP image."); return;
  }
  if (!file.size || file.size > 10 * 1024 * 1024) {
    showError("Choose a nonempty image up to 10 MB."); return;
  }
  clearSelectedPhoto(); selectedPhoto = file;
  selectedPhotoUrl = URL.createObjectURL(file);
  element("preview-image").src = selectedPhotoUrl;
  element("photo-name").textContent = file.name;
  element("photo-preview").hidden = false;
  element("chat-error").hidden = true;
  updateControls();
}
function makeNode(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}
function scrollChat() {
  const chat = element("chat-messages");
  chat.scrollTop = chat.scrollHeight;
}
function appendMessage(role, text, photo = null) {
  const message = makeNode("div", "chat-message " + role);
  if (role === "assistant") {
    const avatar = makeNode("span", "ai-avatar", "✦"); avatar.setAttribute("aria-hidden", "true"); message.append(avatar);
  }
  const content = makeNode("div", "message-content");
  content.append(makeNode("span", "message-label", role === "user" ? "You" : "Calorie AI"), makeNode("div", "message-bubble", text));
  if (photo) {
    const image = makeNode("img", "message-photo");
    image.alt = "Meal photo attached by you";
    image.src = URL.createObjectURL(photo); messagePhotoUrls.push(image.src);
    image.addEventListener("load", scrollChat);
    content.children[1].prepend(image);
  }
  message.append(content); element("chat-messages").append(message); scrollChat();
  return message;
}
function appendLoading() {
  const message = makeNode("div", "chat-message assistant thinking");
  message.setAttribute("role", "status");
  const avatar = makeNode("span", "ai-avatar", "✦"); avatar.setAttribute("aria-hidden", "true");
  const content = makeNode("div", "message-content");
  content.append(makeNode("span", "message-label", "Calorie AI"));
  const bubble = makeNode("div", "message-bubble");
  const dots = makeNode("span", "typing-dots"); dots.setAttribute("aria-hidden", "true");
  dots.append(makeNode("i"), makeNode("i"), makeNode("i"));
  bubble.append(dots, makeNode("span", "", "Thinking…")); content.append(bubble);
  message.append(avatar, content); element("chat-messages").append(message); scrollChat(); return message;
}
function resizeInput() {
  const input = element("message-input"); input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 120) + "px";
}
function updateControls() {
  element("send-button").disabled = sending || (!element("message-input").value.trim() && !selectedPhoto);
  element("retry-button").disabled = sending;
  element("photo-input").disabled = sending;
  element("camera-input").disabled = sending;
  element("voice-input").disabled = sending;
  element("remove-photo").disabled = sending;
  document.querySelectorAll("[data-prompt]").forEach((button) => { button.disabled = sending; });
  element("chat-form").setAttribute("aria-busy", String(sending));
}
function mockReply(message) {
  const text = message.toLowerCase();
  if (/vegetarian|vegan|نبات/.test(text)) return "Demo suggestion: try tofu with brown rice and mixed vegetables, or a lentil bowl. Portion sizes would be tailored to your goals once the backend is connected.";
  if (/macro|carb|fat|ماكرو|كارب/.test(text)) return "Protein helps maintain and repair body tissues. Carbs provide energy, and fat supports normal body functions. In a basic calorie estimate, protein and carbs each provide 4 kcal per gram, and fat provides 9 kcal per gram. Your targets will come from your account when connected.";
  if (/protein|بروتين/.test(text)) return "Demo ideas: grilled chicken with rice, tofu with vegetables, Greek yogurt with oats, or a lentil salad. The connected assistant will consider your dietary preferences and disliked foods before recommending meals.";
  if (/dinner|eat|عشاء|اكل|أكل/.test(text)) return "Example only: if you had 550 calories remaining and still needed 45 g of protein, grilled chicken with vegetables and a portion of brown rice could be a dinner option. These numbers are demo data, not your current nutrition totals.";
  return "This is a demo response. You can ask for dinner ideas, high-protein meals, a vegetarian alternative, or an explanation of macros. When connected, Calorie AI will answer using the profile and nutrition information retrieved by your backend.";
}
async function requestReply(message, photo = null) {
  if (CHAT_CONFIG.mode === "mock") {
    await new Promise((resolve) => setTimeout(resolve, 850));
    return photo ? "Demo only: your photo is attached, but this mode does not analyze its contents. Once connected, the assistant can use the photo and your account goals to suggest what to add or reduce. You can also describe the meal and your question in the message." : mockReply(message);
  }
  if (CHAT_CONFIG.mode !== "api") throw new Error("Choose mock or api in CHAT_CONFIG.mode.");
  if (!CHAT_CONFIG.apiUrl.trim()) throw new Error("Add the chat backend URL in CHAT_CONFIG.apiUrl.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_CONFIG.timeoutMs);
  try {
    const headers = new Headers(CHAT_CONFIG.getHeaders());
    headers.set("Accept", "application/json");
    let payload;
    if (photo) {
      payload = new FormData();
      payload.append("message", message);
      payload.append("image", photo, photo.name);
      // Browser supplies the multipart boundary; never set this header manually.
      headers.delete("Content-Type");
    } else {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify({ message });
    }
    // Only user-entered message/image. Account context is retrieved by the backend.
    const response = await fetch(CHAT_CONFIG.apiUrl, {
      method: "POST", credentials: CHAT_CONFIG.credentials,
      headers, body: payload, signal: controller.signal,
    });
    const body = await response.json().catch(() => { throw new Error("The chat backend did not return JSON."); });
    if (!response.ok || body.success === false) throw new Error(typeof body.message === "string" ? body.message : "Could not send your message (HTTP " + response.status + ").");
    // Adapt this line if your backend uses a different response field.
    if (typeof body.reply !== "string" || !body.reply.trim()) throw new Error("The chat backend must return a nonempty reply string.");
    return body.reply;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The assistant took too long to respond. Please try again.");
    throw error;
  } finally { clearTimeout(timer); }
}
async function sendMessage(message, retry = false) {
  const text = message.trim();
  const photo = retry ? failedPhoto : selectedPhoto;
  if (sending || (!text && !photo)) return;
  if (text.length > 2000) { showError("Keep your message within 2,000 characters."); return; }
  if (voiceRecognition) voiceRecognition.stop();
  sending = true; failedMessage = null; failedPhoto = null;
  element("chat-error").hidden = true;
  if (!retry) {
    appendMessage("user", text, photo);
    clearSelectedPhoto();
    element("message-input").value = ""; resizeInput();
  }
  const loading = appendLoading(); updateControls();
  try {
    const reply = await requestReply(text, photo);
    loading.remove(); appendMessage("assistant", reply);
  } catch (error) {
    loading.remove(); failedMessage = text; failedPhoto = photo;
    showError(error.message || "Unable to reach the assistant. Please try again.");
  } finally {
    sending = false; updateControls();
  }
}
function showError(message) {
  element("error-text").textContent = message;
  element("retry-button").hidden = failedMessage === null;
  element("chat-error").hidden = false;
}
async function logout() {
  if (!CHAT_CONFIG.logoutUrl.trim()) { showError("Connect your logout endpoint in CHAT_CONFIG.logoutUrl."); return; }
  const button = element("logout"); button.disabled = true;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CHAT_CONFIG.timeoutMs);
  try {
    const response = await fetch(CHAT_CONFIG.logoutUrl, { method: "POST", credentials: CHAT_CONFIG.credentials, headers: CHAT_CONFIG.getHeaders(), signal: controller.signal });
    if (!response.ok) throw new Error("Could not log out. Please try again.");
    location.assign(CHAT_ROUTES.login);
  } catch (error) { showError(error.name === "AbortError" ? "Logout timed out. Please try again." : error.message); }
  finally { clearTimeout(timer); button.disabled = false; }
}
let voiceRecognition = null;
function resetVoiceControl() {
  element("voice-input").setAttribute("aria-pressed", "false");
  element("voice-label").textContent = "Voice Input";
}
function toggleVoice() {
  if (sending) return;
  if (voiceRecognition) { voiceRecognition.stop(); return; }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { showError("Voice input is not supported in this browser. You can type your message instead."); return; }
  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    if (sending) return;
    const text = Array.from(event.results).map((result) => result[0].transcript).join(" ");
    const input = element("message-input");
    input.value = (input.value + (input.value.trim() ? " " : "") + text).slice(0,2000);
    resizeInput(); updateControls();
  };
  recognition.onerror = (event) => {
    showError(event.error === "not-allowed" ? "Allow microphone access to use voice input." : "Voice input could not complete. Please try again or type your message.");
  };
  recognition.onend = () => { voiceRecognition = null; resetVoiceControl(); };
  try {
    recognition.start(); voiceRecognition = recognition;
    element("voice-input").setAttribute("aria-pressed", "true");
    element("voice-label").textContent = "Stop listening";
    element("chat-error").hidden = true;
  } catch (error) { resetVoiceControl(); showError("Could not start voice input. Please try again."); }
}
document.querySelectorAll("[data-route]").forEach((link) => { if (CHAT_ROUTES[link.dataset.route]) link.href = CHAT_ROUTES[link.dataset.route]; });
element("chat-form").addEventListener("submit", (event) => { event.preventDefault(); sendMessage(element("message-input").value); });
element("message-input").addEventListener("input", () => { resizeInput(); updateControls(); });
element("message-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(element("message-input").value); }
});
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => sendMessage(button.dataset.prompt)));
element("retry-button").addEventListener("click", () => { if (failedMessage !== null) sendMessage(failedMessage, true); });
element("logout").addEventListener("click", logout);
element("photo-input").addEventListener("change", () => selectPhoto(element("photo-input").files[0]));
element("camera-input").addEventListener("change", () => selectPhoto(element("camera-input").files[0]));
element("voice-input").addEventListener("click", toggleVoice);
element("remove-photo").addEventListener("click", clearSelectedPhoto);
window.addEventListener("pagehide", () => {
  if (voiceRecognition) voiceRecognition.abort();
  if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
  messagePhotoUrls.forEach((url) => URL.revokeObjectURL(url));
});
const demo = CHAT_CONFIG.mode === "mock";
element("chat-note").textContent = demo ? "Demo responses do not analyze photos. JPG, PNG or WebP up to 10 MB. Enter sends • Shift + Enter adds a new line." : "Attach JPG, PNG or WebP up to 10 MB. Enter sends • Shift + Enter adds a new line.";
appendMessage("assistant", demo ? "Hi! I can help you plan meals and understand your nutrition. This demo uses example responses. What would you like to know?" : "Hi! I can help you plan meals and understand your nutrition. What would you like to know?");
updateControls();
