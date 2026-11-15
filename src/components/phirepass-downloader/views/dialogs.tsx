import { h } from '@stencil/core';
import { formatBytes } from '../format';
import { Row, folderOf, isFinished } from '../jobs';
import { Icon } from './icons';

export const Modal = ({ label, onClose, wide }: { label: string; onClose: () => void; wide?: boolean }, children: any) => (
    <div
        class="overlay"
        onClick={e => {
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}
    >
        <div
            class={{ modal: true, wide: !!wide }}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabindex={-1}
            onKeyDown={e => {
                if (e.key === 'Escape') {
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            {children}
        </div>
    </div>
);

type ConfirmBase = { onCancel: () => void; onConfirm: () => void };

const Footer = ({ cancel, confirm, danger, onCancel, onConfirm }: { cancel: string; confirm: string; danger?: boolean } & ConfirmBase) => (
    <div class="dlg-f">
        <button type="button" class="btn" onClick={onCancel}>
            {cancel}
        </button>
        <button type="button" class={{ btn: true, pri: !danger, dng: !!danger }} onClick={onConfirm}>
            {confirm}
        </button>
    </div>
);

/** K1: ✕ on an unfinished row. Unticked → Stopped (resumable); ticked → Cancelled. */
export const ConfirmStop = ({ row, discard, onDiscard, ...b }: { row: Row; discard: boolean; onDiscard: (v: boolean) => void } & ConfirmBase) => (
    <Modal label="Stop this download?" onClose={b.onCancel}>
        <div class="dlg">
            <h4>Stop this download?</h4>
            <div class="filechip">
                <Icon name="file" size={20} />
                <div>
                    <b>{row.name}</b>
                    <span>{row.total_bytes ? `${formatBytes(row.done_bytes)} of ${formatBytes(row.total_bytes)} downloaded` : `${formatBytes(row.done_bytes)} downloaded`}</span>
                </div>
            </div>
            <label class="checkline">
                <input type="checkbox" checked={discard} onChange={e => onDiscard((e.target as HTMLInputElement).checked)} />
                <span>
                    Also delete the part already downloaded
                    <span class="hint block">Leave this off and Resume continues from here.</span>
                </span>
            </label>
            <Footer cancel="Keep downloading" confirm="Stop download" danger {...b} />
        </div>
    </Modal>
);

/** K8: Delete on a finished, stopped or seeding row. */
export const ConfirmDelete = ({ row, deleteFile, onDeleteFile, nodeName, ...b }: { row: Row; deleteFile: boolean; onDeleteFile: (v: boolean) => void; nodeName: string } & ConfirmBase) => {
    const finished = isFinished(row.state);
    const size = row.files.length > 1 ? `${row.files.length} files · ${formatBytes(row.total_bytes ?? row.done_bytes)}` : formatBytes(row.total_bytes ?? row.done_bytes);
    return (
        <Modal label="Delete this download?" onClose={b.onCancel}>
            <div class="dlg">
                <h4>Delete this download?</h4>
                <div class="filechip">
                    <Icon name="file" size={20} />
                    <div>
                        <b>{row.name}</b>
                        <span>
                            {row.state === 'Seeding' ? 'Seeding · ' : ''}
                            {size} in {folderOf(row)}
                        </span>
                    </div>
                </div>
                {row.state === 'Seeding' && <p class="dtx">{nodeName} stops sharing it with peers.</p>}
                {finished ? (
                    <label class="checkline">
                        <input type="checkbox" checked={deleteFile} onChange={e => onDeleteFile((e.target as HTMLInputElement).checked)} />
                        <span>
                            Also delete the files
                            <span class="hint block">Off: the files stay in {folderOf(row)} and only the download is removed.</span>
                        </span>
                    </label>
                ) : (
                    <p class="dtx">The part already downloaded is deleted.</p>
                )}
                <Footer cancel="Cancel" confirm="Delete" danger {...b} />
            </div>
        </Modal>
    );
};

/** K9: switching a torrent that is playing to Fastest stops playback. */
export const ConfirmFastest = ({ row, ...b }: { row: Row } & ConfirmBase) => (
    <Modal label="Switch to fastest?" onClose={b.onCancel}>
        <div class="dlg">
            <h4>Switch to fastest?</h4>
            <p class="dtx">
                <b>{row.name}</b> is playing. Fastest downloads pieces in any order, so playback stops until it finishes or you switch back.
            </p>
            <Footer cancel="Keep in order" confirm="Switch and stop playback" danger {...b} />
        </div>
    </Modal>
);

/** K2: before the first magnet or .torrent on this browser. */
export const ConfirmTorrent = ({ nodeName, dontAsk, onDontAsk, ...b }: { nodeName: string; dontAsk: boolean; onDontAsk: (v: boolean) => void } & ConfirmBase) => (
    <Modal label={`Start a torrent on ${nodeName}?`} onClose={b.onCancel}>
        <div class="dlg">
            <h4>Start a torrent on {nodeName}?</h4>
            <div class="note warn">
                <Icon name="warn" size={14} />
                <div>The node will connect to public peers. They can see its internet address, and it uploads to them while it downloads.</div>
            </div>
            <p class="dtx">When it finishes, {nodeName} keeps sharing it with other peers until you delete it.</p>
            <label class="checkline">
                <input type="checkbox" checked={dontAsk} onChange={e => onDontAsk((e.target as HTMLInputElement).checked)} />
                <span>Do not ask again on this browser</span>
            </label>
            <Footer cancel="Cancel" confirm="Start torrent" {...b} />
        </div>
    </Modal>
);

/** K5: a notice, not a question. The node refused a Start that would not fit. */
export const NoSpace = ({ reason, onClose }: { reason: string; onClose: () => void }) => (
    <Modal label="Not enough space" onClose={onClose}>
        <div class="dlg">
            <h4>Not enough space</h4>
            <p class="dtx">{reason}</p>
            <div class="dlg-f">
                <button type="button" class="btn pri" onClick={onClose}>
                    OK
                </button>
            </div>
        </div>
    </Modal>
);

/** H6: folders inside the node's download folder, listed by the agent. */
export const FolderPicker = (p: {
    root: string;
    path: string[];
    folders: string[] | null;
    error?: string;
    newName: string | null;
    onOpen: (name: string) => void;
    onUp: (depth: number) => void;
    onNewName: (name: string | null) => void;
    onCancel: () => void;
    onSave: () => void;
}) => (
    <Modal label="Save downloads to" onClose={p.onCancel} wide>
        <div class="dlg">
            <h4>Save downloads to</h4>
            <nav class="crumbs" aria-label="Folder">
                <button type="button" class="lnk" onClick={() => p.onUp(0)}>
                    {p.root}
                </button>
                {p.path.map((seg, i) => [
                    <span class="sep">/</span>,
                    <button type="button" class="lnk" onClick={() => p.onUp(i + 1)}>
                        {seg}
                    </button>,
                ])}
            </nav>
            <div class="folders" role="list">
                {p.folders === null && <div class="muted">Loading…</div>}
                {p.folders?.length === 0 && <div class="muted">No folders here.</div>}
                {p.folders?.map(name => (
                    <button type="button" class="folder-row" role="listitem" onClick={() => p.onOpen(name)}>
                        <Icon name="folder" size={14} />
                        <span>{name}</span>
                    </button>
                ))}
            </div>
            {p.error && <div class="note err">{p.error}</div>}
            {p.newName !== null && (
                <input
                    class="inp"
                    type="text"
                    aria-label="New folder name"
                    placeholder="New folder name"
                    value={p.newName}
                    onInput={e => p.onNewName((e.target as HTMLInputElement).value)}
                />
            )}
            <p class="hint">Folders only, and only inside the node's download folder. A new folder is created by the node when the first download lands in it.</p>
            <div class="dlg-f">
                <button type="button" class="btn left" onClick={() => p.onNewName(p.newName === null ? '' : null)}>
                    <Icon name="plus" size={12} /> New folder
                </button>
                <button type="button" class="btn" onClick={p.onCancel}>
                    Cancel
                </button>
                <button type="button" class="btn pri" disabled={p.newName !== null && !/^[^/\\\0]+$/.test(p.newName.trim())} onClick={p.onSave}>
                    Save here
                </button>
            </div>
        </div>
    </Modal>
);
