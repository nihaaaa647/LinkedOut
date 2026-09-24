const axios = require("axios");
const { port } = require("./env");

const API_BASE = `http://127.0.0.1:${port}/api`;

// The EJS frontend is a genuine client of the REST API (not a bypass around it) - each
// view route builds one of these per request, forwarding the browser's session cookie
// in and any Set-Cookie the API returns (login/logout) back out to the browser.
function createApiClient(req, res) {
  const client = axios.create({
    baseURL: API_BASE,
    headers: req.headers.cookie ? { Cookie: req.headers.cookie } : {},
    validateStatus: () => true, // let view routes handle non-2xx themselves
  });

  client.interceptors.response.use((response) => {
    const setCookie = response.headers["set-cookie"];
    if (setCookie && res) res.set("Set-Cookie", setCookie);
    return response;
  });

  return client;
}

module.exports = { createApiClient, API_BASE };
