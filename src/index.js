const { Socket } = require("net");

/**
 * The numeric ready states of the WebSocket.
 */
const READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED_: 3
}

const defaultOptions = {
  // The options for this webtcp server instance
  debug: false,
  mayConnect: () => true,
  // Creates the connection/session object if you are using a non-default WebSocket implementation.
  createConnection: (ws, _req) => ({
    // Sends a JSON object over the WebSocket.
    send: data => ws.send(JSON.stringify(data)),
    // Checks if the socket is open. If this returns true, the server assumes that calling send will work.
    isOpen: () => ws.readyState === READY_STATE.OPEN,
    // Placeholder for the TCP socket. Simply set this to null unless you need to get really fancy.
    socket: null
  }),
  // The default options for the TCP socket
  defaultTcpOptions: {
    host: "localhost",
    port: 9998,
    encoding: "utf8",
    timeout: 0,
    noDelay: false,
    keepAlive: false,
    initialDelay: 0
  }
}
const SOCKET = "socket";

class WebTCP {
  constructor(options = {}) {
    this.options = {
      ...defaultOptions,
      ...options,
      // todo: set which of these values the client can adjust
      defaultTcpOptions: {
        ...defaultOptions.defaultTcpOptions,
        ...options.defaultTcpOptions
      }
    };
  }

  close(connection) {
    if (connection.socket) {
      this.options.debug && console.log("[webtcp] Closing connection");
      connection.socket.end();
    }
  }

  dispatch(connection, message) {
    try {
      const json = JSON.parse(message);
      this.options.debug && console.log("[webtcp] Got message", json, "has socket?", !!connection.socket);
      switch (json.type) {
        case "connect": {
          this.dispatchConnect(connection, json);
          break;
        }
        case "data": {
          this.dispatchData(connection, json);
          break;
        }
        case "close": {
          this.dispatchClose(connection, json);
          break;
        }
      }
    }
    catch (e) {
      console.log("error", e);
      connection.send({
        type: "error",
        error: e.message
      });
    }
  }

  dispatchClose(connection, json) {
    if (connection.socket) {
      this.close(connection);
    } else {
      connection.send({
        type: "error",
        error: "not connected"
      });
    }
  }

  dispatchData(connection, json) {
    if (connection.socket) {
      if (json.payload !== undefined) {
        const payload = typeof json.payload === "string"
          ? json.payload
          : Uint8Array.from(json.payload);
        connection.socket.write(payload, this.options.encoding);
      } else {
        connection.send({
          type: "error",
          error: "no payload"
        });
      }
    } else {
      connection.send({
        type: "error",
        error: "not connected"
      });
    }
  }

  dispatchConnect(connection, json) {
    if (!connection.socket) {
      const tcpOptions = {
        ...this.options.defaultTcpOptions,
        ...json
      }
      if (this.options.mayConnect({ host: tcpOptions.host, port: tcpOptions.port })) {
        const socket = connection.socket = new Socket();
        socket.connect(tcpOptions.port, tcpOptions.host, () => {
          socket.setEncoding(tcpOptions.encoding);
          socket.setTimeout(tcpOptions.timeout);
          socket.setNoDelay(tcpOptions.noDelay);
          socket.setKeepAlive(tcpOptions.keepAlive, tcpOptions.initialDelay);
        });
        socket.on("ready", () => {
          this.options.debug && console.log("[webtcp] Socket ready");
          connection.send({ type: "connect" });
        });
        socket.on("end", () => {
          this.options.debug && console.log("[webtcp] Socket end");
          if (connection.isOpen()) {
            connection.send({ type: "end" });
          }
        });
        socket.on("close", hadError => {
          connection.socket = null;
          this.options.debug && console.log("[webtcp] Socket closed", "error?", hadError);
          if (connection.isOpen()) {
            connection.send({
              type: "close",
              hadError
            });
          }
        });
        socket.on("timeout", () => {
          this.options.debug && console.log("[webtcp] Socket timeout");
          socket.destroy();
          connection.send({ type: "timeout" });
        });
        socket.on("error", (error) => {
          this.options.debug && console.log("[webtcp] Socket error", error);
          if (connection.isOpen()) {
            connection.send({
              type: "error",
              error: error.errno
            });
          }
        });
        socket.on("data", payload => {
          this.options.debug && console.log("[webtcp] Socket data", payload);
          connection.send({
            type: "data",
            // todo: forward binary data as array!
            payload: ("string" === typeof payload) ? payload : payload.toString(tcpOptions.encoding)
          });
        });
      } else {
        connection.send({
          type: "error",
          error: "not allowed connection"
        });
      }
    } else {
      connection.send({
        type: "error",
        error: "already connected"
      });
    }
  }

  handle(ws, req) {
    const connection = this.options.createConnection(ws, req);
    ws.on('message', message => this.dispatch(connection, message));
    ws.on("close", () => this.close(connection));
  }
}

module.exports = WebTCP;