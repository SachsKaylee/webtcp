const { Socket } = require("net");
const WebSocket = require("ws");

const defaultOptions = {
  // The options for this webtcp server instance
  debug: false,
  mayConnect: () => true,
  // The options for the websocket server - https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback
  socketOptions: {
    port: 9999
  },
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
const SOCKET = Symbol("webtcp-socket");

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
    if (connection[SOCKET]) {
      this.options.debug && console.log("[webtcp] Closing connection");
      connection[SOCKET].end();
    }
  }

  dispatch(connection, message) {
    try {
      const json = JSON.parse(message);
      this.options.debug && console.log("[webtcp] Got message", json, "has socket?", !!connection[SOCKET]);
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
      connection.write({
        type: "error",
        error: e.message
      });
    }
  }

  dispatchClose(connection, json) {
    if (connection[SOCKET]) {
      this.close(connection);
    } else {
      connection.write({
        type: "error",
        error: "not connected"
      });
    }
  }

  dispatchData(connection, json) {
    if (connection[SOCKET]) {
      if (json.payload !== undefined) {
        const payload = typeof json.payload === "string"
          ? json.payload
          : Uint8Array.from(json.payload);
        connection[SOCKET].write(payload, this.options.encoding);
      } else {
        connection.write({
          type: "error",
          error: "no payload"
        });
      }
    } else {
      connection.write({
        type: "error",
        error: "not connected"
      });
    }
  }

  dispatchConnect(connection, json) {
    if (!connection[SOCKET]) {
      const tcpOptions = {
        ...this.options.defaultTcpOptions,
        ...json
      }
      if (this.options.mayConnect({ host: tcpOptions.host, port: tcpOptions.port })) {
        const socket = connection[SOCKET] = new Socket();
        socket.connect(tcpOptions.port, tcpOptions.host, () => {
          socket.setEncoding(tcpOptions.encoding);
          socket.setTimeout(tcpOptions.timeout);
          socket.setNoDelay(tcpOptions.noDelay);
          socket.setKeepAlive(tcpOptions.keepAlive, tcpOptions.initialDelay);
        });
        socket.on("ready", () => {
          this.options.debug && console.log("[webtcp] Socket ready");
          connection.write({ type: "connect" });
        });
        socket.on("end", () => {
          this.options.debug && console.log("[webtcp] Socket end");
          if (connection.isOpen()) {
            connection.write({ type: "end" });
          }
        });
        socket.on("close", hadError => {
          delete connection[SOCKET];
          this.options.debug && console.log("[webtcp] Socket closed", "error?", hadError);
          if (connection.isOpen()) {
            connection.write({
              type: "close",
              hadError
            });
          }
        });
        socket.on("timeout", () => {
          this.options.debug && console.log("[webtcp] Socket timeout");
          socket.destroy();
          connection.write({ type: "timeout" });
        });
        socket.on("error", (error) => {
          this.options.debug && console.log("[webtcp] Socket error", error);
          if (connection.isOpen()) {
            connection.write({
              type: "error",
              error: error.errno
            });
          }
        });
        socket.on("data", payload => {
          this.options.debug && console.log("[webtcp] Socket data", payload);
          connection.write({
            type: "data",
            // todo: forward binary data as array!
            payload: ("string" === typeof payload) ? payload : payload.toString(tcpOptions.encoding)
          });
        });
      } else {
        connection.write({
          type: "error",
          error: "not allowed connection"
        });
      }
    } else {
      connection.write({
        type: "error",
        error: "already connected"
      });
    }
  }

  // todo: allow express integration
  install() {
    this.websocket = new WebSocket.Server(this.options.socketOptions);
    this.websocket.on('connection', ws => {
      const connection = {
        write: data => ws.send(JSON.stringify(data)),
        isOpen: () => ws.readyState === WebSocket.OPEN
      };
      console.log("readyState", ws.readyState)
      ws.on('message', message => this.dispatch(connection, message));
      ws.on("close", () => this.close(connection));
    });
    this.options.debug && console.log("[webtcp] Listening", this.options.socketOptions);
  }
}

module.exports = WebTCP;