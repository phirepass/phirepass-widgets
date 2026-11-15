const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** `356 MB`, `4.31 GB`, `2 KB`. Decimal units, as the mockups and disk tools use. */
export function formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
        return '—';
    }
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < UNITS.length - 1) {
        value /= 1000;
        unit++;
    }
    if (unit === 0) {
        return `${Math.round(value)} B`;
    }
    // 812 MB, 11.8 MB, 4.31 GB, 1.2 KB: more digits only where a unit is coarse.
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : unit >= 3 ? 2 : 1;
    const text = value.toFixed(digits);
    // Trim trailing zeros: "2.00 GB" reads as "2 GB".
    return `${digits ? text.replace(/\.?0+$/, '') : text} ${UNITS[unit]}`;
}

/** `↓ 11.8 MB/s`. A rate of zero shows nothing worth reading, so it returns ''. */
export function formatRate(bps: number, arrow: '↓' | '↑' = '↓'): string {
    if (!bps || bps <= 0) {
        return '';
    }
    return `${arrow} ${formatBytes(bps)}/s`;
}

/** `48s`, `3m 40s`, `12m`, `2h 5m`. */
export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    if (s < 60) {
        return `${s}s`;
    }
    const m = Math.floor(s / 60);
    if (m < 10) {
        const rest = s % 60;
        return rest ? `${m}m ${rest}s` : `${m}m`;
    }
    if (m < 60) {
        return `${m}m`;
    }
    const h = Math.floor(m / 60);
    const rm = m % 60;
    if (h < 24) {
        return rm ? `${h}h ${rm}m` : `${h}h`;
    }
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

/** Time left at the current rate, or '' when it cannot be told. */
export function formatEta(done: number, total: number | null, bps: number): string {
    if (!total || !bps || bps <= 0 || done >= total) {
        return '';
    }
    return `${formatDuration((total - done) / bps)} left`;
}

/** `38.7%`. One decimal under 100, none at 100. */
export function formatPercent(done: number, total: number | null): string {
    if (!total || total <= 0) {
        return '';
    }
    const pct = Math.min(100, (done / total) * 100);
    return pct >= 100 ? '100%' : `${pct.toFixed(1)}%`;
}

export function percent(done: number, total: number | null): number {
    if (!total || total <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(100, (done / total) * 100));
}

/** Media clock: `2:31`, `1:02:09`. */
export function formatClock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
    }
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** `today 21:52`, `yesterday 09:10`, `13 Nov 21:52`. */
export function formatWhen(ms: number | null, now = Date.now()): string {
    if (!ms) {
        return '';
    }
    const d = new Date(ms);
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const today = new Date(now);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    if (ms >= startOfToday) {
        return `today ${time}`;
    }
    if (ms >= startOfToday - 86_400_000) {
        return `yesterday ${time}`;
    }
    const month = d.toLocaleString('en-GB', { month: 'short' });
    return `${d.getDate()} ${month} ${time}`;
}

/** `13 Nov`. */
export function formatDay(ms: number): string {
    const d = new Date(ms);
    return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`;
}
