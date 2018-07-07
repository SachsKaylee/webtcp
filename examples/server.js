const webtcp = require("../src");
const express = require("express");
const enableWebsockets = require("express-ws");

const PORT = 9999;

const app = express();
enableWebsockets(app);

app.ws("/", webtcp({ debug: true }));
app.listen(PORT, () => console.log(`webtcp Example running on ws port ${PORT}!`))