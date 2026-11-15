import { h } from '@stencil/core';
import type { FetchCaps } from '../../../common/fetch';
import { formatBytes } from '../format';
import { FormModel, FormState, Note } from '../form';
import { AuthForm } from '../source';
import { Icon } from './icons';

export type FetchFormProps = {
    form: FormState;
    model: FormModel;
    caps: FetchCaps | null;
    layout: 'dialog' | 'inline';
    title: string;
    destination: { path: string; hint?: string } | null;
    starting: boolean;
    refusal: Note | null;
    onChange: (patch: Partial<FormState>) => void;
    /** A change to one login field, merged into the current login (not a render-time copy of it). */
    onAuth: (patch: Partial<AuthForm>) => void;
    onPickTorrent: (file: File) => void;
    onStart: () => void;
    onCancel?: () => void;
    onChooseFolder?: () => void;
};

export const NoteLine = ({ note }: { note: Note }) => (
    <div class={`note ${note.tone}`} role={note.tone === 'err' ? 'alert' : 'status'}>
        <Icon name="warn" size={14} />
        <div>
            <b>{note.title}</b> {note.body}
        </div>
    </div>
);

function Detect({ model }: { model: FormModel }) {
    const d = model.detected;
    if (d.kind === 'http' || d.kind === 'torrent-url') {
        return (
            <div class="detect" data-kind={d.kind}>
                <span class="pill meta">{d.kind === 'torrent-url' ? '.torrent link' : d.scheme}</span>
                <span class="host">{d.host}</span>
            </div>
        );
    }
    if (d.kind === 'magnet') {
        return (
            <div class="detect" data-kind="magnet">
                <span class="pill meta">Magnet</span>
                <span class="host">{d.name ?? 'name arrives with the metadata'}</span>
            </div>
        );
    }
    return <div class="detect"></div>;
}

