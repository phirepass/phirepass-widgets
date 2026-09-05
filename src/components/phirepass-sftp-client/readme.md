# phirepass-sftp-client

A file manager for one SFTP service on one node. It speaks to the agent through
`phirepass-channel`, so it needs no API route of its own.

| Action | How it travels |
| --- | --- |
| Browse, with sorting and a per-directory filter | `SFTPList` / `SFTPListItems` |
| Download | chunked, with a credit window |
| Upload | chunked |
| New folder, rename, permissions, delete | one `SFTPOp`, answered once |
| Edit a text file in place | `SFTPOp::ReadFile` / `WriteFile`, 2 MiB cap |

Deleting a folder needs the recursive box ticked; without it the remote refuses
anything that is not empty. The editor refuses a file that is not valid UTF-8
rather than decoding it lossily and writing the damage back on save.

Keyboard, while the file table has focus: `Backspace` up a level, `F5` refresh,
`F2` rename, `Delete` delete, `Enter` open. `Escape` closes a dialog, and
`Ctrl`/`Cmd`+`S` saves in the editor.

The one-shot operations need an agent new enough to know the `SFTPOp` frames.
An older one drops them silently, so the widget's failure there is a timeout
that says the agent may be too old.

<!-- Auto Generated Below -->


## Properties

| Property                 | Attribute            | Description | Type      | Default           |
| ------------------------ | -------------------- | ----------- | --------- | ----------------- |
| `allowInsecure`          | `allow-insecure`     |             | `boolean` | `false`           |
| `description`            | `description`        |             | `string`  | `'Client'`        |
| `heartbeatInterval`      | `heartbeat-interval` |             | `number`  | `30_000`          |
| `hideHeader`             | `hide-header`        |             | `boolean` | `false`           |
| `name`                   | `name`               |             | `string`  | `'SFTP'`          |
| `nodeId` _(required)_    | `node-id`            |             | `string`  | `undefined`       |
| `serverHost`             | `server-host`        |             | `string`  | `"phirepass.com"` |
| `serverId`               | `server-id`          |             | `string`  | `undefined`       |
| `serverPort`             | `server-port`        |             | `number`  | `443`             |
| `serviceId` _(required)_ | `service-id`         |             | `string`  | `undefined`       |
| `token` _(required)_     | `token`              |             | `string`  | `undefined`       |


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
