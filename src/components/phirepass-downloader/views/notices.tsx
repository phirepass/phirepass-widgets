import { h } from '@stencil/core';
import { Icon } from './icons';

export type NoticeKind = 'started' | 'queued' | 'stuck' | 'renamed' | 'completed' | 'error';

export type Notice = {
    id: number;
    kind: NoticeKind;
    title: string;
    detail: string;
    /** Stays until dismissed (N3); the others leave by themselves. */
    sticky?: boolean;
    action?: { label: string; run: () => void };
};

const ICON: Record<NoticeKind, string> = {
    started: 'fetch',
    queued: 'fetch',
    stuck: 'warn',
    renamed: 'file',
    completed: 'check',
    error: 'warn',
};

/** Small, self-dismissing notices at the bottom of the widget (N1–N4, D). */
export const Notices = ({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: number) => void }) =>
    notices.length ? (
        <div class="toasts" aria-live="polite">
            {notices.map(n => (
                <div class={{ toast: true, bad: n.kind === 'stuck' || n.kind === 'error' }} data-notice={n.kind} key={n.id}>
                    <Icon name={ICON[n.kind]} size={18} />
                    <div class="t">
                        <b>{n.title}</b>
                        <span title={n.detail}>{n.detail}</span>
                    </div>
                    {n.action && (
                        <button
                            type="button"
                            class="btn"
                            onClick={() => {
                                n.action!.run();
                                onDismiss(n.id);
                            }}
                        >
                            {n.action.label}
                        </button>
                    )}
                    <button type="button" class="ib" aria-label="Dismiss" onClick={() => onDismiss(n.id)}>
                        <Icon name="x" size={12} />
                    </button>
                </div>
            ))}
        </div>
    ) : null;
