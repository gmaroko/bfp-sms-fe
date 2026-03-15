import { saveAuth, getToken, isTokenValid, logout } from "./utils/auth-util.js";

document.addEventListener("DOMContentLoaded", () => {

  const loginUrl = `${import.meta.env.VITE_API_BASE_URL}/auth/login`;

  const loginUser = (username, password) => {
    $.ajax({
      url: loginUrl,
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        username: username,
        password: password,
      }),

      success: function (response) {
        console.log(response);

        if (response.statusCode !== "00") {
          alert(response.statusMessage);
          return;
        }

        saveAuth(response.data.token);
        window.location.href = "/";
      },

      error: function () {
        alert("Invalid username or password. Try again!");
      },
    });
  };

  // check existing session
  const token = getToken();

  if (token && isTokenValid(token)) {
    window.location.href = "/";
  }

  // logout handler (if button exists)
  $("#logout-btn")?.on("click", (e) => {
    e.preventDefault();
    logout();
  });

  // login form submit
  $("#loginForm").on("submit", (e) => {
    e.preventDefault();

    const username = $("#username").val();
    const password = $("#password").val();

    loginUser(username, password);
  });

});