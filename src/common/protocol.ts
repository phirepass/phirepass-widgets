import { ErrorType } from 'phirepass-channel';

export type ProtocolMessageWebError = {
    kind: ErrorType;
    message: string;
    msg_id?: number;
    type: 'Error';
};

export type ProtocolMessageWebAuthSuccess = {
    cid: string;
    version: string;
    msg_id?: number;
    type: 'AuthSuccess';
};

export type ProtocolMessageWebTunnelOpened = {
    sid: number;
    msg_id?: number;
    type: 'TunnelOpened';
};

export type ProtocolMessageWebTunnelClosed = {
    sid: number;
    msg_id?: number;
    type: 'TunnelClosed';
};

export type ProtocolMessageWebTunnelData = {
    node_id: string;
    sid: number;
    data: Uint8Array;
    type: 'TunnelData';
};

/**
 * Answer to `open_rdp_tunnel`, in place of `TunnelOpened`.
 *
 * RDP bytes never cross the control socket: the browser's RDP client opens its
 * own WebSocket at `/api/web/rdp/{node_id}` and presents `ticket` inside its
 * RDCleanPath request, which is the only authorisation channel that client has.
 * The ticket is single-use and expires after 60s, so it has to be handed to the
 * client promptly.
 */
export type ProtocolMessageWebRDPAuthorized = {
    sid: number;
    ticket: string;
    msg_id?: number;
    type: 'RDPAuthorized';
};

export type SFTPListItem = {
    name: string;
    path: string;
    kind: 'Folder' | 'File';
    items: Array<SFTPListItem>;
    attributes: {
        size: number;
        uid: number;
        user: string;
        gid: number;
        group: string;
        permissions: number;
        atime: number;
        modified: number;
    };
};

export type ProtocolMessageWebSFTPListItems = {
    path: string;
    sid: number;
    dir: SFTPListItem;
    msg_id?: number;
    type: 'SFTPListItems';
};

export type ProtocolMessageWebSFTPDownloadStartResponse = {
    msg_id?: number;
    response: {
        download_id: number;
        total_size: number;
        total_chunks: number;
    };
    type: 'SFTPDownloadStartResponse';
};

export type ProtocolMessageWebSFTPDownloadChunk = {
    msg_id?: number;
    chunk: {
        chunk_index: number;
        chunk_size: number;
        data: number[];
    };
    type: 'SFTPDownloadChunk';
};

export type ProtocolMessageWebSFTPUploadStartResponse = {
    msg_id?: number;
    response: {
        upload_id: number;
    };
    type: 'SFTPUploadStartResponse';
};

/**
 * The answer to a one-shot filesystem operation — mkdir, rename, chmod, remove,
 * read, write. A failure comes back as a plain `Error` frame carrying the same
 * `msg_id` instead, so this type has no failure shape.
 *
 * `contents` is the raw bytes of the file, as a plain array over the wire.
 */
export type ProtocolMessageWebSFTPOpResult = {
    sid: number;
    msg_id?: number;
    result:
        | { result: 'Done' }
        | { result: 'FileContents'; path: string; contents: number[] | Uint8Array };
    type: 'SFTPOpResult';
};

export type ProtocolMessageWebSFTPUploadChunkAck = {
    msg_id?: number;
    upload_id: number;
    chunk_index: number;
    type: 'SFTPUploadChunkAck';
};

export type ProtocolMessage = {
    version: number;
    encoding: 'MessagePack' | 'JSON';
    data: {
        web:
            | ProtocolMessageWebError
            | ProtocolMessageWebAuthSuccess
            | ProtocolMessageWebTunnelOpened
            | ProtocolMessageWebTunnelData
            | ProtocolMessageWebTunnelClosed
            | ProtocolMessageWebRDPAuthorized
            | ProtocolMessageWebSFTPListItems
            | ProtocolMessageWebSFTPDownloadStartResponse
            | ProtocolMessageWebSFTPDownloadChunk
            | ProtocolMessageWebSFTPUploadStartResponse
            | ProtocolMessageWebSFTPUploadChunkAck
            | ProtocolMessageWebSFTPOpResult;
    };
};

export enum ProtocolMessageType {
    Error = 'Error',
    AuthSuccess = 'AuthSuccess',
    TunnelOpened = 'TunnelOpened',
    TunnelClosed = 'TunnelClosed',
    TunnelData = 'TunnelData',
    RDPAuthorized = 'RDPAuthorized',
    SFTPListItems = 'SFTPListItems',
    SFTPDownloadStartResponse = 'SFTPDownloadStartResponse',
    SFTPDownloadChunk = 'SFTPDownloadChunk',
    SFTPUploadStartResponse = 'SFTPUploadStartResponse',
    SFTPUploadChunkAck = 'SFTPUploadChunkAck',
    SFTPOpResult = 'SFTPOpResult',
}

export enum InputMode {
    Username,
    Password,
    Default,
}

export enum ConnectionState {
    Disconnected = 'disconnected',
    Connected = 'connected',
    Error = 'error',
}

export { ErrorType as ProtocolMessageError };