const AuthFields = ({ auth, onChange }: { auth: AuthForm; onChange: (patch: Partial<AuthForm>) => void }) => {
    const set = onChange;
    const field = (label: string, key: keyof AuthForm, type = 'text') => (
        <label class="fld">
            <span>{label}</span>
            <input
                class="inp"
                type={type}
                autocomplete="off"
                spellcheck={false}
                value={auth[key] as string}
                onInput={e => set({ [key]: (e.target as HTMLInputElement).value } as Partial<AuthForm>)}
            />
        </label>
    );
    return (
        <div class="auth">
            <div class="seg" role="radiogroup" aria-label="Login for the link">
                {(
                    [
                        ['none', 'No login'],
                        ['basic', 'Username and password'],
                        ['bearer', 'Bearer token'],
                        ['header', 'Custom header'],
                    ] as const
                ).map(([mode, label]) => (
                    <label class={{ on: auth.mode === mode }}>
                        <input type="radio" name="auth-mode" checked={auth.mode === mode} onChange={() => set({ mode })} />
                        {label}
                    </label>
                ))}
            </div>
            {auth.mode === 'basic' && [field('Username', 'username'), field('Password', 'password', 'password')]}
            {auth.mode === 'bearer' && field('Token', 'token', 'password')}
            {auth.mode === 'header' && [field('Header name', 'headerName'), field('Value', 'headerValue', 'password')]}
            {auth.mode !== 'none' && <p class="hint">Sent only to this link's own site, and dropped if it redirects elsewhere. The node seals it and deletes it when the download finishes.</p>}
        </div>
    );
};

const OrderChoice = ({ order, onChange }: { order: FormState['order']; onChange: (order: 'in' | 'fast') => void }) => (
    <fieldset class="order">
        <legend>How should it download? (required for torrents)</legend>
        <label class={{ opt: true, on: order === 'in' }}>
            <input type="radio" name="order" value="in" checked={order === 'in'} onChange={() => onChange('in')} />
            <span>
                <b>In order</b> · watch while it downloads, a little slower
            </span>
        </label>
        <label class={{ opt: true, on: order === 'fast' }}>
            <input type="radio" name="order" value="fast" checked={order === 'fast'} onChange={() => onChange('fast')} />
            <span>
                <b>Fastest</b> · any order; switch to in order later if you want to watch
            </span>
        </label>
    </fieldset>
);

/**
 * The add form: mockup B and its states, used as the SFTP browser's Fetch
 * dialog (`dialog`) and as the top of the standalone downloader (`inline`).
 */
export const FetchForm = (p: FetchFormProps) => {
    const { form, model, caps } = p;
    let fileInput: HTMLInputElement | undefined;
    const torrentsOn = !!caps?.torrents;
    const dialog = p.layout === 'dialog';

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            p.onPickTorrent(file);
        }
    };

    const picker = (
        <input
            type="file"
            accept=".torrent,application/x-bittorrent"
            class="hidden-input"
            ref={el => (fileInput = el as HTMLInputElement)}
            onChange={e => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (file) {
                    p.onPickTorrent(file);
                }
                input.value = '';
            }}
        />
    );

    const source = form.torrent ? (
        <div class={{ filechip: true, bad: !!form.torrent.error }}>
            <Icon name="torrent" size={20} />
            <div>
                <b>{form.torrent.name}</b>
                <span>{formatBytes(form.torrent.size)} · from this computer</span>
            </div>
            <button type="button" class="ib" aria-label="Remove the .torrent file" title="Remove" onClick={() => p.onChange({ torrent: null, order: null })}>
                <Icon name="x" size={14} />
            </button>
        </div>
    ) : (
        <div class="fld">
            <label htmlFor="fetch-link">Link or magnet</label>
            <div class="inline-row">
                <input
                    id="fetch-link"
                    class="inp"
                    type="text"
                    inputMode="url"
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck={false}
                    placeholder="https://… or magnet:?xt=…"
                    value={form.text}
                    disabled={p.starting}
                    onInput={e => p.onChange({ text: (e.target as HTMLInputElement).value })}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && model.canStart) {
                            e.preventDefault();
                            p.onStart();
                        }
                    }}
                />
                {!dialog && torrentsOn && (
                    <button type="button" class="btn" onClick={() => fileInput?.click()}>
                        .torrent…
                    </button>
                )}
                {!dialog && (
                    <button type="button" class="btn pri" disabled={!model.canStart || p.starting} onClick={() => p.onStart()}>
                        {p.starting ? 'Starting…' : 'Download'}
                    </button>
                )}
            </div>
            <Detect model={model} />
        </div>
    );

    return (
        <form
            class={{ 'fetch-form': true, [p.layout]: true }}
            onSubmit={e => {
                e.preventDefault();
                if (model.canStart) {
                    p.onStart();
                }
            }}
            onDragOver={e => torrentsOn && e.preventDefault()}
            onDrop={e => torrentsOn && onDrop(e)}
        >
            {dialog && (
                <div class="dlg-h">
                    <Icon name="fetch" />
                    <h4>{p.title}</h4>
                </div>
            )}
            {picker}
            {source}
            {model.note && <NoteLine note={model.note} />}
            {p.refusal && <NoteLine note={p.refusal} />}
            {model.showSaveAs && (
                <div class="fld">
                    <label htmlFor="fetch-save-as">Save as</label>
                    <input
                        id="fetch-save-as"
                        class="inp"
                        type="text"
                        autocomplete="off"
                        spellcheck={false}
                        placeholder={model.askedName}
                        value={form.saveAs}
                        disabled={p.starting}
                        onInput={e => p.onChange({ saveAs: (e.target as HTMLInputElement).value })}
                    />
                    <span class="hint">Taken from the server's filename when it sends one. An existing file is never overwritten; the new one gets “(1)” added.</span>
                </div>
            )}
            {model.showAuth && (
                <div class="login">
                    <button type="button" class="lnk" aria-expanded={form.authOpen ? 'true' : 'false'} onClick={() => p.onChange({ authOpen: !form.authOpen })}>
                        <Icon name={form.authOpen ? 'up' : 'chevron'} size={12} /> This link needs a login
                    </button>
                    {form.authOpen && <AuthFields auth={form.auth} onChange={p.onAuth} />}
                    {model.authError && (
                        <span class="hint err" role="alert">
                            {model.authError}
                        </span>
                    )}
                </div>
            )}
            {model.needsOrder && <OrderChoice order={form.order} onChange={order => p.onChange({ order })} />}
            {(model.detected.kind === 'http' || model.detected.kind === 'torrent-url') && <p class="hint">A link always downloads in order, so you can watch while it arrives.</p>}
            {dialog && torrentsOn && !form.torrent && [
                <div class="or">or</div>,
                <button type="button" class="drop" onClick={() => fileInput?.click()}>
                    <Icon name="torrent" size={22} />
                    <span>
                        <b>Choose a .torrent file</b> or drop it here
                        <br />
                        <span class="hint">Up to 2 MB, read in the browser and sent to the node</span>
                    </span>
                </button>,
            ]}
            {p.destination && (
                <div class="fld">
                    {dialog && <label>Destination</label>}
                    <div class="dest-row">
                        <div class="dest" title={p.destination.path}>
                            <Icon name="folder" size={14} />
                            <span>{p.destination.path}</span>
                        </div>
                        {p.onChooseFolder && (
                            <button type="button" class="btn" onClick={() => p.onChooseFolder?.()}>
                                Choose folder…
                            </button>
                        )}
                    </div>
                    {p.destination.hint && <span class="hint where">{p.destination.hint}</span>}
                </div>
            )}
            {dialog && (
                <div class="dlg-f">
                    <button type="button" class="btn" onClick={() => p.onCancel?.()}>
                        Cancel
                    </button>
                    <button type="submit" class="btn pri" disabled={!model.canStart || p.starting}>
                        {p.starting ? 'Starting…' : 'Start download'}
                    </button>
                </div>
            )}
        </form>
    );
};
