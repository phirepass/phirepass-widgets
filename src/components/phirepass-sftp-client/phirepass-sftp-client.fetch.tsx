import { h } from '@stencil/core';
import { Icon } from '../phirepass-downloader/views/icons';

/**
 * The SFTP browser's side of Remote Fetch, kept out of the component so it
 * stays a host and nothing more: the downloads themselves are the
 * `<phirepass-downloader>`'s, and nothing here goes over SFTP.
 */

export const PART_SUFFIX = '.phirepass-part';

export function isPartFile(name: string): boolean {
    return name.endsWith(PART_SUFFIX);
}

const PLAYABLE = /\.(mp4|m4v|webm|mkv|mov|mp3|m4a|flac|ogg|oga|opus|wav)$/i;

export function isPlayableFile(name: string): boolean {
    return PLAYABLE.test(name) && !isPartFile(name);
}

function normalize(path: string): string {
    const p = path.replace(/\/{2,}/g, '/');
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/** Whether a finished download's folder is the one on screen. */
export function sameFolder(a: string, b: string): boolean {
    return normalize(a) === normalize(b);
}

export function folderOfCompleted(detail: { dest_root: string; sub_dir: string | null }): string {
    return normalize(detail.sub_dir ? `${detail.dest_root}/${detail.sub_dir}` : detail.dest_root);
}

export const FetchButton = ({ count, onClick }: { count: number; onClick: () => void }) => (
    <button type="button" class="action fetch" onClick={onClick} title="Fetch from a link, magnet or torrent" aria-label="Fetch from a link, magnet or torrent">
        <Icon name="fetch" size={14} />
        {count > 0 && (
            <span class="badge" aria-label={`${count} active`}>
                {count}
            </span>
        )}
    </button>
);

/** K3: replaces the plain delete prompt for a part file that belongs to a running download. */
export const PartDeleteDialog = ({ name, busy, onCancel, onConfirm }: { name: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) => (
    <section class="delete-modal visible">
        <div
            class="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="This file is still downloading"
            tabindex={-1}
            onKeyDown={e => {
                if (e.key === 'Escape') {
                    onCancel();
                }
            }}
        >
            <div class="title">This file is still downloading</div>
            <div class="message">
                Deleting <span class="file-name inline">{name}</span> deletes its download.
            </div>
            <div class="modal-actions">
                <button type="button" class="btn secondary" onClick={onCancel} disabled={busy}>
                    Keep it
                </button>
                <button type="button" class="btn destructive" onClick={onConfirm} disabled={busy}>
                    Delete download
                </button>
            </div>
        </div>
    </section>
);

export type TorrentMenu = { x: number; y: number; path: string; name: string };

/** C: right-click a `.torrent` that lies inside the node's download folder. */
export const TorrentContextMenu = ({
    menu,
    onFetch,
    onDownload,
    onRename,
    onDelete,
    onClose,
}: {
    menu: TorrentMenu;
    onFetch: () => void;
    onDownload: () => void;
    onRename: () => void;
    onDelete: () => void;
    onClose: () => void;
}) => (
    <div class="context-backdrop" onClick={onClose} onContextMenu={e => (e.preventDefault(), onClose())}>
        <div class="context-menu" role="menu" aria-label={`Actions for ${menu.name}`} style={{ left: `${menu.x}px`, top: `${menu.y}px` }} onClick={e => e.stopPropagation()}>
            <button type="button" role="menuitem" class="primary" onClick={onFetch}>
                <Icon name="fetch" size={13} /> Download torrent contents here
            </button>
            <hr />
            <button type="button" role="menuitem" onClick={onDownload}>
                Download
            </button>
            <button type="button" role="menuitem" onClick={onRename}>
                Rename
            </button>
            <button type="button" role="menuitem" class="danger" onClick={onDelete}>
                Delete
            </button>
        </div>
    </div>
);
