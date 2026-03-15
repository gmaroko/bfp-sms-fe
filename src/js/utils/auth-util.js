export const parseJwt = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

export const isTokenValid = (token) => {
  const payload = parseJwt(token);
  if (!payload?.exp) return false;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
};

export const getToken = () => {
  return sessionStorage.getItem("token");
};

export const getUsername = () => {
  return sessionStorage.getItem("username");
};

export const saveAuth = (token) => {
  const payload = parseJwt(token);

  sessionStorage.setItem("token", token);
  sessionStorage.setItem("username", payload?.username);
};

export const logout = () => {
  sessionStorage.clear();
  window.location.href = "/login.html";
};

export const requireAuth = () => {
  const token = getToken();

  if (!token || !isTokenValid(token)) {
    logout();
  }

  return token;
};