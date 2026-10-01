import type { Channel } from 'phirepass-channel';

/**
 * The part of `phirepass-channel`'s `Channel` the widgets actually call.
 *
 * Narrowed with `Pick` rather than written out so the signatures can never
 * drift from the WASM bindings: change a method there and every stand-in
 * stops compiling here.
 */
export type ChannelLike = Pick<
    Channel,
    | 'connect'
    | 'disconnect'
    | 'is_connected'
    | 'authenticate'
    | 'start_heartbeat'
    | 'stop_heartbeat'
    | 'on_connection_open'
    | 'on_connection_close'
    | 'on_connection_error'
    | 'on_connection_message'
    | 'on_protocol_message'
    | 'open_ssh_tunnel'
    | 'send_ssh_tunnel_data'
    | 'send_ssh_terminal_resize'
    | 'open_sftp_tunnel'
    | 'send_sftp_list_data'
    | 'send_sftp_download_start'
    | 'send_sftp_download_ack'
    | 'send_sftp_upload_start'
    | 'send_sftp_upload_chunk'
    | 'send_sftp_mkdir'
    | 'send_sftp_rename'
    | 'send_sftp_chmod'
    | 'send_sftp_remove'
    | 'send_sftp_read_file'
    | 'send_sftp_write_file'
>;

/**
 * Builds the channel a widget talks through, in place of a real `Channel`.
 *
 * This is the seam for anything that has to answer the widget without a
 * server — a demo, a screenshot, a test. The widget is unchanged either way: it
 * still authenticates, opens its tunnel and handles the same protocol messages,
 * so what renders is the real widget, not a look-alike. When a factory is given
 * the WASM module is never initialised, since nothing would use it.
 */
export type ChannelFactory = (endpoint: string, nodeId: string, serverId?: string) => ChannelLike;
