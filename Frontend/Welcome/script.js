"use strict";

// ===== 1. Authentication page routes =====
// Only the Welcome page is included in this project.
// After creating the other pages, replace null with their actual paths:
// login: "login.html", signup: "signup.html"
const routes = {
  login: null,
  signup: null,
};

// ===== 2. Button navigation =====
const actionMessage = document.querySelector("#action-message");
const actionButtons = document.querySelectorAll("[data-action]");

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    const destination = routes[action];

    if (destination) {
      window.location.assign(destination);
      return;
    }

    // Preview feedback until the real authentication pages are connected.
    const pageName = action === "login" ? "Login" : "Sign Up";
    actionMessage.textContent = `${pageName} page is not connected yet.`;
  });
});
