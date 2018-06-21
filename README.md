# WebTCP 0.0.1 #

Inspired by the original WebTCP: [yankov/webtcp](https://github.com/yankov/webtcp)

WebTCP allows users to create a raw TCP socket using WebSockets.

Why a new library? The old library is abandoned, has too much functionality for being a raw TCP socket, and the code was hard to understand for me.

## How does it work ##

Client and server (bridge) communicate through a websocket connection. When the browser wants to create a TCP socket it sends a command to the bridge. The bridge creates a real TCP socket connection and maps all the events that happen on this socket to a client's socket object. For example, when data is received bridge will trigger a data event on according socket object on a browser side.

## Why would anyone need that ##

Sometimes an API does not provide a way to communicate through HTTP or WebSockets, in which case you need to resort to raw TCP.

## Can I use this in production? ##

**NO.** *Not without heavy security additions.*

This library allows users to leverage your server to create raw TCP sockets. They can literally do anything with that, all using your servers IP. 

You would have to limit which servers users adbility to connect to certain servers(`options.mayConnect`), properly encrypt the traffic both ways, etc.

This library is not battle tested and is primarily used for prototyping by me.

## Installing ##

Assuming you have `node.js` and `npm` installed:

**Clone the repo**  
```
git clone https://github.com/PatrickSachs/webtcp
```

**Install dependencies**  
```
cd webtcp
npm install
```

**Run WebTCP example server**  
```
cd examples
node server
```

Your WebTCP server will now be hosted on localhost:9999.

The library is not published to npm. If you want to use it as a dep in your project you'll have to manually add it to your package.json([See here for details](https://stackoverflow.com/questions/23210437/npm-install-private-github-repositories-by-dependency-in-package-json)).

## How to use it ##

### Client usage ###

Connect to the server using a WebSocket. 

```js
const socket = new WebSocket("localhost", 9999);
```

This WebSocket is now your TCP socket.

Before we can actually send data we need to connect to a TCP server:

```js
socket.send(JSON.stringify({
  type: "connect",
  host: "localhost",
  port: 8001
}));  
```

Assuming everything went smooth the bridge will respond with
```json
{
  "type": "connect"
}
```
Now we are ready to send data:

```js
// Binary payload
socket.send(JSON.stringify({
  type: "data",
  payload: [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]
}));  
// String payload
socket.send(JSON.stringify({
  type: "data",
  payload: "Hello World"
}));  
```

We once we are done, let's close the socket again:
```js
socket.send(JSON.stringify({
  type: "close"
})); 
```

This will also close the websocket.

## Events emitted by the bridge ##

### connect ###

Once we have connected to the server the connect event occurs.

```json
{
  "type": "connect"
}
```

### data ###

Sent when the socket recceived data.

```json
{
  "type": "data",
  "payload": "<string>"
}
```
### end ###

Sent when the other end closed the socket by sending a FIN packet.

```json
{
  "type": "end"
}
```

### close ###

Sent when the socket is closed. If hadError is true an eror event will be emitted aswell.

```json
{
  "type": "close",
  "hadError": "<boolean>"
}
```

### error ###

Sent when an error occurred. This typically closes the socket.

```json
{
  "type": "error",
  "error": "<string>"
}
```

### timeout ###

Sent when the socket timed out due to inactivity.

```json
{
  "type": "timeout"
}
```

## Events handled by the bridge ##

### connect ###

Used to connect to a TCP server.

```json
{
  "type": "connect",
  "host": "<string>",
  "port": "<number>",
  "encoding": "<string>",
  "timeout": "<number>",
  "noDelay": "<boolean>",
  "keepAlive": "<boolean>",
  "initialDelay": "<number>"
}
```

### close ###

Closes the TCP Socket & WebSocket.

```json
{
  "type": "close"
}
```

### data ###

Sends data. The payload can either be a string on an array of bytes(=numbers).

```json
{
  "type": "data",
  "payload": "<string | number[]>"
}
```

## Manually creating a server ##

```js
const WebTCP = require("webtcp");
// All options are optional. The following values are the default ones.
const server = new WebTCP({
  // The options for this webtcp server instance
  debug: false,
  mayConnect: ({host, port}) => true,
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
});
server.install();
```

## Contributing ##

Always welcome! Feel free to open issues and PRs as you wish, then we can talk about possible additions/fixes/changes.