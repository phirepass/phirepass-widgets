import type { Channel } from 'phirepass-channel';
import type { Browsing, FetchOptions, FetchSource, SubscribeScope } from './fetch';

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

/**
 * The Remote Fetch methods (plan task T1.10). They are not in the published
 * `phirepass-channel` yet, so they are written out here rather than picked:
 * once the WASM build carries them, replace this with a `Pick` like the one
 * above so the two can never drift.
 *
 * Every id is the server-minted `download_id` (a uuid string). Each method that
 * expects an answer takes the `msg_id` the answer (or an `Error`) echoes.
 */
export interface DownloadChannelMethods {
    send_download_start(
        node_id: string,
        source: FetchSource,
        sub_dir: string | null,
        browsing: Browsing | null,
        in_order: boolean,
        options: FetchOptions,
        msg_id?: number | null,
    ): void;
    send_download_stop(download_id: string, discard: boolean, msg_id?: number | null): void;
    send_download_resume(download_id: string, ignore_window: boolean, msg_id?: number | null): void;
    send_download_set_order(download_id: string, in_order: boolean, msg_id?: number | null): void;
    send_download_delete(download_id: string, delete_file: boolean, msg_id?: number | null): void;
    send_download_subscribe(scope: SubscribeScope): void;
    send_download_where(node_id: string, browsing: Browsing, msg_id?: number | null): void;
    send_download_folders(node_id: string, sub_dir: string | null, msg_id?: number | null): void;
}

/** What `<phirepass-downloader>` needs from a channel: the connection plumbing plus the download events. */
export type DownloadChannelLike = Pick<
    ChannelLike,
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
> &
    Partial<DownloadChannelMethods>;

export type DownloadChannelFactory = (endpoint: string, nodeId: string, serverId?: string) => DownloadChannelLike;

const DOWNLOAD_METHODS: Array<keyof DownloadChannelMethods> = [
    'send_download_start',
    'send_download_stop',
    'send_download_resume',
    'send_download_set_order',
    'send_download_delete',
    'send_download_subscribe',
    'send_download_where',
];

/**
 * Whether this channel can speak Remote Fetch. A channel built from a
 * `phirepass-channel` release older than T1.10 cannot, and the widgets then
 * keep the feature out of sight instead of offering buttons that do nothing.
 * The folder picker's method is optional (phase 4) and checked where used.
 */
export function supportsDownloads(channel: unknown): channel is DownloadChannelLike & DownloadChannelMethods {
    if (!channel || typeof channel !== 'object') {
        return false;
    }
    return DOWNLOAD_METHODS.every(name => typeof (channel as Record<string, unknown>)[name] === 'function');
}
