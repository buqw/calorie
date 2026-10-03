"use strict";

// ===== 1. Authentication page routes =====
// Both routes point to the pages included in this project.
const routes = {
  login: "../login/login.html",
  signup: "../signup/signup.html",
};

// ===== 2. Button navigation =====
const actionMessage = document.querySelector("#action-message");
const actionButtons = document.querySelectorAll("[data-action]");

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    const destination = routes[action];

    if (destination) {
      window.location.href = destination;
      return;
    }

    // Preview feedback until the real authentication pages are connected.
    const pageName = action === "login" ? "Login" : "Sign Up";
    actionMessage.textContent = `${pageName} page is not connected yet.`;
  });
});
