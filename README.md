# dsh-cheap-hours

DeepSeek Harness 插件：用 `/cheap`（别名 `/nap`）把任务排到 DeepSeek **低峰**再跑。作者：zesheng.zhou

默认高峰（北京时间，可改）：**09:00–12:00、14:00–18:00**。其余为空闲时段，单价大约是高峰一半。

普通聊天仍然立即发送。只有斜杠指令排进去的任务才会等待。

## 安装

```powershell
dsh plugin --profile web add <本仓库路径>
dsh web
```

Windows 路径里有空格时，`dsh plugin add` 可能拆错路径，可先做目录联接：

```powershell
cmd /c mklink /J %USERPROFILE%\.dsh\local-plugins\dsh-cheap-hours "<本仓库路径>"
dsh plugin --profile web add %USERPROFILE%\.dsh\local-plugins\dsh-cheap-hours
```

改代码后执行 `npm run build`，再重启 `dsh web`。

`dsh web` 必须一直开着，低峰到点才会投递。若进程在低峰时没起来，下次启动若已在低峰会立刻补发。

## 斜杠指令

| 指令 | 作用 |
|------|------|
| `/cheap 帮我重构鉴权` | 高峰则排队，低峰则立刻跑 |
| `/nap 同样的事` | `/cheap` 的别名 |
| `/cheap` | 看队列、下一窗口、是否高峰 |
| `/cheap now` | 立刻跑掉排队任务（高峰也发） |
| `/cheap drop` | 清空队列 |
| `/cheap hours` | 显示高峰 |
| `/cheap hours 09:00-12:00,14:00-18:00` | 修改高峰（写入 `~/.dsh/cheap-hours.json`） |

## 队列

| 位置 | 说明 |
|------|------|
| `%USERPROFILE%\.dsh\cheap-hours.json` | 落盘队列（跨重启，与是否刷新网页无关） |
| 会话页面底部队列条 | 预览 + 入队时间 + 编辑/删除 |

队列条上的时间是入队时刻（一分钟内显示「刚刚」，之后显示时分秒），不是稍后发给 DeepSeek 的低峰时间。点编辑会把原文放回输入框并保存回同一条记录。
