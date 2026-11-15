import { describe, expect, it } from 'vitest';
import { formatBytes, formatClock, formatDuration, formatEta, formatPercent, formatRate, percent } from './format';

describe('formatBytes', () => {
    it.each([
        [0, '0 B'],
        [999, '999 B'],
        [1_200, '1.2 KB'],
        [11_800_000, '11.8 MB'],
        [812_000_000, '812 MB'],
        [4_310_000_000, '4.31 GB'],
        [2_000_000_000, '2 GB'],
        [3e15, '3000 TB'],
    ])('%d → %s', (n, text) => {
        expect(formatBytes(n)).toBe(text);
    });

    it.each([null, undefined, NaN, -1])('shows a dash for %s', n => {
        expect(formatBytes(n as number)).toBe('—');
    });
});

describe('formatRate', () => {
    it('shows nothing for a stopped rate', () => {
        expect(formatRate(0)).toBe('');
    });
    it('shows an arrow and a unit per second', () => {
        expect(formatRate(11_800_000)).toBe('↓ 11.8 MB/s');
        expect(formatRate(300_000, '↑')).toBe('↑ 300 KB/s');
    });
});

describe('formatDuration', () => {
    it.each([
        [48, '48s'],
        [220, '3m 40s'],
        [180, '3m'],
        [720, '12m'],
        [7500, '2h 5m'],
        [7200, '2h'],
        [3 * 86400 + 3600, '3d 1h'],
    ])('%d s → %s', (s, text) => {
        expect(formatDuration(s)).toBe(text);
    });
});

describe('formatEta', () => {
    it('is the time left at the current rate', () => {
        expect(formatEta(0, 1_000_000, 10_000)).toBe('1m 40s left');
    });
    it('is empty without a size, a rate, or once done', () => {
        expect(formatEta(0, null, 10)).toBe('');
        expect(formatEta(0, 10, 0)).toBe('');
        expect(formatEta(10, 10, 5)).toBe('');
    });
});

describe('formatPercent and percent', () => {
    it('shows one decimal under 100', () => {
        expect(formatPercent(387, 1000)).toBe('38.7%');
        expect(formatPercent(1000, 1000)).toBe('100%');
        expect(formatPercent(5, null)).toBe('');
    });
    it('clamps to 0..100', () => {
        expect(percent(20, 10)).toBe(100);
        expect(percent(-5, 10)).toBe(0);
        expect(percent(5, 0)).toBe(0);
    });
});

describe('formatClock', () => {
    it.each([
        [151, '2:31'],
        [3729, '1:02:09'],
        [-3, '0:00'],
        [Infinity, '0:00'],
    ])('%d → %s', (s, text) => {
        expect(formatClock(s)).toBe(text);
    });
});
