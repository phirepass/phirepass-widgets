# phirepass-rdp



<!-- Auto Generated Below -->


## Overview

Remote desktop over RDP.

Unlike the terminal and SFTP widgets this one does not pipe protocol bytes
through the phirepass channel. The channel is used only to authorise the
session; the actual RDP stream runs on a second WebSocket opened by IronRDP's
own client, because that client speaks RDCleanPath and can set neither
headers nor a subprotocol on the socket it opens. See `RDP.md` in
`phirepass-rs` for why the session is split across two sockets.

## Properties

| Property                 | Attribute            | Description                                                                                                                                                                                                                                                                                                                                                             | Type                        | Default           |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------- |
| `allowInsecure`          | `allow-insecure`     |                                                                                                                                                                                                                                                                                                                                                                         | `boolean`                   | `false`           |
| `captureKeyboard`        | `capture-keyboard`   | While the widget is fullscreen, take the keys the browser normally keeps for itself (Ctrl+W, Ctrl+T, Alt+Tab, F11) and send them to the remote host instead. Escape is taken too, so leaving fullscreen becomes a press-and-hold.  Ordinary keys do not depend on this — they are forwarded whenever the desktop has focus.                                             | `boolean`                   | `true`            |
| `destination`            | `destination`        | What to name the host in the CredSSP service principal (`TERMSRV/...`).  The agent dials whatever the node's service settings say, so this is never used for routing. It matters only because some hosts check the SPN, and the browser has no other way to learn the host's real address.                                                                              | `string`                    | `undefined`       |
| `dynamicResize`          | `dynamic-resize`     | Ask the remote host to change its resolution to match the widget whenever the widget is resized, so the desktop is rendered at native size rather than scaled.  The host has the last word: this needs the display-control channel, and a host that does not offer it simply keeps the resolution it started with — which `scale` then fits into the widget, as before. | `boolean`                   | `true`            |
| `heartbeatInterval`      | `heartbeat-interval` |                                                                                                                                                                                                                                                                                                                                                                         | `number`                    | `30_000`          |
| `nodeId` _(required)_    | `node-id`            |                                                                                                                                                                                                                                                                                                                                                                         | `string`                    | `undefined`       |
| `password`               | `password`           |                                                                                                                                                                                                                                                                                                                                                                         | `string`                    | `undefined`       |
| `scale`                  | `scale`              | `fit` scales the desktop to the widget, `real` keeps 1:1 pixels.                                                                                                                                                                                                                                                                                                        | `"fit" \| "full" \| "real"` | `'fit'`           |
| `serverHost`             | `server-host`        |                                                                                                                                                                                                                                                                                                                                                                         | `string`                    | `"phirepass.com"` |
| `serverId`               | `server-id`          |                                                                                                                                                                                                                                                                                                                                                                         | `string`                    | `undefined`       |
| `serverPort`             | `server-port`        |                                                                                                                                                                                                                                                                                                                                                                         | `number`                    | `443`             |
| `serviceId` _(required)_ | `service-id`         |                                                                                                                                                                                                                                                                                                                                                                         | `string`                    | `undefined`       |
| `token` _(required)_     | `token`              |                                                                                                                                                                                                                                                                                                                                                                         | `string`                    | `undefined`       |
| `username`               | `username`           | Credentials for the remote host. When either is missing the widget prompts for both.  They serve two purposes at once: the agent checks them before it authorises the tunnel, and the browser uses them for CredSSP. The agent never logs in with them — it discards them once the tunnel is authorised.                                                                | `string`                    | `undefined`       |


## Events

| Event                    | Description | Type                                       |
| ------------------------ | ----------- | ------------------------------------------ |
| `connectionStateChanged` |             | `CustomEvent<[ConnectionState, unknown?]>` |


## Methods

### `focusDesktop() => Promise<void>`

Directs keystrokes at the remote desktop without waiting for a click.

#### Returns

Type: `Promise<void>`



### `keyboardLockSupported() => Promise<boolean>`

Whether the browser can hand over its reserved keys at all.

#### Returns

Type: `Promise<boolean>`



### `toggleFullscreen() => Promise<boolean>`

Puts the widget in and out of fullscreen, returning the state it settled
in. Fullscreen is also what makes `captureKeyboard` possible, so a host
app wanting the browser's own shortcuts to reach the remote desktop has
to come through here.

#### Returns

Type: `Promise<boolean>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
