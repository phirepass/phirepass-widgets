import { Component, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';

import svg from './phirepass-sftp-client.logo.svg';
import max from './phirepass-sftp-client.max.svg';
import chevron from './phirepass-sftp-client.chevron.svg';
import folder from './phirepass-sftp-client.folder.svg';
import file from './phirepass-sftp-client.file.svg';
import go_up from './phirepass-sftp-client.go_up.svg';
import refresh from './phirepass-sftp-client.refresh.svg';
import upload from './phirepass-sftp-client.upload.svg';

import {
    ConnectionState,
    ProtocolMessage,
    ProtocolMessageError,
    ProtocolMessageType,
    ProtocolMessageWebAuthSuccess,
    ProtocolMessageWebError,
    ProtocolMessageWebSFTPDownloadChunk,
    ProtocolMessageWebSFTPDownloadStartResponse,
    ProtocolMessageWebSFTPListItems,
    ProtocolMessageWebSFTPUploadChunkAck,
    ProtocolMessageWebSFTPUploadStartResponse,
    ProtocolMessageWebTunnelClosed,
    ProtocolMessageWebTunnelData,
    ProtocolMessageWebTunnelOpened,
    SFTPListItem,
} from '../../common/protocol';

type PendingUploadStart = {
    timeout: number;
    resolve: (uploadId: number) => void;
    reject: (err: Error) => void;
};

type PendingUploadAck = {
    timeout: number;
    resolve: () => void;
    reject: (err: Error) => void;
};

type PendingDownloadStart = {
    timeout: number;
    resolve: (payload: { download_id: number; total_size: number; total_chunks: number }) => void;
    reject: (err: Error) => void;
};

type ActiveDownload = {
    filename: string;
    chunks: Map<number, Uint8Array>;
    total_chunks: number;
    total_size: number;
    download_id: number;
    nextChunkToRequest: number;
    startTime: number;
};

type PendingDelete = {
    filename: string;
    msgId: number;
    startedAt: number;
    interval?: number;
};

// https://sweet-sftp-view.lovable.app/

@Component({
    tag: 'phirepass-sftp-client',
    styleUrl: 'phirepass-sftp-client.css',
    shadow: true,
})
export class PhirepassSftpClient {
    private channel!: PhirepassChannel;
    private domReady = false;
    private runtimeReady = false;
    private connected = false;
    private uploadInputEl?: HTMLInputElement;
    private deleteLoadingTimeout?: number;
    private msgId = 1;
    private activeUploadToken = 0;
    private pendingUploadStarts = new Map<number, PendingUploadStart>();
    private pendingUploadAcks = new Map<string, PendingUploadAck>();
    private pendingDownloadStarts = new Map<number, PendingDownloadStart>();
    private activeDownloads = new Map<number, ActiveDownload>();
    private activeDownloadMsgId?: number;
    private pendingDelete?: PendingDelete;
    // private inputMode: InputMode = InputMode.Default;

    private session_id?: number;
    // private usernameBuffer = "";
    // private passwordBuffer = "";

    @Prop()
    name = 'SFTP';

    @Prop()
    description = 'Client';

    @Prop()
    hideHeader = false;

    @Prop()
    serverHost = "phirepass.com";

    @Prop()
    serverPort = 443;

    @Prop()
    allowInsecure = false;

    @Prop()
    heartbeatInterval = 30_000;

    @Prop()
    nodeId!: string;

    @Prop()
    token!: string;

    @Watch('nodeId')
    onNodeIdChange(newValue?: string, _oldValue?: string) {
        // Handle the change in node_id here
        // console.log(`node_id changed from ${oldValue} to ${newValue}`);

        // Always clear local session state and reset terminal view
        this.reset_session_state();
        // this.terminal.reset();

        // Close existing comms if connected
        if (this.channel && this.channel.is_connected()) {
            this.close_comms();
        }

        // Open new comms for the updated node
        if (newValue) {
            this.open_comms();
            this.channel.connect();
            this.status = 'Connecting...';
        }
    }

    @Prop()
    serverId?: string;

    @Watch('serverId')
    onServerIdChange(_newValue?: string, _oldValue?: string) {
        this.onNodeIdChange(this.nodeId, this.nodeId);
    }

    @Event({
        eventName: 'maximize',
        composed: true,
        cancelable: true,
        bubbles: true,
    })
    maximizeEvent: EventEmitter<boolean> | undefined;

    @Method()
    async maximize() {
        this.max = !this.max;
    }

    @Method()
    async minimize() {
        this.max = false;
    }

    @Event({
        eventName: 'connectionStateChanged',
        composed: true,
        cancelable: true,
        bubbles: true,
    })
    connectionStateChanged!: EventEmitter<[ConnectionState, unknown?]>;

    @State()
    max = false;

    @State()
    show_login_screen = false;

    @State()
    show_login_screen_username = false;

    @State()
    show_error = false;

    @State()
    error_message = '';

    @State()
    show_login_screen_password = false;

    @State()
    show_navigation = false;

    @State()
    breadcrumbs: Array<{ label: string, path: string }> = [];

    @State()
    current_dir = '.';

    @State()
    listing: Array<SFTPListItem> = [];

    @State()
    show_content = false;

    @State()
    show_loader = false;

    @State()
    version = '';

    @State()
    status = 'Disconnected';

    @State()
    selected_item: SFTPListItem | null = null;

    @State()
    show_upload_modal = false;

    @State()
    upload_progress = 0;

    @State()
    upload_file_name = '';

    @State()
    upload_speed = '--';

    @State()
    upload_finished = false;

    @State()
    show_download_modal = false;

    @State()
    download_progress = 0;

    @State()
    download_file_name = '';

    @State()
    download_speed = '--';

    @State()
    download_finished = false;

    @State()
    show_delete_modal = false;

    @State()
    delete_file_name = '';

    @State()
    delete_loading = false;

    private toggle_max() {
        this.maximizeEvent?.emit(!this.max);
    }

    async connectedCallback() {
        await init();
        // this.setup_terminal();
        this.open_comms();
        this.runtimeReady = true;

        if (!this.nodeId) {
            console.warn('Prop node_id is not set. Cannot connect to terminal.');
            return;
        }

        this.try_connect();
    }

    componentDidLoad() {
        this.domReady = true;
        this.try_connect();
    }

    async disconnectedCallback() {
        // if (this.resizeDebounceHandle) {
        //     clearTimeout(this.resizeDebounceHandle);
        //     this.resizeDebounceHandle = undefined;
        // }
        //
        // if (this.resizeObserver) {
        //     this.resizeObserver.disconnect();
        // }

        this.connected = false;
        this.domReady = false;
        this.runtimeReady = false;
        this.cancel_active_upload();
        this.cancel_active_download();
        this.clear_pending_operations();
        this.clear_delete_loading_timeout();
        this.close_comms();
        // this.destroy_terminal();
    }

    private clear_delete_loading_timeout() {
        if (this.deleteLoadingTimeout !== undefined) {
            window.clearTimeout(this.deleteLoadingTimeout);
            this.deleteLoadingTimeout = undefined;
        }
    }

    private next_msg_id(): number {
        const id = this.msgId;
        this.msgId += 1;
        return id;
    }

    private clear_pending_operations() {
        this.pendingUploadStarts.forEach((pending) => {
            window.clearTimeout(pending.timeout);
            pending.reject(new Error('Upload start aborted'));
        });
        this.pendingUploadStarts.clear();

        this.pendingUploadAcks.forEach((pending) => {
            window.clearTimeout(pending.timeout);
            pending.reject(new Error('Upload chunk aborted'));
        });
        this.pendingUploadAcks.clear();

        this.pendingDownloadStarts.forEach((pending) => {
            window.clearTimeout(pending.timeout);
            pending.reject(new Error('Download start aborted'));
        });
        this.pendingDownloadStarts.clear();

        this.stop_delete_polling();

        this.activeDownloads.clear();
    }

    private stop_delete_polling() {
        if (this.pendingDelete?.interval !== undefined) {
            window.clearInterval(this.pendingDelete.interval);
        }
        this.pendingDelete = undefined;
    }

    private cancel_active_upload() {
        this.activeUploadToken += 1;
        this.upload_progress = 0;
        this.upload_finished = false;
        this.upload_speed = '--';
    }

    private cancel_active_download() {
        if (this.activeDownloadMsgId !== undefined) {
            this.activeDownloads.delete(this.activeDownloadMsgId);
        }
        this.activeDownloadMsgId = undefined;
        this.download_progress = 0;
        this.download_finished = false;
        this.download_speed = '--';
    }

    private format_duration(seconds: number): string {
        if (!Number.isFinite(seconds) || seconds < 0) {
            return '--';
        }

        if (seconds < 60) {
            return `${seconds.toFixed(0)}s`;
        }

        const minutes = Math.floor(seconds / 60);
        const remainderSeconds = Math.floor(seconds % 60);
        if (minutes < 60) {
            return `${minutes}m ${remainderSeconds}s`;
        }

        const hours = Math.floor(minutes / 60);
        const remainderMinutes = minutes % 60;
        return `${hours}h ${remainderMinutes}m`;
    }

    private format_percent(value: number): string {
        const safe = Number.isFinite(value) ? value : 0;
        return `${safe.toFixed(2)}%`;
    }

    private format_transfer_rate(bytesPerSecond: number): string {
        if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
            return '--';
        }

        return `${this.format_size(bytesPerSecond)}/s`;
    }

    private update_upload_progress(uploadedBytes: number, totalBytes: number, startTime: number) {
        const progress = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
        this.upload_progress = Math.max(0, Math.min(100, progress));

        if (uploadedBytes >= totalBytes) {
            this.upload_finished = true;
            this.upload_speed = '--';
            return;
        }

        const elapsedSeconds = (performance.now() - startTime) / 1000;
        const speed = elapsedSeconds > 0 ? uploadedBytes / elapsedSeconds : 0;
        this.upload_speed = this.format_transfer_rate(speed);
        const remaining = totalBytes - uploadedBytes;
        const eta = speed > 0 ? remaining / speed : NaN;
        this.status = `Uploading ${this.format_size(uploadedBytes)} / ${this.format_size(totalBytes)} (ETA ${this.format_duration(eta)})`;
    }

    private update_download_progress(receivedBytes: number, totalBytes: number, startTime: number) {
        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
        this.download_progress = Math.max(0, Math.min(100, progress));

        if (receivedBytes >= totalBytes) {
            this.download_finished = true;
            this.download_speed = '--';
            return;
        }

        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const speed = elapsedSeconds > 0 ? receivedBytes / elapsedSeconds : 0;
        this.download_speed = this.format_transfer_rate(speed);
        const remaining = totalBytes - receivedBytes;
        const eta = speed > 0 ? remaining / speed : NaN;
        this.status = `Downloading ${this.format_size(receivedBytes)} / ${this.format_size(totalBytes)} (ETA ${this.format_duration(eta)})`;
    }

    private connect() {
        this.connected = true;
        this.channel.connect();
        this.status = 'Connecting...';
        // const container = this.containerEl;
        // console.log('Attempting to connect terminal to container:', container);
        // if (container) {
        //     this.terminal.open(container);
        //     console.log('Terminal opened in container');
        //     this.connected = true;
        //     this.fit_terminal_safely();
        //     this.terminal.focus();
        //     this.terminal.onData(this.handle_terminal_data.bind(this));
        //     this.channel.connect();
        //     this.setup_resize_observer();
        //     console.log('Terminal connected and ready');
        // }
    }

    private try_connect() {
        if (this.connected || !this.domReady || !this.runtimeReady) {
            return;
        }

        if (!this.channel) {
            return;
        }

        this.connect();
    }

    private create_web_socket_endpoint(): string {
        const protocol = this.allowInsecure ? 'ws' : 'wss';

        if (!this.allowInsecure && this.serverPort === 443) {
            return `${protocol}://${this.serverHost}`;
        }

        if (this.allowInsecure && this.serverPort === 80) {
            return `${protocol}://${this.serverHost}`;
        }

        return `${protocol}://${this.serverHost}:${this.serverPort}`;
    }

    private handle_error(error: ProtocolMessageWebError) {
        if (error.msg_id !== undefined) {
            const pendingUploadStart = this.pendingUploadStarts.get(error.msg_id);
            if (pendingUploadStart) {
                window.clearTimeout(pendingUploadStart.timeout);
                pendingUploadStart.reject(new Error(error.message || 'Upload start failed'));
                this.pendingUploadStarts.delete(error.msg_id);
            }

            const pendingDownloadStart = this.pendingDownloadStarts.get(error.msg_id);
            if (pendingDownloadStart) {
                window.clearTimeout(pendingDownloadStart.timeout);
                pendingDownloadStart.reject(new Error(error.message || 'Download start failed'));
                this.pendingDownloadStarts.delete(error.msg_id);
            }

            if (this.activeDownloads.has(error.msg_id)) {
                this.activeDownloads.delete(error.msg_id);
                if (this.activeDownloadMsgId === error.msg_id) {
                    this.activeDownloadMsgId = undefined;
                }
                this.download_finished = false;
            }

            if (this.pendingDelete?.msgId === error.msg_id) {
                this.stop_delete_polling();
                this.delete_loading = false;
                this.show_delete_modal = false;
                this.status = 'Connected';
            }
        }

        switch (error.kind) {
            case ProtocolMessageError.Generic:
            case ProtocolMessageError.Authentication:
                this.error_message = error.message || 'An unknown error occurred.';
                this.show_error = true;
                break;
            case ProtocolMessageError.RequiresUsername:
                this.show_login_screen_username = true;
                this.show_login_screen_password = false;
                this.show_login_screen = true;
                break;
            case ProtocolMessageError.RequiresPassword:
                this.show_login_screen_username = false;
                this.show_login_screen_password = true;
                this.show_login_screen = true;
                break;
            case ProtocolMessageError.RequiresUsernamePassword:
                this.show_login_screen_username = true;
                this.show_login_screen_password = true;
                this.show_login_screen = true;
                break;
        }

        setTimeout(() => {
            this.show_loader = false;
        }, 1_000);
    }

    private handle_auth_success(auth: ProtocolMessageWebAuthSuccess) {
        this.clear_creds_buffer();
        this.version = auth.version;
        this.channel.start_heartbeat(this.heartbeatInterval <= 15_000 ? 30_000 : this.heartbeatInterval);
        this.channel.open_sftp_tunnel(this.nodeId);
        this.status = 'Connected';
    }

    private handle_tunnel_opened(web: ProtocolMessageWebTunnelOpened) {
        this.session_id = web.sid;
        // this.terminal.reset();
        // this.fit_terminal_safely();
        // this.send_ssh_terminal_resize();
        this.channel.send_sftp_list_data(this.nodeId, this.session_id!, this.current_dir);
    }

    private handle_sftp_list_items(web: ProtocolMessageWebSFTPListItems) {
        setTimeout(() => {
            this.show_loader = false;
        }, 500);

        this.listing = web.dir.items;
        this.current_dir = web.path;
        this.breadcrumbs = web.path.split('/').map((path, index, arr) => {
            if (path === '' && index === 0) {
                return { label: '/', path: '/' };
            }

            return { label: path, path: arr.slice(0, index + 1).join('/') };
        });

        this.show_content = true;
        this.show_navigation = true;

        if (this.pendingDelete && web.path === this.current_dir) {
            const fileStillExists = web.dir.items.some((item) => item.kind === 'File' && item.name === this.pendingDelete?.filename);
            if (!fileStillExists) {
                this.stop_delete_polling();
                this.delete_loading = false;
                this.show_delete_modal = false;
                this.delete_file_name = '';
                this.status = 'Connected';
            }
        }

        console.log('Received SFTP list items:', web);
    }

    private handle_upload_start_response(web: ProtocolMessageWebSFTPUploadStartResponse) {
        if (web.msg_id === undefined) {
            return;
        }

        const pending = this.pendingUploadStarts.get(web.msg_id);
        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeout);
        pending.resolve(web.response.upload_id);
        this.pendingUploadStarts.delete(web.msg_id);
    }

    private handle_upload_chunk_ack(web: ProtocolMessageWebSFTPUploadChunkAck) {
        const key = `${web.upload_id}_${web.chunk_index}`;
        const pending = this.pendingUploadAcks.get(key);
        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingUploadAcks.delete(key);
    }

    private handle_download_start_response(web: ProtocolMessageWebSFTPDownloadStartResponse) {
        if (web.msg_id === undefined) {
            return;
        }

        const pending = this.pendingDownloadStarts.get(web.msg_id);
        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeout);
        pending.resolve({
            download_id: web.response.download_id,
            total_size: web.response.total_size,
            total_chunks: web.response.total_chunks,
        });
        this.pendingDownloadStarts.delete(web.msg_id);
    }

    private request_next_download_chunk(msgId: number) {
        const download = this.activeDownloads.get(msgId);
        if (!download || !this.session_id) {
            return;
        }

        this.channel.send_sftp_download_chunk(
            this.nodeId,
            this.session_id,
            download.download_id,
            download.nextChunkToRequest,
            msgId,
        );
        download.nextChunkToRequest += 1;
    }

    private finalize_download(msgId: number) {
        const download = this.activeDownloads.get(msgId);
        if (!download) {
            return;
        }

        const sortedChunks = Array.from(download.chunks.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, data]) => data);

        // Normalize to fresh ArrayBuffer-backed views for BlobPart compatibility.
        const blobParts: BlobPart[] = sortedChunks.map((chunk) => new Uint8Array(chunk));

        const blob = new Blob(blobParts, { type: 'application/octet-stream' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = download.filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);

        this.activeDownloads.delete(msgId);
        if (this.activeDownloadMsgId === msgId) {
            this.activeDownloadMsgId = undefined;
        }

        this.download_finished = true;
        this.status = 'Connected';
    }

    private handle_download_chunk(web: ProtocolMessageWebSFTPDownloadChunk) {
        if (web.msg_id === undefined) {
            return;
        }

        const download = this.activeDownloads.get(web.msg_id);
        if (!download) {
            return;
        }

        const chunkData = new Uint8Array(web.chunk.data);
        download.chunks.set(web.chunk.chunk_index, chunkData);

        const receivedBytes = Array.from(download.chunks.values()).reduce((sum, data) => sum + data.length, 0);
        this.update_download_progress(receivedBytes, download.total_size, download.startTime);

        if (download.chunks.size >= download.total_chunks) {
            this.finalize_download(web.msg_id);
            return;
        }

        this.request_next_download_chunk(web.msg_id);
    }

    private async start_download(item: SFTPListItem) {
        if (!this.session_id) {
            return;
        }

        this.selected_item = item;
        this.download_file_name = item.name;
        this.download_progress = 0;
        this.download_finished = false;
        this.download_speed = '--';
        this.show_download_modal = true;
        this.show_error = false;

        const msgId = this.next_msg_id();
        this.activeDownloadMsgId = msgId;
        this.activeDownloads.set(msgId, {
            filename: item.name,
            chunks: new Map<number, Uint8Array>(),
            total_chunks: 0,
            total_size: 0,
            download_id: 0,
            nextChunkToRequest: 0,
            startTime: Date.now(),
        });

        const downloadStart = new Promise<{ download_id: number; total_size: number; total_chunks: number }>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                this.pendingDownloadStarts.delete(msgId);
                reject(new Error('Download start timeout'));
            }, 10_000);

            this.pendingDownloadStarts.set(msgId, {
                timeout,
                resolve,
                reject,
            });
        });

        try {
            this.channel.send_sftp_download_start(this.nodeId, this.session_id, item.path, item.name, msgId);
            const { download_id, total_chunks, total_size } = await downloadStart;

            const download = this.activeDownloads.get(msgId);
            if (!download) {
                return;
            }

            download.download_id = download_id;
            download.total_chunks = total_chunks;
            download.total_size = total_size;
            download.nextChunkToRequest = 0;

            this.request_next_download_chunk(msgId);
        } catch (err) {
            this.activeDownloads.delete(msgId);
            if (this.activeDownloadMsgId === msgId) {
                this.activeDownloadMsgId = undefined;
            }
            this.show_error = true;
            this.error_message = err instanceof Error ? err.message : 'Failed to start download';
            this.cancel_download();
        }
    }

    private async upload_file(fileToUpload: File) {
        if (!this.session_id) {
            return;
        }

        const uploadToken = this.activeUploadToken + 1;
        this.activeUploadToken = uploadToken;

        this.upload_file_name = fileToUpload.name;
        this.upload_progress = 0;
        this.upload_finished = false;
        this.upload_speed = '--';
        this.show_upload_modal = true;
        this.show_error = false;
        this.status = 'Uploading...';

        const chunkSize = 64 * 1024;
        const totalChunks = Math.max(1, Math.ceil(fileToUpload.size / chunkSize));
        const msgId = this.next_msg_id();

        const uploadStart = new Promise<number>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                this.pendingUploadStarts.delete(msgId);
                reject(new Error('Upload start timeout'));
            }, 10_000);

            this.pendingUploadStarts.set(msgId, {
                timeout,
                resolve,
                reject,
            });
        });

        try {
            this.channel.send_sftp_upload_start(
                this.nodeId,
                this.session_id,
                fileToUpload.name,
                this.current_dir,
                totalChunks,
                BigInt(fileToUpload.size),
                msgId,
            );

            const uploadId = await uploadStart;
            let uploadedBytes = 0;
            const startedAt = performance.now();

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
                if (uploadToken !== this.activeUploadToken) {
                    throw new Error('Upload cancelled');
                }

                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, fileToUpload.size);
                const chunkBuffer = new Uint8Array(await fileToUpload.slice(start, end).arrayBuffer());

                await new Promise<void>((resolve, reject) => {
                    const key = `${uploadId}_${chunkIndex}`;
                    const timeout = window.setTimeout(() => {
                        this.pendingUploadAcks.delete(key);
                        reject(new Error(`Upload chunk ${chunkIndex + 1} timed out`));
                    }, 30_000);

                    this.pendingUploadAcks.set(key, {
                        timeout,
                        resolve,
                        reject,
                    });

                    this.channel.send_sftp_upload_chunk(
                        this.nodeId,
                        this.session_id!,
                        uploadId,
                        chunkIndex,
                        chunkBuffer.length,
                        chunkBuffer,
                        null,
                    );
                });

                uploadedBytes += chunkBuffer.length;
                this.update_upload_progress(uploadedBytes, fileToUpload.size, startedAt);
            }

            this.upload_progress = 100;
            this.upload_finished = true;
            this.status = 'Connected';
            this.refresh_directory();
        } catch (err) {
            if ((err as Error).message !== 'Upload cancelled') {
                this.show_error = true;
                this.error_message = err instanceof Error ? err.message : 'Upload failed';
            }
            this.upload_finished = false;
            this.status = 'Connected';
        }
    }

    private handle_tunnel_data(web: ProtocolMessageWebTunnelData) {
        console.log('received tunnel data:', web);
    }

    private handle_tunnel_closed(_web_: ProtocolMessageWebTunnelClosed) {
        // this.session_id = undefined;
        // this.inputMode = InputMode.Default;

        this.clear_creds_buffer();

        // this.terminal.reset();
        // this.terminal.writeln("Connection closed.");

        this.close_comms();
    }

    private open_comms() {
        if (this.serverId) {
            this.channel = new PhirepassChannel(`${this.create_web_socket_endpoint()}/api/web/ws`, this.nodeId!, this.serverId!);
        } else {
            this.channel = new PhirepassChannel(`${this.create_web_socket_endpoint()}/api/web/ws`, this.nodeId!);
        }

        this.channel.on_connection_open(() => {
            this.connectionStateChanged.emit([ConnectionState.Connected]);
            this.channel.authenticate(this.token, this.nodeId);
            this.status = 'Authenticating...';
        });

        this.channel.on_connection_close(() => {
            this.connectionStateChanged.emit([ConnectionState.Disconnected]);
            this.status = 'Disconnected';
        });

        this.channel.on_connection_error((err: Error) => {
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
            this.status = 'Error ' + err.message;
        });

        this.channel.on_connection_message((_raw_: unknown) => {
            //
        });

        this.channel.on_protocol_message((msg: ProtocolMessage) => {
            const { web } = msg.data;
            switch (web.type) {
                case ProtocolMessageType.Error:
                    this.handle_error(web);
                    break;
                case ProtocolMessageType.AuthSuccess:
                    this.handle_auth_success(web);
                    break;
                case ProtocolMessageType.TunnelOpened:
                    this.handle_tunnel_opened(web);
                    break;
                case ProtocolMessageType.TunnelClosed:
                    this.handle_tunnel_closed(web);
                    break;
                case ProtocolMessageType.TunnelData:
                    this.handle_tunnel_data(web);
                    break;
                case ProtocolMessageType.SFTPListItems:
                    this.handle_sftp_list_items(web);
                    break;
                case ProtocolMessageType.SFTPUploadStartResponse:
                    this.handle_upload_start_response(web);
                    break;
                case ProtocolMessageType.SFTPUploadChunkAck:
                    this.handle_upload_chunk_ack(web);
                    break;
                case ProtocolMessageType.SFTPDownloadStartResponse:
                    this.handle_download_start_response(web);
                    break;
                case ProtocolMessageType.SFTPDownloadChunk:
                    this.handle_download_chunk(web);
                    break;
                default:
                    console.warn('Unhandled protocol message type:', web);
            }
        });
    }

    private close_comms() {
        this.cancel_active_upload();
        this.cancel_active_download();
        this.clear_pending_operations();

        if (!this.channel) {
            return;
        }

        this.channel.stop_heartbeat();
        this.channel.disconnect();
    }

    private clear_creds_buffer() {
        // this.usernameBuffer = "";
        // this.passwordBuffer = "";
    }

    private reset_session_state() {
        // this.session_id = undefined;
        // this.inputMode = InputMode.Default;
        this.clear_creds_buffer();
    }

    private list_breadcrumb(path: string) {
        this.show_loader = true;
        this.selected_item = null;
        this.channel.send_sftp_list_data(this.nodeId, this.session_id!, path);
    }

    private go_to_parent_directory() {
        if (!this.session_id) {
            return;
        }

        if (this.current_dir === '/') {
            return;
        }

        const parent = this.breadcrumbs[this.breadcrumbs.length - 2]?.path || '/';
        this.list_breadcrumb(parent);
    }

    private refresh_directory() {
        if (!this.session_id) {
            return;
        }

        this.list_breadcrumb(this.current_dir);
    }

    private disconnect_session() {
        this.close_comms();
        this.session_id = undefined;
        this.show_loader = false;
        this.show_content = false;
        this.breadcrumbs = [];
        this.current_dir = '.';
        this.listing = [];
        this.show_navigation = false;
        this.show_login_screen_username = false;
        this.show_login_screen_password = false;
        this.show_login_screen = false;
        this.show_upload_modal = false;
        this.show_download_modal = false;
        this.show_delete_modal = false;
        this.upload_progress = 0;
        this.download_progress = 0;
        this.upload_finished = false;
        this.download_finished = false;
        this.delete_loading = false;
        this.delete_file_name = '';
        this.version = '';
        this.status = 'Disconnected';
    }

    private on_file_row_action(item: SFTPListItem, event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        if (item.kind !== 'File') {
            return;
        }

        void this.start_download(item);
    }

    private on_file_delete_action(item: SFTPListItem, event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.selected_item = item;

        this.delete_file_name = item.name;
        this.delete_loading = false;
        this.show_delete_modal = true;
    }

    private cancel_delete() {
        if (this.delete_loading) {
            return;
        }

        this.show_delete_modal = false;
        this.delete_file_name = '';
        this.delete_loading = false;
        this.refresh_directory();
    }

    private confirm_delete() {
        if (this.delete_loading) {
            return;
        }

        if (!this.session_id || !this.selected_item) {
            this.show_delete_modal = false;
            return;
        }

        const fileToDelete = this.selected_item.name;

        this.delete_loading = true;
        this.status = 'Deleting...';
        this.show_error = false;

        this.stop_delete_polling();

        const msgId = this.next_msg_id();
        this.pendingDelete = {
            filename: fileToDelete,
            msgId,
            startedAt: Date.now(),
        };

        const pollOnce = () => {
            if (!this.pendingDelete) {
                return;
            }

            const elapsed = Date.now() - this.pendingDelete.startedAt;
            if (elapsed >= 30_000) {
                this.stop_delete_polling();
                this.delete_loading = false;
                this.show_delete_modal = false;
                this.show_error = true;
                this.error_message = `Delete timed out for "${fileToDelete}".`;
                this.status = 'Connected';
                return;
            }

            if (this.session_id) {
                this.channel.send_sftp_list_data(this.nodeId, this.session_id, this.current_dir);
            }
        };

        pollOnce();
        this.pendingDelete.interval = window.setInterval(pollOnce, 2_500);

        this.channel.send_sftp_delete(
            this.nodeId,
            this.session_id,
            this.current_dir,
            fileToDelete,
            msgId,
        );
    }

    private open_upload_picker() {
        this.uploadInputEl?.click();
    }

    private on_upload_selected(event: Event) {
        const input = event.target as HTMLInputElement;
        const selectedFile = input.files?.[0];

        if (!selectedFile) {
            return;
        }

        void this.upload_file(selectedFile);
        input.value = '';
    }

    private cancel_upload() {
        this.cancel_active_upload();
        this.show_upload_modal = false;
        this.upload_file_name = '';
        this.upload_speed = '--';
        this.status = 'Connected';
        this.refresh_directory();
    }

    private cancel_download() {
        this.cancel_active_download();
        this.show_download_modal = false;
        this.download_file_name = '';
        this.download_speed = '--';
        this.status = 'Connected';
        this.refresh_directory();
    }

    private is_selected(item: SFTPListItem): boolean {
        if (!this.selected_item) {
            return false;
        }

        return this.selected_item.path === item.path &&
            this.selected_item.name === item.name;
    }

    private list_directory(entry: SFTPListItem) {
        if (!this.session_id) {
            console.warn('No active session. Cannot list directory.');
            return;
        }

        if (entry.kind === 'File') {
            console.warn('Cannot list directory of a file. Ignoring click.');
            this.selected_item = entry;
            return;
        }

        const path = [entry.path, entry.name].join('/');
        if (path === this.current_dir) {
            console.warn('Already in this directory. Ignoring click.');
            return;
        }

        this.show_loader = true;
        this.selected_item = null;

        this.channel.send_sftp_list_data(this.nodeId, this.session_id!, path);
    }

    private format_size(size: number | undefined): string {
        if (size === undefined || Number.isNaN(size)) {
            return '-';
        }

        if (size < 1024) {
            return `${size} B`;
        }

        const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
        let value = size;
        let unitIndex = -1;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        const rounded = value >= 10 ? value.toFixed(1) : value.toFixed(2);
        return `${rounded} ${units[unitIndex]}`;
    }

    private mode_type_to_char(mode: number, kind?: SFTPListItem['kind']): string {
        const S_IFMT = 0o170000;
        const type = mode & S_IFMT;

        switch (type) {
            case 0o140000: return 's';
            case 0o120000: return 'l';
            case 0o100000: return '-';
            case 0o060000: return 'b';
            case 0o040000: return 'd';
            case 0o020000: return 'c';
            case 0o010000: return 'p';
            default:
                return kind === 'Folder' ? 'd' : '-';
        }
    }

    private format_permissions(permissions: number | string | undefined, kind?: SFTPListItem['kind']): string {
        if (permissions === undefined || permissions === null) {
            return '-';
        }

        if (typeof permissions === 'string') {
            const value = permissions.trim();

            if (/^[bcdlps-][rwxStTs-]{9}$/.test(value)) {
                return value;
            }

            if (/^[0-7]{3,4}$/.test(value)) {
                const mode = parseInt(value, 8);
                return this.format_permissions(mode, kind);
            }

            if (/^\d+$/.test(value)) {
                const mode = parseInt(value, 10);
                return this.format_permissions(mode, kind);
            }

            return value || '-';
        }

        const mode = permissions;
        const typeChar = this.mode_type_to_char(mode, kind);

        const chars = [
            mode & 0o400 ? 'r' : '-',
            mode & 0o200 ? 'w' : '-',
            mode & 0o100 ? 'x' : '-',
            mode & 0o040 ? 'r' : '-',
            mode & 0o020 ? 'w' : '-',
            mode & 0o010 ? 'x' : '-',
            mode & 0o004 ? 'r' : '-',
            mode & 0o002 ? 'w' : '-',
            mode & 0o001 ? 'x' : '-',
        ];

        if (mode & 0o4000) {
            chars[2] = chars[2] === 'x' ? 's' : 'S';
        }

        if (mode & 0o2000) {
            chars[5] = chars[5] === 'x' ? 's' : 'S';
        }

        if (mode & 0o1000) {
            chars[8] = chars[8] === 'x' ? 't' : 'T';
        }

        return `${typeChar}${chars.join('')}`;
    }

    render() {
        return (
            <Host class={{
                'default': !this.max,
                'max': this.max,
            }}>
                <section class="listing">
                    {!this.hideHeader &&
                        <header>
                            <section class="title">
                                <img src={svg} alt="SFTP Client" />
                                <div class="text">
                                    <div class="name">{this.name}</div>
                                    <div class="description">{this.description}</div>
                                </div>
                            </section>
                            <section class="actions">
                                <div class="action" onClick={() => this.toggle_max()}>
                                    <img src={max} alt="Maximize" />
                                </div>
                            </section>
                        </header>
                    }
                    <main>
                        {this.show_navigation && <nav class="navigation">
                            <div class="breadcrumbs">
                                {this.breadcrumbs.map((crumb, index, breadcrumbs) => (
                                    <span key={index} class="breadcrumb-container">
                                        <span key={index} onClick={() => this.list_breadcrumb(crumb.path)} class="breadcrumb">{crumb.label}</span>
                                        {index < breadcrumbs.length - 1 && <img class="arrow" src={chevron} />}
                                    </span>
                                ))}
                            </div>
                            <section class="actions" aria-label="SFTP actions">
                                <button type="button" class="action" onClick={() => this.go_to_parent_directory()} title="Go to parent directory" aria-label="Go to parent directory">
                                    <img src={go_up} alt="Go up" />
                                </button>
                                <button type="button" class="action" onClick={() => this.refresh_directory()} title="Refresh" aria-label="Refresh">
                                    <img src={refresh} alt="Refresh" />
                                </button>
                                <button type="button" class="action" onClick={() => this.open_upload_picker()} title="Upload" aria-label="Upload">
                                    <img src={upload} alt="Upload" />
                                </button>
                                <button type="button" class="action disconnect" onClick={() => this.disconnect_session()} title="Disconnect" aria-label="Disconnect">
                                    DISCONNECT
                                </button>
                            </section>
                        </nav>}
                        <input
                            type="file"
                            ref={(el) => this.uploadInputEl = el as HTMLInputElement}
                            onChange={(event) => this.on_upload_selected(event)}
                            style={{ display: 'none' }}
                        />
                        {this.show_content && <div class="content">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Size</th>
                                        <th>Permissions</th>
                                        <th>Owner</th>
                                        <th>Modified</th>
                                        <th class="action-col" aria-label="Actions"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {this.listing.map((item, index) => (
                                        <tr key={index} class={{
                                            'selected': this.is_selected(item),
                                        }} onClick={() => this.list_directory(item)}>
                                            <td>
                                                {item.kind === 'Folder' ? <img class="kind" src={folder} alt="Folder" /> : <img class="kind" src={file} alt="File" />}
                                                <span class={`name ${item.kind.toLowerCase()}`}>{item.name}</span>
                                            </td>
                                            <td>{this.format_size(item.attributes.size)}</td>
                                            <td>{this.format_permissions(item.attributes.permissions, item.kind)}</td>
                                            <td>{item.attributes.user ?? '-'}</td>
                                            <td>{new Date(item.attributes.modified * 1000).toLocaleString()}</td>
                                            <td class="action-col">
                                                {item.kind === 'File' &&
                                                    <div class="file-actions">
                                                        <button
                                                            type="button"
                                                            class="file-action"
                                                            onClick={(event) => this.on_file_row_action(item, event)}
                                                            title="Download"
                                                            aria-label="Download"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                <line x1="12" x2="12" y1="15" y2="3"></line>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="file-action delete"
                                                            onClick={(event) => this.on_file_delete_action(item, event)}
                                                            title="Delete"
                                                            aria-label="Delete"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                                                <line x1="10" x2="10" y1="11" y2="17"></line>
                                                                <line x1="14" x2="14" y1="11" y2="17"></line>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>}
                        {this.show_loader && <div class="loader">Loading...</div>}
                        {this.show_error && <div class="error">{this.error_message}</div>}
                    </main>
                    <footer>
                        <section class="version">{this.version ? `Version: ${this.version}` : ''}</section>
                    </footer>
                </section>
                {this.show_login_screen &&
                    <section class={{
                        'creds': true,
                        'blurred': this.show_login_screen,
                    }}>
                        <form class="auth" onSubmit={(event) => {
                            const formData = new FormData(event.target as HTMLFormElement);

                            let username = undefined;
                            if (this.show_login_screen_username) {
                                username = formData.get('username') as string;
                            }

                            let password = undefined;
                            if (this.show_login_screen_password) {
                                password = formData.get('password') as string;
                            }

                            this.channel.open_sftp_tunnel(this.nodeId, username, password);

                            this.show_login_screen_username = false;
                            this.show_login_screen_password = false;
                            this.show_login_screen = false;
                            this.show_loader = true;

                            event.stopPropagation();
                            event.preventDefault();
                        }}>
                            <div class="title">SFTP Connection</div>
                            {this.show_login_screen_username &&
                                <div>
                                    <label htmlFor="username">Username</label>
                                    <input autocorrect="off" autocapitalize="none" autoComplete="off" id="username" name="username" type="text" placeholder="" />
                                </div>
                            }
                            {this.show_login_screen_password &&
                                <div>
                                    <label htmlFor="password">Password</label>
                                    <input autocorrect="off" autocapitalize="none" autoComplete="off" id="password" name="password" type="password" placeholder="" />
                                </div>
                            }
                            <div>
                                <button type="submit">Connect</button>
                            </div>
                        </form>
                    </section>
                }
                {this.show_upload_modal &&
                    <section class={{
                        'upload-modal': true,
                        'visible': this.show_upload_modal,
                    }}>
                        <div class="upload-dialog" role="dialog" aria-modal="true" aria-label="Upload progress">
                            <div class="title">Uploading File</div>
                            <div class="file-name" title={this.upload_file_name}>{this.upload_file_name}</div>
                            <div class="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={this.upload_progress}>
                                <div class="progress-fill" style={{ width: `${this.upload_progress}%` }}></div>
                            </div>
                            <div class="progress-meta">
                                <div class="progress-speed">{this.upload_speed}</div>
                                <div class="progress-value">{this.format_percent(this.upload_progress)}</div>
                            </div>
                            <button
                                type="button"
                                class={{
                                    'cancel': true,
                                    'finished': this.upload_finished,
                                }}
                                onClick={() => this.cancel_upload()}
                            >
                                {this.upload_finished ? 'Close' : 'Cancel'}
                            </button>
                        </div>
                    </section>
                }
                {this.show_download_modal &&
                    <section class={{
                        'download-modal': true,
                        'visible': this.show_download_modal,
                    }}>
                        <div class="download-dialog" role="dialog" aria-modal="true" aria-label="Download progress">
                            <div class="title">Downloading File</div>
                            <div class="file-name" title={this.download_file_name}>{this.download_file_name}</div>
                            <div class="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={this.download_progress}>
                                <div class="progress-fill" style={{ width: `${this.download_progress}%` }}></div>
                            </div>
                            <div class="progress-meta">
                                <div class="progress-speed">{this.download_speed}</div>
                                <div class="progress-value">{this.format_percent(this.download_progress)}</div>
                            </div>
                            <button
                                type="button"
                                class={{
                                    'cancel': true,
                                    'finished': this.download_finished,
                                }}
                                onClick={() => this.cancel_download()}
                            >
                                {this.download_finished ? 'Close' : 'Cancel'}
                            </button>
                        </div>
                    </section>
                }
                {this.show_delete_modal &&
                    <section class={{
                        'delete-modal': true,
                        'visible': this.show_delete_modal,
                    }}>
                        <div class="delete-dialog" role="dialog" aria-modal="true" aria-label="Delete confirmation">
                            <div class="title">Delete File</div>
                            <div class="message">{this.delete_loading ? 'Deleting file...' : 'Are you sure you want to delete this file?'}</div>
                            <div class="file-name" title={this.delete_file_name}>{this.delete_file_name}</div>
                            {this.delete_loading &&
                                <div class="delete-loader" aria-hidden="true">
                                    <span class="spinner"></span>
                                </div>
                            }
                            <div class="modal-actions">
                                <button type="button" class="btn secondary" onClick={() => this.cancel_delete()} disabled={this.delete_loading}>Cancel</button>
                                <button type="button" class="btn destructive" onClick={() => this.confirm_delete()} disabled={this.delete_loading}>{this.delete_loading ? 'Deleting...' : 'Delete'}</button>
                            </div>
                        </div>
                    </section>
                }
            </Host>
        );
    }
}
