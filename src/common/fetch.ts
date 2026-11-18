/**
 * Remote Fetch: the browser side of `common/src/protocol/fetch.rs` and the
 * `Download*` web frames (codes 56–68).
 *
 * Shapes follow serde's defaults as the WASM channel hands them to JS: unit
 * enums by name, data-carrying enums externally tagged (`{ Http: { … } }`).
 * Unit enums that may grow end in `Unknown`, as on the Rust side, so a newer
 * server never breaks an older widget.
 *
 * A Rust `None` reaches JS as `undefined` (the field is absent), not `null`,
 * even where a type below says `| null`. Read optional fields with `??` or a
 * truthiness check, never `=== null`. Checked against the real channel build.
 */

/**
 * `msg_id`s `<phirepass-downloader>` mints start here, so a host sharing its
 * channel (the SFTP client) can tell which `Error` frames to hand over
 * without bookkeeping. `msg_id` is a u32 on the wire.
 */
export const DOWNLOADER_MSG_ID_BASE = 0x4000_0000;

/** Largest `.torrent` accepted from the browser. Mirrors `FETCH_TORRENT_MAX_BYTES`. */
export const FETCH_TORRENT_MAX_BYTES = 2 * 1024 * 1024;

export type FetchSource =
    | { Http: { url: string; save_as: string | null } }
    | { Magnet: { uri: string } }
    | { TorrentFile: { name: string; contents: Uint8Array } }
    | { TorrentPath: { path: string } }
    | { Node: { from_node: string; offer_id: string; name: string; size: number; sha256: Uint8Array } };

export type Browsing = { service_id: string; path: string };

export type FetchTarget = { sub_dir: string | null; browsing: Browsing | null };

export type SourceAuth =
    | { Basic: { username: string; password: string } }
    | { Bearer: { token: string } }
    | { Header: { name: string; value: string } };

export type FetchOptions = { source_auth: SourceAuth | null; ignore_window: boolean };

export type FetchKind = 'Http' | 'Torrent' | 'Node' | 'Unknown';
export type PauseReason = 'Window' | 'DiskFull' | 'Unknown';
export type FetchLock = 'None' | 'Organisation' | 'NoFolder' | 'Unknown';

export type FetchState =
    | 'Queued'
    | 'Scheduled'
    | 'Resolving'
    | 'FetchingMetadata'
    | 'Downloading'
    | 'Verifying'
    | 'Paused'
    | 'Retrying'
    | 'Seeding'
    | 'Completed'
    | 'Stopped'
    | 'Cancelled'
    | 'Deleted'
    | 'Unknown';

export type FetchFile = {
    index: number;
    name: string;
    size: number;
    done_bytes: number;
    media: boolean;
    /** Contiguous bytes from offset 0: how far a player can read without waiting. */
    ready_from_start: number;
};

export type FetchJob = {
    download_id: string;
    kind: FetchKind;
    name: string;
    dest_root: string;
    sub_dir: string | null;
    state: FetchState;
    done_bytes: number;
    total_bytes: number | null;
    down_bps: number;
    up_bps: number;
    peers: number;
    in_order: boolean;
    /** Unix ms. */
    started_at: number;
    finished_at: number | null;
    reason: string | null;
    requested_by: string | null;
    files: FetchFile[];
    up_total: number;
    pause_reason: PauseReason | null;
    seeding_since: number | null;
    info_hash: string | null;
    retry_reason: string | null;
    attempt: number;
    next_attempt_at: number | null;
    restarted_from_zero: boolean;
    /** Set by the server: a Delete was asked and the node has not answered yet. */
    deleting?: boolean;
};

export type FetchCaps = {
    http: boolean;
    torrents: boolean;
    private_targets: boolean;
    max_active: number;
    lock: FetchLock;
    folder: string | null;
    folder_free_bytes: number;
    agent_supported: boolean;
};

export type SubscribeScope = { Node: string } | 'All';

// ---- server → client frames ----

export type ProtocolMessageWebDownloadProgress = { type: 'DownloadProgress'; node_id: string; job: FetchJob };
export type ProtocolMessageWebDownloadAccepted = { type: 'DownloadAccepted'; msg_id: number; download_id: string };
export type ProtocolMessageWebDownloadWhereAnswer = { type: 'DownloadWhereAnswer'; msg_id: number; saves_to: string; mapped: boolean };
export type ProtocolMessageWebDownloadCaps = { type: 'DownloadCaps'; node_id: string; caps: FetchCaps };
export type ProtocolMessageWebDownloadFoldersAnswer = { type: 'DownloadFoldersAnswer'; msg_id: number; folders: string[] };

export type ProtocolMessageWebDownload =
    | ProtocolMessageWebDownloadProgress
    | ProtocolMessageWebDownloadAccepted
    | ProtocolMessageWebDownloadWhereAnswer
    | ProtocolMessageWebDownloadCaps
    | ProtocolMessageWebDownloadFoldersAnswer;

const DOWNLOAD_FRAME_TYPES = new Set(['DownloadProgress', 'DownloadAccepted', 'DownloadWhereAnswer', 'DownloadCaps', 'DownloadFoldersAnswer']);

/** True for the frames a host should hand to `<phirepass-downloader>`. */
export function isDownloadFrame(web: { type: string }): web is ProtocolMessageWebDownload {
    return DOWNLOAD_FRAME_TYPES.has(web.type);
}

/**
 * Header names a link login may not set: they belong to the transfer itself or
 * to the connection, and the agent refuses them too.
 */
export const DENIED_AUTH_HEADERS = new Set([
    'host',
    'content-length',
    'range',
    'if-range',
    'transfer-encoding',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'upgrade',
]);
