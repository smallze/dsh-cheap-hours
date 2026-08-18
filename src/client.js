window.__ModuleLoader__.load({
	id: "dsh-cheap-hours",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const jsx = require("react/jsx-runtime");
		const react = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		const SENTINEL = "\u2060cheap:";
		const SENTINEL_END = "\u2060";
		const JUST_NOW_MS = 60_000;
		const TIME_ZONE = "Asia/Shanghai";

		function parseCheapText(raw) {
			if (!raw) return { text: "" };
			if (!raw.startsWith(SENTINEL)) return { text: raw };
			const end = raw.indexOf(SENTINEL_END, SENTINEL.length);
			if (end < 0) return { text: raw };
			const payload = raw.slice(SENTINEL.length, end);
			const rest = raw.slice(end + SENTINEL_END.length);
			const text = rest.startsWith("\n") ? rest.slice(1) : rest;
			const sep = payload.indexOf("|");
			if (sep < 0) return { enqueuedAt: payload, text };
			return {
				enqueuedAt: payload.slice(0, sep),
				taskId: payload.slice(sep + 1) || undefined,
				text
			};
		}

		function wrapCheapText(text, enqueuedAt, taskId) {
			const payload = taskId ? `${enqueuedAt}|${taskId}` : enqueuedAt;
			return `${SENTINEL}${payload}${SENTINEL_END}\n${text}`;
		}

		function stripCheapCommandPrefix(text) {
			return text.replace(/^\/(?:cheap|nap)\s+/, "");
		}

		function uniqueQueueRows(parsedRows) {
			const seen = new Set();
			const out = [];
			for (const item of parsedRows) {
				const key = item.parsed.taskId || item.row.id;
				if (seen.has(key)) continue;
				seen.add(key);
				out.push(item);
			}
			return out;
		}

		function formatEnqueueLabel(iso, now) {
			const t = Date.parse(iso);
			if (!Number.isFinite(t)) return "";
			if (now - t < JUST_NOW_MS) return "刚刚";
			return new Intl.DateTimeFormat("zh-CN", {
				timeZone: TIME_ZONE,
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false
			}).format(new Date(t));
		}

		function previewOf(text) {
			return text.replace(/\s+/g, " ").trim();
		}

		const editingBySession = new Map();
		const patchedInputs = new WeakSet();
		const editListeners = new Set();
		const emitEditChange = () => {
			for (const listener of editListeners) listener();
		};

		function focusComposer() {
			requestAnimationFrame(() => {
				const el = document.querySelector("textarea, [contenteditable='true']");
				if (el instanceof HTMLElement) {
					el.focus();
					if (el instanceof HTMLTextAreaElement) {
						const end = el.value.length;
						el.setSelectionRange(end, end);
					}
				}
			});
		}

		const css = ".dshCheapQ_dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));margin:0 auto calc(0px - var(--dsh-composer-stack-gap) - 3px);padding:0 var(--dsh-composer-dock-inset);flex:none}.dshCheapQ_panel{background:var(--dsw-specific-tip);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px 12px 0 0;width:100%;padding:2px 0;position:relative;overflow:hidden}.dshCheapQ_panel:after{border:1px solid var(--dsw-alias-border-l1);border-radius:inherit;content:\"\";pointer-events:none;border-bottom:none;position:absolute;inset:0}.dshCheapQ_header{box-sizing:border-box;width:100%;height:36px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;gap:10px;padding:4px 12px;display:flex}.dshCheapQ_header:focus-visible{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:-2px}.dshCheapQ_header:disabled{cursor:default}.dshCheapQ_lead{color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.dshCheapQ_count{min-width:0;font-family:Inter, var(--dsw-font-family);flex:auto;font-size:13px;font-weight:500;line-height:24px}.dshCheapQ_chevron{width:14px;height:14px;color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.dshCheapQ_list{max-height:180px;margin:0;padding:0;list-style:none;overflow-y:auto}.dshCheapQ_row{box-sizing:border-box;border-radius:8px;align-items:center;gap:8px;width:100%;min-height:36px;padding:4px 5px 4px 12px;display:flex}.dshCheapQ_row+.dshCheapQ_row{box-shadow:inset 0 1px 0 var(--dsw-alias-border-l1)}.dshCheapQ_preview{min-width:0;font:var(--dsw-font-xs-13);font-family:Inter, var(--dsw-font-family);flex:auto;color:var(--dsw-alias-label-primary-dimmed);text-overflow:ellipsis;white-space:nowrap;word-break:break-word;overflow:hidden}.dshCheapQ_time{flex:none;font:var(--dsw-font-xs-13);font-family:Inter, var(--dsw-font-family);color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;letter-spacing:.02em}.dshCheapQ_actions{flex:none;align-items:center;gap:4px;display:flex}.dshCheapQ_action{width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;padding:0;display:grid}.dshCheapQ_action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dshCheapQ_action:focus-visible{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:-2px}.dshCheapQ_action:disabled{cursor:default;opacity:.45}[data-queue-dock]:not([data-cheap-queue]){display:none!important}";
		const tagId = "dsh-cheap-hours/CheapQueueDock.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cheap-hours";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		function CheapQueueDock({ useSession, updateQueue, notify, inputActions, sessionId }) {
			const inbox = useSession((s) => s.queue);
			const queue = react.useMemo(() => inbox.filter((row) => row.placement === "queued"), [inbox]);
			const running = useSession((s) => s.running);
			const queueMutable = useSession((s) => s.subagent === null);
			const [now, setNow] = react.useState(() => Date.now());
			const [busy, setBusy] = react.useState(null);
			const [collapsed, setCollapsed] = react.useState(true);
			const [, setEditTick] = react.useState(0);
			react.useEffect(() => {
				const listener = () => setEditTick((value) => value + 1);
				editListeners.add(listener);
				return () => editListeners.delete(listener);
			}, []);
			const editingId = editingBySession.get(sessionId)?.rowId ?? null;
			const listId = react.useId();
			const parsedRows = react.useMemo(() => uniqueQueueRows(queue.map((row) => ({
				row,
				parsed: parseCheapText(row.text)
			}))).filter((item) => item.row.id !== editingId), [queue, editingId]);
			const needsTick = parsedRows.some((item) => {
				if (!item.parsed.enqueuedAt) return false;
				const t = Date.parse(item.parsed.enqueuedAt);
				return Number.isFinite(t) && now - t < JUST_NOW_MS + 1_000;
			});
			react.useEffect(() => {
				if (!needsTick) return undefined;
				const id = setInterval(() => setNow(Date.now()), 1_000);
				return () => clearInterval(id);
			}, [needsTick]);
			react.useEffect(() => {
				if (queue.length === 0 && !collapsed) setCollapsed(true);
			}, [collapsed, queue.length]);
			if (parsedRows.length === 0) return null;
			const expanded = !collapsed || busy !== null;
			const listVisible = parsedRows.length === 1 || expanded;
			const applyAction = async (itemId, action, failure) => {
				setBusy(itemId);
				try {
					await updateQueue(itemId, action);
					return true;
				} catch {
					notify("error", failure);
					return false;
				} finally {
					setBusy((current) => current === itemId ? null : current);
				}
			};
			const startEdit = async (row, parsed) => {
				if (row.text === null) return;
				setBusy(row.id);
				try {
					if (parsed.enqueuedAt) {
						editingBySession.set(sessionId, {
							rowId: row.id,
							enqueuedAt: parsed.enqueuedAt,
							taskId: parsed.taskId
						});
						emitEditChange();
						inputActions.setDraft(parsed.text);
						focusComposer();
						return;
					}
					await updateQueue(row.id, { kind: "remove" });
					inputActions.setDraft(parsed.text);
					focusComposer();
				} catch {
					notify("error", "无法把排队任务放回输入框");
				} finally {
					setBusy((current) => current === row.id ? null : current);
				}
			};
			return jsx.jsx("div", {
				className: "dshCheapQ_dock",
				"data-queue-dock": "",
				"data-cheap-queue": "",
				children: jsx.jsxs("div", {
					className: "dshCheapQ_panel",
					children: [
						queue.length > 1 && parsedRows.length > 1 && jsx.jsxs("button", {
							type: "button",
							className: "dshCheapQ_header",
							"aria-controls": listId,
							"aria-expanded": expanded,
							disabled: busy !== null,
							onClick: () => setCollapsed((value) => !value),
							children: [
								jsx.jsx("span", {
									className: "dshCheapQ_lead",
									"aria-hidden": true,
									children: jsx.jsx(primitives.IconQueueOutline14, {})
								}),
								jsx.jsx("span", {
									className: "dshCheapQ_count",
									children: `${parsedRows.length} 条排队消息`
								}),
								jsx.jsx("span", {
									className: "dshCheapQ_chevron",
									"aria-hidden": true,
									children: expanded
										? jsx.jsx(primitives.IconChevronDownOutline14, {})
										: jsx.jsx(primitives.IconChevronUpOutline14, {})
								})
							]
						}),
						jsx.jsx("ul", {
							id: listId,
							className: "dshCheapQ_list",
							hidden: !listVisible,
							children: listVisible && parsedRows.map(({ row, parsed }) => {
								const label = parsed.enqueuedAt ? formatEnqueueLabel(parsed.enqueuedAt, now) : "";
								const cheap = Boolean(parsed.enqueuedAt);
								return jsx.jsxs("li", {
									className: "dshCheapQ_row",
									children: [
										parsedRows.length === 1 && jsx.jsx("span", {
											className: "dshCheapQ_lead",
											"aria-hidden": true,
											children: jsx.jsx(primitives.IconQueueOutline14, {})
										}),
										jsx.jsx("span", {
											className: "dshCheapQ_preview",
											title: parsed.text,
											children: previewOf(parsed.text) || row.preview
										}),
										label ? jsx.jsx("span", {
											className: "dshCheapQ_time",
											title: "入队时间（不是发给 DeepSeek 的时间）",
											children: label
										}) : null,
										queueMutable && jsx.jsxs("div", {
											className: "dshCheapQ_actions",
											children: [
												jsx.jsx(primitives.Tooltip, {
													label: "编辑（放回输入框）",
													side: "bottom",
													delayMs: 500,
													disabled: row.text === null,
													children: jsx.jsx("button", {
														type: "button",
														className: "dshCheapQ_action",
														"aria-label": "编辑排队消息",
														disabled: busy !== null || row.text === null,
														onClick: () => startEdit(row, parsed),
														children: jsx.jsx(primitives.IconEditOutline16, { size: 14 })
													})
												}),
												jsx.jsx(primitives.Tooltip, {
													label: "删除",
													side: "bottom",
													delayMs: 500,
													children: jsx.jsx("button", {
														type: "button",
														className: "dshCheapQ_action",
														"aria-label": "删除排队消息",
														disabled: busy !== null,
														onClick: () => applyAction(row.id, { kind: "remove" }, "删除排队消息失败"),
														children: jsx.jsx(primitives.IconTrashOutline16, { size: 14 })
													})
												}),
												!cheap && jsx.jsx(primitives.Tooltip, {
													label: running ? "立刻发给当前回合" : "当前没有进行中的回合",
													side: "bottom",
													delayMs: 500,
													disabled: !running,
													children: jsx.jsx("button", {
														type: "button",
														className: "dshCheapQ_action",
														"aria-label": "立刻发送排队消息",
														disabled: busy !== null || !running,
														onClick: () => applyAction(row.id, { kind: "steer" }, "立刻发送失败"),
														children: jsx.jsx(primitives.IconSendOutline14, {})
													})
												})
											]
										})
									]
								}, row.id);
							})
						})
					]
				})
			});
		}

		const inject = ["slots", "conversation", "sessions"];

		function apply(ctx) {
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "cheap-queue",
				order: 21,
				inject: (sessionId) => {
					const actx = ctx.sessions.scope(sessionId);
					if (actx === void 0) throw new Error(`cheap queue dock: session "${sessionId}" resolved no scope`);
					const conversation = actx.get("conversation");
					if (conversation === void 0) throw new Error("cheap queue dock: conversation service unavailable");
					const input = conversation.input.for(actx);
					if (!patchedInputs.has(input) && typeof input.submit === "function") {
						const originalSubmit = input.submit.bind(input);
						input.submit = (mode) => {
							const editing = editingBySession.get(sessionId);
							if (!editing) return originalSubmit(mode);
							const snap = input.state?.getSnapshot?.() ?? input.snapshot;
							const text = stripCheapCommandPrefix(String(snap?.draft ?? "").trim());
							if (!text) {
								editingBySession.delete(sessionId);
								emitEditChange();
								return;
							}
							editingBySession.delete(sessionId);
							emitEditChange();
							const wrapped = wrapCheapText(text, editing.enqueuedAt, editing.taskId);
							Promise.resolve(conversation.updateQueue(editing.rowId, {
								kind: "edit",
								content: [{ type: "text", text: wrapped }]
							})).then(() => {
								input.setDraft("");
							}).catch(() => {
								editingBySession.set(sessionId, editing);
								emitEditChange();
								input.notify("error", "保存排队任务失败");
							});
						};
						patchedInputs.add(input);
					}
					return {
						updateQueue: (itemId, action) => conversation.updateQueue(itemId, action),
						notify: (level, text) => {
							conversation.input.for(actx).notify(level, text);
						}
					};
				}
			}, CheapQueueDock));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
