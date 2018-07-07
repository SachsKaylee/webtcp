const WebTCP = require("../src");
const express = require("express");
const enableWebsockets = require("express-ws");

const PORT = 9999;

const app = express();
enableWebsockets(app);

const tcp = new WebTCP({ debug: true });
app.ws("/", (ws, req) => tcp.handle(ws, req));
app.listen(PORT, () => console.log(`webtcp Example running on ws port ${PORT}!`))