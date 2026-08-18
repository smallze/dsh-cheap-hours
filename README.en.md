# dsh-cheap-hours

[中文](./README.md) | [English](./README.en.md)

DeepSeek Harness plugin: queue `/cheap` (alias `/nap`) tasks until DeepSeek off-peak hours.
Author: zesheng.zhou

Default peak windows (Beijing time): **09:00–12:00, 14:00–18:00**.

Normal chat is still sent immediately. Only slash-command tasks are queued.

## Install

```powershell
dsh plugin --profile web add <local-plugin-path>
dsh web
```

If your Windows path contains spaces, use a junction first:

```powershell
cmd /c mklink /J %USERPROFILE%\.dsh\local-plugins\dsh-cheap-hours "<local-plugin-path>"
dsh plugin --profile web add %USERPROFILE%\.dsh\local-plugins\dsh-cheap-hours
```

After code changes, run `npm run build` and restart `dsh web`.

`dsh web` must stay running for timed delivery. If it is down at off-peak time, due tasks are dispatched when it starts again.

## Deploy on Another Machine

Recommended: install directly from GitHub:

```powershell
dsh plugin --profile web add https://github.com/smallze/dsh-cheap-hours
dsh web
```

Optional config (custom peak windows), edit `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`:

```yaml
- id: cheap-hours
  config:
    timezone: Asia/Shanghai
    peakWindows:
      - { start: "09:00", end: "12:00" }
      - { start: "14:00", end: "18:00" }
```

## Slash Commands

| Command | Behavior |
|------|------|
| `/cheap refactor auth` | Queue in peak, run immediately in off-peak |
| `/nap same task` | Alias of `/cheap` |
| `/cheap` | Show queue/status/next window |
| `/cheap now` | Dispatch queued tasks immediately |
| `/cheap drop` | Clear queue |
| `/cheap hours` | Show current peak windows |
| `/cheap hours 09:00-12:00,14:00-18:00` | Update peak windows (`~/.dsh/cheap-hours.json`) |

## Queue

| Location | Description |
|------|------|
| `%USERPROFILE%\.dsh\cheap-hours.json` | Persisted queue (survives restart and page refresh) |
| Queue dock above composer | Preview + enqueue time + edit/delete |

Queue time shows original enqueue time (`just now` within one minute, then `HH:mm:ss`), not delayed dispatch time. Edit writes back to the same queue record.
