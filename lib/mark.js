const SENTINEL = '\u2060cheap:';
const SENTINEL_END = '\u2060';
const JUST_NOW_MS = 60_000;
export function wrapCheapText(text, enqueuedAt, taskId) {
    const payload = taskId ? `${enqueuedAt}|${taskId}` : enqueuedAt;
    return `${SENTINEL}${payload}${SENTINEL_END}\n${text}`;
}
export function parseCheapText(raw) {
    if (!raw) {
        return { text: '' };
    }
    if (!raw.startsWith(SENTINEL)) {
        return { text: raw };
    }
    const end = raw.indexOf(SENTINEL_END, SENTINEL.length);
    if (end < 0) {
        return { text: raw };
    }
    const payload = raw.slice(SENTINEL.length, end);
    const rest = raw.slice(end + SENTINEL_END.length);
    const text = rest.startsWith('\n') ? rest.slice(1) : rest;
    const sep = payload.indexOf('|');
    if (sep < 0) {
        return { enqueuedAt: payload, text };
    }
    return {
        enqueuedAt: payload.slice(0, sep),
        taskId: payload.slice(sep + 1) || undefined,
        text,
    };
}
export function formatEnqueueLabel(iso, now = Date.now(), timeZone = 'Asia/Shanghai') {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) {
        return '';
    }
    if (now - t < JUST_NOW_MS) {
        return '刚刚';
    }
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date(t));
}
export function stripCheapCommandPrefix(text) {
    return text.replace(/^\/(?:cheap|nap)\s+/, '');
}
