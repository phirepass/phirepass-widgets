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

export type ProtocolMessage = {
    version: number;
    encoding: 'MessagePack' | 'JSON';
    data: {
        web: ProtocolMessageWebError | ProtocolMessageWebAuthSuccess | ProtocolMessageWebTunnelOpened | ProtocolMessageWebTunnelData | ProtocolMessageWebTunnelClosed;
    };
};

export enum ProtocolMessageType {
    Error = 'Error',
    AuthSuccess = 'AuthSuccess',
    TunnelOpened = 'TunnelOpened',
    TunnelClosed = 'TunnelClosed',
    TunnelData = 'TunnelData',
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
