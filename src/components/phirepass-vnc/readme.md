# phirepass-vnc



<!-- Auto Generated Below -->


## Properties

| Property                 | Attribute            | Description                                                                | Type      | Default           |
| ------------------------ | -------------------- | -------------------------------------------------------------------------- | --------- | ----------------- |
| `allowInsecure`          | `allow-insecure`     |                                                                            | `boolean` | `false`           |
| `heartbeatInterval`      | `heartbeat-interval` |                                                                            | `number`  | `30_000`          |
| `nodeId` _(required)_    | `node-id`            |                                                                            | `string`  | `undefined`       |
| `resizeSession`          | `resize-session`     | Asks the VNC server to match its resolution to the widget size.            | `boolean` | `true`            |
| `scaleViewport`          | `scale-viewport`     | Scales the remote desktop to fit the widget instead of showing scrollbars. | `boolean` | `true`            |
| `serverHost`             | `server-host`        |                                                                            | `string`  | `"phirepass.com"` |
| `serverId`               | `server-id`          |                                                                            | `string`  | `undefined`       |
| `serverPort`             | `server-port`        |                                                                            | `number`  | `443`             |
| `serviceId` _(required)_ | `service-id`         |                                                                            | `string`  | `undefined`       |
| `token` _(required)_     | `token`              |                                                                            | `string`  | `undefined`       |


## Events

| Event                    | Description | Type                                       |
| ------------------------ | ----------- | ------------------------------------------ |
| `connectionStateChanged` |             | `CustomEvent<[ConnectionState, unknown?]>` |


----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
