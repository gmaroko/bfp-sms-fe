$(document).ready(function () {
  // helpers
  // parse jwt
  const parseJwt = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );

      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  // check jwt expiry
  const isTokenValid = (token) => {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) {
      return false;
    }
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  };

  // login api
  const loginUser = (username, password) => {
    const loginUrl = "http://localhost:9467/api/auth/login"; // move to env
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
        if (response.statusCode != "00") {
          alert(response.statusMessage);
        } else {
          console.log(response.data);
          sessionStorage.setItem("token", response.data.token);

          const deets = parseJwt(response.data.token);
          sessionStorage.setItem("username", deets.username);

          window.location.href = "index.html";
        }
      },
      error: function (xhr) {
        alert("Invalid username or password. Try again!");
      },
    });
  };

  // ---

  const token = sessionStorage.getItem("token");
  if (!token || token == null || token == "undefined" || token == undefined) {
    window.location.href = "login.html";
  } else {
    if (!isTokenValid(token)) {
      sessionStorage.removeItem("token");
      window.location.href = "login.html";
    }
  }

  // logout
  $("#logout-btn").on("click", (e) => {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = "login.html";
  });

  // login
  $("#loginForm").on("submit", (e) => {
    e.preventDefault();
    const username = $("#username").val();
    const password = $("#password").val();
    loginUser(username, password);
  });
});
