# phirepass-sftp-client



<!-- Auto Generated Below -->


## Properties

| Property              | Attribute            | Description | Type      | Default           |
| --------------------- | -------------------- | ----------- | --------- | ----------------- |
| `allowInsecure`       | `allow-insecure`     |             | `boolean` | `false`           |
| `description`         | `description`        |             | `string`  | `'Client'`        |
| `heartbeatInterval`   | `heartbeat-interval` |             | `number`  | `30_000`          |
| `hideHeader`          | `hide-header`        |             | `boolean` | `false`           |
| `name`                | `name`               |             | `string`  | `'SFTP'`          |
| `nodeId` _(required)_ | `node-id`            |             | `string`  | `undefined`       |
| `serverHost`          | `server-host`        |             | `string`  | `"phirepass.com"` |
| `serverId`            | `server-id`          |             | `string`  | `undefined`       |
| `serverPort`          | `server-port`        |             | `number`  | `443`             |
| `token` _(required)_  | `token`              |             | `string`  | `undefined`       |


## Events

| Event                    | Description | Type                                       |
| ------------------------ | ----------- | ------------------------------------------ |
| `connectionStateChanged` |             | `CustomEvent<[ConnectionState, unknown?]>` |
| `maximize`               |             | `CustomEvent<any>`                         |


## Methods

### `maximize() => Promise<void>`



#### Returns

Type: `Promise<void>`



### `minimize() => Promise<void>`



#### Returns

Type: `Promise<void>`




----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
