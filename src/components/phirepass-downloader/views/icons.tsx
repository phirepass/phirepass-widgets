import { h } from '@stencil/core';

/** Line icons shared by the downloader and the SFTP client's Fetch button. 16px, `currentColor`. */
// Functions, not arrays: a vnode is bound to the element it rendered, so each
// icon needs fresh ones.
const paths: Record<string, () => any[]> = {
    fetch: () => [<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.3 12.7 4 4 0 0 0 6 19.9" />, <path d="M12 12v8" />, <path d="m8.5 16.5 3.5 3.5 3.5-3.5" />],
    magnet: () => [<path d="M6 3v8a6 6 0 0 0 12 0V3" />, <path d="M6 7h4M14 7h4" />, <path d="M10 3v8a2 2 0 0 0 4 0V3" />],
    globe: () => [<circle cx="12" cy="12" r="9" />, <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />],
    torrent: () => [<path d="M6 3h8l4 4v14H6z" />, <path d="M14 3v4h4" />, <path d="M9.5 11.5 12 14l2.5-2.5M12 14v3" />],
    node: () => [<rect x="3" y="4" width="18" height="7" rx="1.5" />, <rect x="3" y="13" width="18" height="7" rx="1.5" />, <path d="M7 7.5h.01M7 16.5h.01" />],
    x: () => [<path d="M6 6l12 12M18 6 6 18" />],
    retry: () => [<path d="M3 12a9 9 0 0 0 15.4 6.4L21 16" />, <path d="M21 21v-5h-5" />, <path d="M21 12A9 9 0 0 0 5.6 5.6L3 8" />, <path d="M3 3v5h5" />],
    check: () => [<circle cx="12" cy="12" r="9.5" />, <path d="m8 12.5 2.7 2.7L16.5 9.5" />],
    locate: () => [<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />, <path d="m11 13 2 2 3-3" />],
    file: () => [<path d="M6 3h8l4 4v14H6z" />, <path d="M14 3v4h4" />],
    folder: () => [<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />],
    warn: () => [<path d="M12 3 2.5 20h19z" />, <path d="M12 10v4.5" />, <path d="M12 17.5v.01" />],
    trash: () => [<path d="M3 6h18" />, <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />, <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />],
    chevron: () => [<path d="m6 9 6 6 6-6" />],
    up: () => [<path d="m6 15 6-6 6 6" />],
    cast: () => [<path d="M3 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />, <path d="M3 12a8 8 0 0 1 8 8" />, <path d="M3 16a4 4 0 0 1 4 4" />, <path d="M3 20h.01" />],
    lock: () => [<rect width="18" height="11" x="3" y="11" rx="2" />, <path d="M7 11V7a5 5 0 0 1 10 0v4" />],
    signal: () => [<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16" />],
    plus: () => [<path d="M12 5v14M5 12h14" />],
    link: () => [<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />, <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />],
};

const filled: Record<string, () => any[]> = {
    pause: () => [<rect x="6" y="5" width="4" height="14" rx="1" />, <rect x="14" y="5" width="4" height="14" rx="1" />],
    play: () => [<path d="M7 5v14l12-7z" />],
};

export const Icon = ({ name, size = 16, label }: { name: string; size?: number; label?: string }) => {
    const fill = filled[name];
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill ? 'currentColor' : 'none'}
            stroke={fill ? 'none' : 'currentColor'}
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden={label ? undefined : 'true'}
            role={label ? 'img' : undefined}
            aria-label={label}
        >
            {(fill ?? paths[name])?.() ?? null}
        </svg>
    );
};
