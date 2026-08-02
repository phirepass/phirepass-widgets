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

| Property                 | Attribute            | Description                                                                                                                                                                                                                                                                                              | Type                        | Default           |
| ------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------- |
| `allowInsecure`          | `allow-insecure`     |                                                                                                                                                                                                                                                                                                          | `boolean`                   | `false`           |
| `destination`            | `destination`        | What to name the host in the CredSSP service principal (`TERMSRV/...`).  The agent dials whatever the node's service settings say, so this is never used for routing. It matters only because some hosts check the SPN, and the browser has no other way to learn the host's real address.               | `string`                    | `undefined`       |
| `heartbeatInterval`      | `heartbeat-interval` |                                                                                                                                                                                                                                                                                                          | `number`                    | `30_000`          |
| `nodeId` _(required)_    | `node-id`            |                                                                                                                                                                                                                                                                                                          | `string`                    | `undefined`       |
| `password`               | `password`           |                                                                                                                                                                                                                                                                                                          | `string`                    | `undefined`       |
| `scale`                  | `scale`              | `fit` scales the desktop to the widget, `real` keeps 1:1 pixels.                                                                                                                                                                                                                                         | `"fit" \| "full" \| "real"` | `'fit'`           |
| `serverHost`             | `server-host`        |                                                                                                                                                                                                                                                                                                          | `string`                    | `"phirepass.com"` |
| `serverId`               | `server-id`          |                                                                                                                                                                                                                                                                                                          | `string`                    | `undefined`       |
| `serverPort`             | `server-port`        |                                                                                                                                                                                                                                                                                                          | `number`                    | `443`             |
| `serviceId` _(required)_ | `service-id`         |                                                                                                                                                                                                                                                                                                          | `string`                    | `undefined`       |
| `token` _(required)_     | `token`              |                                                                                                                                                                                                                                                                                                          | `string`                    | `undefined`       |
| `username`               | `username`           | Credentials for the remote host. When either is missing the widget prompts for both.  They serve two purposes at once: the agent checks them before it authorises the tunnel, and the browser uses them for CredSSP. The agent never logs in with them — it discards them once the tunnel is authorised. | `string`                    | `undefined`       |


## Events

| Event                    | Description | Type                                       |
| ------------------------ | ----------- | ------------------------------------------ |
| `connectionStateChanged` |             | `CustomEvent<[ConnectionState, unknown?]>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
