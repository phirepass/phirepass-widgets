import { expect, waitFor } from 'storybook/test';
import type { FetchJob } from '../src/common/fetch';
import { DOWNLOAD_FOLDER, MEDIA_FOLDER, NODE_LABEL, caps, mediaListing } from '../src/testing/fixtures';
import type { DownloadScript, MockOptions } from '../src/testing/mock-channel';
import { inShadow, mount } from './helpers';

/** The standalone downloader (group 2). */
export function standalone(downloads: DownloadScript, opts: { width?: number | string; height?: number | string; props?: Record<string, unknown>; mock?: Partial<MockOptions> } = {}) {
    return mount(
        'phirepass-downloader',
        { nodeLabel: NODE_LABEL, canConfigure: true, ...opts.props },
        { downloads: { caps: caps(), ...downloads }, ...opts.mock },
        { height: opts.height ?? 560, width: opts.width },
    );
}

/** The embedded downloader on its own (the drawer and dialog), browsing `MEDIA_FOLDER`. */
export function embedded(downloads: DownloadScript, opts: { height?: number; props?: Record<string, unknown>; mock?: Partial<MockOptions> } = {}) {
    return mount(
        'phirepass-downloader',
        { nodeLabel: NODE_LABEL, compact: true, browsingService: 'sftp-1', browsingPath: MEDIA_FOLDER, canConfigure: true, ...opts.props },
        { downloads: { caps: caps(), ...downloads }, ...opts.mock },
        { height: opts.height ?? 520 },
    );
}

/** The SFTP browser hosting the downloader (group 1). */
export function inSftp(downloads: DownloadScript, opts: { cwd?: string; height?: number; streams?: boolean } = {}) {
    return mount(
        'phirepass-sftp-client',
        { serviceId: 'sftp-1' },
        {
            sftp: { cwd: opts.cwd ?? MEDIA_FOLDER, tree: mediaListing(), streams: opts.streams },
            downloads: { caps: caps(), where: b => ({ saves_to: b.path, mapped: b.path.startsWith('/home/pi/') }), ...downloads },
        },
        { height: opts.height ?? 640 },
    );
}

/** Opens the Fetch dialog and returns the modal. */
export async function openDialog(el: HTMLElement): Promise<HTMLElement> {
    await inShadow(el, el.hasAttribute('compact') ? '.drawer, .strip, .empty' : '.standalone', 4000).catch(() => undefined);
    await (el as any).openFetch();
    return inShadow(el, '.modal');
}

export async function rowState(el: HTMLElement, state: string): Promise<HTMLElement> {
    return inShadow(el, `.job[data-state="${state}"]`);
}

export async function rowNamed(el: HTMLElement, name: string): Promise<HTMLElement> {
    let found: HTMLElement | undefined;
    await waitFor(() => {
        found = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.job')).find(j => j.querySelector('.nm')?.textContent === name);
        expect(found, `row ${name}`).toBeTruthy();
    });
    return found!;
}

export function rowButton(row: HTMLElement, label: string): HTMLButtonElement {
    const b = Array.from(row.querySelectorAll('button')).find(x => x.getAttribute('aria-label') === label || x.textContent?.trim() === label);
    expect(b, `button ${label} on the row`).toBeTruthy();
    return b as HTMLButtonElement;
}

export function startArgs(calls: unknown[][]): { source: any; subDir: any; browsing: any; inOrder: boolean; options: any } {
    const [, source, subDir, browsing, inOrder, options] = calls.at(-1)!;
    return { source, subDir, browsing, inOrder: inOrder as boolean, options };
}

export { DOWNLOAD_FOLDER, MEDIA_FOLDER, NODE_LABEL };
export type { FetchJob };
