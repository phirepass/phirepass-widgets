import { h } from '@stencil/core';
import type { Blocker } from '../jobs';
import { Icon } from './icons';

export const Empty = ({ icon, title, body, action }: { icon: string; title: string; body: string; action?: { label: string; onClick: () => void } }) => (
    <div class="empty" role="status">
        <Icon name={icon} size={28} />
        <b>{title}</b>
        <span>{body}</span>
        {action && (
            <button type="button" class="btn pri" onClick={action.onClick}>
                {action.label}
            </button>
        )}
    </div>
);

/** X1: embedded drawer with nothing in it. */
export const DrawerEmpty = () => (
    <Empty icon="fetch" title="No downloads yet" body="Press Fetch and paste a link. Downloads keep running after you close this tab, and they show here when you come back." />
);

/** X2: standalone, first open. */
export const StandaloneEmpty = ({ nodeName, folder }: { nodeName: string; folder: string | null }) => (
    <Empty icon="fetch" title="Nothing downloading" body={`Paste a link above. It downloads onto ${nodeName}${folder ? `, into ${folder}` : ''}.`} />
);

/** X3: no valid session. */
export const SignedOut = ({ onSignIn }: { onSignIn: () => void }) => (
    <Empty icon="lock" title="Sign in to PhirePass" body="Your downloads are tied to your account and the nodes you can reach." action={{ label: 'Sign in', onClick: onSignIn }} />
);

/** X4: the node (or the server) cannot be reached. */
export const Unreachable = ({ nodeName, onRetry }: { nodeName: string; onRetry?: () => void }) => (
    <Empty
        icon="signal"
        title={`Can't reach ${nodeName}`}
        body="If the machine is still running, its downloads carry on. They will show here when it reconnects."
        action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
);

/** The channel this page loaded predates Remote Fetch. */
export const Unsupported = () => (
    <Empty icon="warn" title="Downloads are not available here" body="This page's connection library is too old to start downloads. Reload after the site updates." />
);

export const Loading = () => (
    <div class="empty" role="status">
        <span class="spin" aria-hidden="true"></span>
        <span>Loading downloads…</span>
    </div>
);

/**
 * Why nothing can be added on this node (B8, B9, L3). Shown in place of the
 * form, in the dialog and in the standalone header alike.
 */
export const BlockerView = ({ blocker, onAction, onClose }: { blocker: Blocker; onAction?: () => void; onClose?: () => void }) => (
    <div class="blocker" data-blocker={blocker.id}>
        <div class={`note ${blocker.id === 'off' ? 'info' : 'warn'}`} role="status">
            <Icon name={blocker.id === 'off' ? 'fetch' : 'warn'} size={14} />
            <div>
                <b>{blocker.title}</b> {blocker.body}
            </div>
        </div>
        {blocker.secondary && <p class="hint">{blocker.secondary}</p>}
        {(onClose || (blocker.action && onAction)) && (
            <div class="dlg-f">
                {onClose && (
                    <button type="button" class="btn" onClick={onClose}>
                        Close
                    </button>
                )}
                {blocker.action && onAction && (
                    <button type="button" class="btn pri" onClick={onAction}>
                        {blocker.action}
                    </button>
                )}
            </div>
        )}
    </div>
);
