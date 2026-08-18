import Schema from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { formatPeakWindows, formatZoned, isPeak, nextOffPeakAt, parsePeakWindows, } from './peak.js';
import { formatEnqueueLabel, parseCheapText, wrapCheapText } from './mark.js';
import { loadStore, saveStore } from './queue.js';
export const name = 'dsh-cheap-hours';
export const inject = ['commands', 'agents'];
export const Config = Schema.object({
    timezone: Schema.string().default('Asia/Shanghai'),
    peakWindows: Schema.array(Schema.object({
        start: Schema.string().required(),
        end: Schema.string().required(),
    })).default([
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '18:00' },
    ]),
    queuePath: Schema.string().default(''),
});
const MAX_TIMEOUT_MS = 2_147_000_000;
const STATUS_PREVIEW = 80;
function preview(text) {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat.length <= STATUS_PREVIEW) {
        return flat;
    }
    return `${flat.slice(0, STATUS_PREVIEW - 1)}…`;
}
function resolveQueuePath(configured) {
    return configured.trim() || dshHomePath('cheap-hours.json');
}
export function apply(ctx, config) {
    const harness = ctx;
    const timezone = config.timezone;
    const storePath = resolveQueuePath(config.queuePath);
    let store = loadStore(storePath);
    if (!store.peakWindows?.length) {
        store.peakWindows = config.peakWindows.map(window => ({ ...window }));
    }
    parsePeakWindows(formatPeakWindows(store.peakWindows));
    let timer;
    let suppressDiscard = 0;
    const pendingDelete = new Set();
    const persist = () => saveStore(storePath, store);
    const windows = () => store.peakWindows ?? config.peakWindows;
    const clearTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
    };
    const taskMessage = (text) => createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'plugin', plugin: 'dsh-cheap-hours' },
    });
    const messageText = (message) => {
        const blocks = message.content;
        if (!Array.isArray(blocks)) {
            return '';
        }
        return blocks.filter(block => block?.type === 'text' && block.text).map(block => block.text).join('\n');
    };
    const isCheapMessage = (message) => (message.source?.kind === 'plugin' && message.source.plugin === 'dsh-cheap-hours');
    const sweepCheapOrphans = (agent) => {
        const keep = new Set(store.items
            .filter(item => item.sessionId === String(agent.id) && item.messageId)
            .map(item => item.messageId));
        suppressDiscard += 1;
        try {
            for (const message of [...agent.inbox.nextTurn]) {
                if (isCheapMessage(message) && !keep.has(String(message.id))) {
                    agent.inbox.remove(message.id);
                }
            }
        }
        finally {
            suppressDiscard -= 1;
        }
    };
    const parkInInbox = (agent, task) => {
        sweepCheapOrphans(agent);
        if (task.messageId && agent.inbox.nextTurn.some(item => item.id === task.messageId)) {
            const wrapped = taskMessage(wrapCheapText(task.text, task.enqueuedAt, task.id));
            suppressDiscard += 1;
            try {
                if (agent.inbox.replace(task.messageId, wrapped)) {
                    task.messageId = String(wrapped.id);
                    persist();
                }
            }
            finally {
                suppressDiscard -= 1;
            }
            return;
        }
        const message = taskMessage(wrapCheapText(task.text, task.enqueuedAt, task.id));
        task.messageId = String(message.id);
        persist();
        agent.send(message, 'next-turn', false);
    };
    const unpark = (agent, task) => {
        if (task.messageId) {
            agent.inbox.remove(task.messageId);
        }
    };
    const refreshPark = (agent, task) => {
        if (pendingDelete.has(task.id)) {
            return;
        }
        suppressDiscard += 1;
        try {
            if (task.messageId) {
                const wrapped = taskMessage(wrapCheapText(task.text, task.enqueuedAt, task.id));
                if (agent.inbox.replace(task.messageId, wrapped)) {
                    task.messageId = String(wrapped.id);
                    persist();
                    return;
                }
            }
            parkInInbox(agent, task);
        }
        finally {
            suppressDiscard -= 1;
        }
    };
    const dispatchTask = (task) => {
        const agent = harness.agents.get(task.sessionId);
        if (!agent) {
            return `session ${task.sessionId} 已不在线，任务作废：${preview(task.text)}`;
        }
        ctx.emit('offpeak/task-starting', {
            sessionId: task.sessionId,
            text: task.text,
            runAfter: task.runAfter,
        });
        unpark(agent, task);
        agent.followup(taskMessage(task.text));
        return undefined;
    };
    const dispatchDue = () => {
        const now = Date.now();
        const due = store.items.filter(item => Date.parse(item.runAfter) <= now);
        if (due.length === 0) {
            return;
        }
        const skipped = [];
        store.items = store.items.filter(item => Date.parse(item.runAfter) > now);
        persist();
        for (const task of due) {
            const error = dispatchTask(task);
            if (error) {
                skipped.push(error);
                ctx.logger.warn(`[cheap-hours] ${error}`);
            }
        }
        if (skipped.length) {
            ctx.logger.warn(`[cheap-hours] ${skipped.join('; ')}`);
        }
    };
    const schedule = () => {
        clearTimer();
        dispatchDue();
        if (store.items.length === 0) {
            return;
        }
        const next = store.items
            .map(item => Date.parse(item.runAfter))
            .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
        const delay = Math.max(0, Math.min(MAX_TIMEOUT_MS, next - Date.now()));
        timer = setTimeout(() => {
            timer = undefined;
            schedule();
        }, delay);
    };
    const dropByMessageId = (messageId) => {
        if (suppressDiscard > 0) {
            return;
        }
        const item = store.items.find(entry => entry.messageId === messageId);
        if (!item) {
            return;
        }
        item.messageId = undefined;
        pendingDelete.add(item.id);
        persist();
        queueMicrotask(() => {
            if (!pendingDelete.has(item.id)) {
                return;
            }
            pendingDelete.delete(item.id);
            store.items = store.items.filter(entry => entry.id !== item.id);
            persist();
            schedule();
        });
    };
    const attachParkedMessage = (sessionId, message) => {
        if (!isCheapMessage(message)) {
            return;
        }
        const parsed = parseCheapText(messageText(message));
        const item = parsed.taskId
            ? store.items.find(entry => entry.id === parsed.taskId)
            : store.items.find(entry => entry.sessionId === sessionId && !entry.messageId);
        if (!item) {
            return;
        }
        pendingDelete.delete(item.id);
        item.messageId = String(message.id);
        if (parsed.text) {
            item.text = parsed.text;
        }
        persist();
    };
    const enqueue = (sessionId, text, taskId) => {
        const now = new Date();
        const runAfter = nextOffPeakAt(now, timezone, windows()).toISOString();
        const existing = taskId
            ? store.items.find(item => item.id === taskId)
            : store.items.find(item => item.sessionId === sessionId && !item.messageId);
        if (existing) {
            existing.text = text;
            existing.sessionId = sessionId;
            existing.runAfter = runAfter;
            pendingDelete.delete(existing.id);
            persist();
            ctx.emit('offpeak/task-queued', {
                sessionId,
                text,
                runAfter: existing.runAfter,
            });
            schedule();
            return existing;
        }
        const task = {
            id: crypto.randomUUID(),
            sessionId,
            text,
            enqueuedAt: now.toISOString(),
            runAfter,
        };
        store.items.push(task);
        persist();
        ctx.emit('offpeak/task-queued', {
            sessionId,
            text,
            runAfter: task.runAfter,
        });
        schedule();
        return task;
    };
    const statusText = () => {
        const now = new Date();
        const peak = isPeak(now, timezone, windows());
        const next = nextOffPeakAt(now, timezone, windows());
        const lines = [
            peak ? '现在是高峰（贵）。省钱模式：把任务丢给 /cheap，我帮你午睡到低峰再跑。' : '现在是低峰（便宜）。直接发消息即可；/cheap 也会马上开工。',
            `时区 ${timezone}，高峰 ${formatPeakWindows(windows())}`,
            peak ? `下一低峰：${formatZoned(next, timezone)}` : '当前已在低峰窗口。',
            `排队 ${store.items.length} 条 · 文件 ${storePath}`,
            '页面底部输入框上方会有队列条；点编辑会把原文放回输入框。时间是入队时刻，不是发给 DeepSeek 的时间。',
        ];
        const nowMs = Date.now();
        for (const [index, item] of store.items.entries()) {
            const queued = formatEnqueueLabel(item.enqueuedAt, nowMs, timezone) || item.enqueuedAt;
            lines.push(`${index + 1}. 入队 ${queued} · ${formatZoned(new Date(item.runAfter), timezone)} 投递  ${preview(item.text)}`);
        }
        return lines.join('\n');
    };
    const handle = (agent, rawInput) => {
        const input = rawInput.trim();
        if (!input) {
            return { kind: 'success', text: statusText() };
        }
        if (input === 'now') {
            if (store.items.length === 0) {
                return { kind: 'success', text: '队列是空的，没有待投递的省钱任务。' };
            }
            const pending = [...store.items];
            store.items = [];
            persist();
            schedule();
            const skipped = [];
            for (const task of pending) {
                const error = dispatchTask(task);
                if (error) {
                    skipped.push(error);
                }
            }
            const sent = pending.length - skipped.length;
            return {
                kind: skipped.length ? 'error' : 'success',
                text: [`已立刻投递 ${sent} 条。`, ...skipped].join('\n'),
            };
        }
        if (input === 'drop') {
            const count = store.items.length;
            for (const task of store.items) {
                const agent = harness.agents.get(task.sessionId);
                if (agent) {
                    unpark(agent, task);
                }
            }
            store.items = [];
            persist();
            schedule();
            return { kind: 'success', text: count ? `已丢掉 ${count} 条排队任务。` : '队列本来就是空的。' };
        }
        if (input === 'hours' || input.startsWith('hours ')) {
            const spec = input.slice('hours'.length).trim();
            if (!spec) {
                return {
                    kind: 'success',
                    text: `当前高峰：${formatPeakWindows(windows())}\n改法：/cheap hours 09:00-12:00,14:00-18:00`,
                };
            }
            try {
                store.peakWindows = parsePeakWindows(spec);
                persist();
                for (const item of store.items) {
                    item.runAfter = nextOffPeakAt(new Date(), timezone, windows()).toISOString();
                }
                persist();
                schedule();
                return {
                    kind: 'success',
                    text: `高峰已改为 ${formatPeakWindows(windows())}。\n${statusText()}`,
                };
            }
            catch (error) {
                return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
            }
        }
        const now = new Date();
        const parsedInput = parseCheapText(input);
        const taskText = parsedInput.text || input;
        const taskId = parsedInput.taskId;
        if (!isPeak(now, timezone, windows())) {
            const error = dispatchTask({
                id: taskId ?? crypto.randomUUID(),
                sessionId: String(agent.id),
                text: taskText,
                enqueuedAt: parsedInput.enqueuedAt ?? now.toISOString(),
                runAfter: now.toISOString(),
            });
            if (error) {
                return { kind: 'error', text: error };
            }
            return { kind: 'success', text: `现在是低峰，任务已立刻开工：${preview(taskText)}` };
        }
        const task = enqueue(String(agent.id), taskText, taskId);
        const live = harness.agents.get(String(agent.id));
        if (live) {
            parkInInbox(live, task);
        }
        return {
            kind: 'success',
            text: `已排队，等 ${formatZoned(new Date(task.runAfter), timezone)} 低峰再跑。看页面底部队列条：时间是入队时刻，点编辑会回到输入框。\n文件：${storePath}\n任务：${task.text}`,
        };
    };
    const register = (commandName, description) => {
        harness.commands.register({
            name: commandName,
            description,
            input: { hint: '任务内容，或 now / drop / hours' },
            handler: ({ agent, rawInput }) => handle(agent, rawInput),
        });
    };
    register('cheap', '把任务丢到低峰再跑（省一半 token 钱）');
    register('nap', '让任务先午睡，等到 DeepSeek 低峰再开工');
    ctx.effect(() => {
        schedule();
        const onCreated = (payload) => {
            for (const task of store.items) {
                if (String(payload.agent.id) === task.sessionId && Date.parse(task.runAfter) > Date.now()) {
                    refreshPark(payload.agent, task);
                }
            }
        };
        const onDiscarded = (payload) => {
            const messageId = payload?.message?.id;
            if (messageId !== undefined && messageId !== null) {
                dropByMessageId(String(messageId));
            }
        };
        const onInserted = (payload) => {
            if (payload?.message) {
                attachParkedMessage(String(payload.agent?.id ?? ''), payload.message);
            }
        };
        ctx.on('agent/created', onCreated);
        for (const task of store.items) {
            const agent = harness.agents.get(task.sessionId);
            if (agent && Date.parse(task.runAfter) > Date.now()) {
                refreshPark(agent, task);
            }
        }
        ;
        ctx.on('agent/inbox/discarded', onDiscarded);
        ctx.on('agent/inbox/inserted', onInserted);
        return () => clearTimer();
    });
}
