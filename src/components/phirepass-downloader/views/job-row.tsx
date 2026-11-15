import { h } from '@stencil/core';
import { percent } from '../format';
import { Row, isFinished, orderPill, playCheck, statePill, statsLine } from '../jobs';
import { Icon } from './icons';

export type RowActions = {
    play: (row: Row) => void;
    pause: (row: Row) => void;
    resume: (row: Row, ignoreWindow?: boolean) => void;
    stop: (row: Row) => void;
    remove: (row: Row) => void;
    setOrder: (row: Row, inOrder: boolean) => void;
    showInFolder: (row: Row) => void;
};

function kindIcon(row: Row): { icon: string; tone: string } {
    if (row.kind === 'Torrent') {
        return { icon: row.name.startsWith('magnet:') ? 'magnet' : 'torrent', tone: 't' };
    }
    if (row.kind === 'Node') {
        return { icon: 'node', tone: 'n' };
    }
    return { icon: 'globe', tone: 'h' };
}

function barClass(row: Row): string {
    if (row.state === 'FetchingMetadata' || row.state === 'Resolving') {
        return 'bar indet';
    }
    if (row.state === 'Retrying' || row.state === 'Paused') {
        return 'bar moving';
    }
    if (row.state === 'Stopped' || row.state === 'Queued' || row.state === 'Scheduled' || row.deleting) {
        return 'bar paused';
    }
    if (row.state === 'Cancelled') {
        return 'bar fail';
    }
    if (row.state === 'Seeding') {
        return 'bar seed';
    }
    return 'bar';
}

const Btn = ({ icon, label, onClick, primary }: { icon: string; label: string; onClick: () => void; primary?: boolean }) => (
    <button type="button" class={{ ib: true, new: !!primary }} title={label} aria-label={label} onClick={onClick}>
        <Icon name={icon} size={14} />
    </button>
);

/**
 * One download, in any state (mockups R and R2). Which buttons show is decided
 * by the state alone; what a button sends is the host's business.
 */
export const JobRow = ({ row, actions, running, source, compact }: { row: Row; actions: RowActions; running: number; source?: string; compact?: boolean }) => {
    const { icon, tone } = kindIcon(row);
    const pill = statePill(row);
    const order = orderPill(row);
    const play = playCheck(row);
    const stats = statsLine(row, { running, source });
    const value = row.state === 'Completed' || row.state === 'Seeding' ? 100 : percent(row.done_bytes, row.total_bytes);
    const buttons: any[] = [];

    if (!row.deleting) {
        if (play.play) {
            buttons.push(<Btn icon="play" label={isFinished(row.state) ? 'Play' : 'Play while downloading'} primary onClick={() => actions.play(row)} />);
        }
        switch (row.state) {
            case 'Downloading':
            case 'Verifying':
            case 'Resolving':
            case 'FetchingMetadata':
            case 'Queued':
                if (row.state === 'Downloading' || row.state === 'Verifying') {
                    buttons.push(<Btn icon="pause" label="Pause" onClick={() => actions.pause(row)} />);
                }
                buttons.push(<Btn icon="x" label="Stop" onClick={() => actions.stop(row)} />);
                break;
            case 'Scheduled':
            case 'Paused':
                if (row.state === 'Scheduled' || row.pause_reason === 'Window') {
                    buttons.push(<Btn icon="play" label="Start now" onClick={() => actions.resume(row, true)} />);
                }
                buttons.push(<Btn icon="x" label="Stop" onClick={() => actions.stop(row)} />);
                break;
            case 'Retrying':
                buttons.push(<Btn icon="retry" label="Try now" onClick={() => actions.resume(row)} />);
                buttons.push(<Btn icon="x" label="Stop" onClick={() => actions.stop(row)} />);
                break;
            case 'Stopped':
                buttons.push(<Btn icon="play" label="Resume" onClick={() => actions.resume(row)} />);
                buttons.push(<Btn icon="trash" label="Delete" onClick={() => actions.remove(row)} />);
                break;
            case 'Seeding':
                buttons.push(<Btn icon="pause" label="Pause seeding" onClick={() => actions.pause(row)} />);
                buttons.push(<Btn icon="locate" label="Show in folder" onClick={() => actions.showInFolder(row)} />);
                buttons.push(<Btn icon="trash" label="Delete" onClick={() => actions.remove(row)} />);
                break;
            case 'Completed':
                buttons.push(<Btn icon="locate" label="Show in folder" onClick={() => actions.showInFolder(row)} />);
                buttons.push(<Btn icon="x" label="Remove from list" onClick={() => actions.remove(row)} />);
                break;
            case 'Cancelled':
                buttons.push(<Btn icon="retry" label="Start again" onClick={() => actions.resume(row)} />);
                buttons.push(<Btn icon="x" label="Remove from list" onClick={() => actions.remove(row)} />);
                break;
        }
    }

    return (
        <div key={row.download_id} class={{ job: true, compact: !!compact }} data-state={row.deleting ? 'Deleting' : row.state} data-id={row.download_id} role="listitem" aria-label={`${row.name}, ${pill.text}`}>
            <span class={`kind ${tone}`}>
                <Icon name={icon} size={15} />
            </span>
            <div class="title">
                <span class="nm" title={row.name}>
                    {row.name}
                </span>
                <span class={`pill ${pill.tone}`}>{pill.text}</span>
                {order && <span class="pill meta">{order}</span>}
            </div>
            <div class="acts">{buttons}</div>
            <div class={barClass(row)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={`${row.name} progress`}>
                <i style={{ width: `${value}%` }}></i>
            </div>
            <div class="stats">
                {stats.map(s => (s.strong ? <b>{s.text}</b> : <span class={{ err: !!s.error }}>{s.text}</span>))}
                {!play.play && play.switchToInOrder && (
                    <button type="button" class="lnk inline" onClick={() => actions.setOrder(row, true)}>
                        Switch to in order to watch
                    </button>
                )}
                {play.play && row.kind === 'Torrent' && row.in_order && !isFinished(row.state) && (
                    <button type="button" class="lnk inline" onClick={() => actions.setOrder(row, false)}>
                        Switch to fastest
                    </button>
                )}
            </div>
        </div>
    );
};
