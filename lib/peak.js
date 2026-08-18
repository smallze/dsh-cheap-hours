const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function parseHhMm(value) {
    const match = HHMM.exec(value.trim());
    if (!match) {
        throw new Error(`invalid HH:mm value: ${value}`);
    }
    return Number(match[1]) * 60 + Number(match[2]);
}
export function formatHhMm(minutes) {
    const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hour = Math.floor(wrapped / 60);
    const minute = wrapped % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export function parsePeakWindows(spec) {
    const windows = spec
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
        const [start, end] = part.split('-').map(item => item.trim());
        if (!start || !end) {
            throw new Error(`invalid peak window: ${part}`);
        }
        parseHhMm(start);
        parseHhMm(end);
        return { start, end };
    });
    if (windows.length === 0) {
        throw new Error('at least one peak window is required');
    }
    return windows;
}
export function formatPeakWindows(windows) {
    return windows.map(window => `${window.start}-${window.end}`).join(',');
}
export function zonedParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    };
}
export function zonedMinutes(date, timeZone) {
    const parts = zonedParts(date, timeZone);
    return parts.hour * 60 + parts.minute;
}
export function windowContains(window, minutes) {
    const start = parseHhMm(window.start);
    const end = parseHhMm(window.end);
    if (start === end) {
        return true;
    }
    if (start < end) {
        return minutes >= start && minutes < end;
    }
    return minutes >= start || minutes < end;
}
export function isPeak(date, timeZone, windows) {
    const minutes = zonedMinutes(date, timeZone);
    return windows.some(window => windowContains(window, minutes));
}
function addDays(parts, days) {
    const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0);
    const next = new Date(utc);
    return {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
        day: next.getUTCDate(),
        hour: parts.hour,
        minute: parts.minute,
        second: parts.second,
    };
}
export function zonedWallToDate(timeZone, wall) {
    let utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    for (let i = 0; i < 4; i++) {
        const got = zonedParts(new Date(utc), timeZone);
        const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
        const wantUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
        const delta = wantUtc - gotUtc;
        if (delta === 0) {
            break;
        }
        utc += delta;
    }
    return new Date(utc);
}
export function nextOffPeakAt(date, timeZone, windows) {
    if (!isPeak(date, timeZone, windows)) {
        return date;
    }
    const parts = zonedParts(date, timeZone);
    const minutes = parts.hour * 60 + parts.minute;
    const window = windows.find(item => windowContains(item, minutes));
    if (!window) {
        return date;
    }
    const startMinutes = parseHhMm(window.start);
    const endMinutes = parseHhMm(window.end);
    const overnight = startMinutes > endMinutes;
    const rollToTomorrow = overnight && minutes >= startMinutes;
    const wall = {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: Math.floor(endMinutes / 60),
        minute: endMinutes % 60,
        second: 0,
    };
    const target = rollToTomorrow ? addDays(wall, 1) : wall;
    const result = zonedWallToDate(timeZone, target);
    if (result.getTime() <= date.getTime()) {
        return new Date(date.getTime() + 60_000);
    }
    return result;
}
export function formatZoned(date, timeZone) {
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hourCycle: 'h23',
    }).format(date);
}
