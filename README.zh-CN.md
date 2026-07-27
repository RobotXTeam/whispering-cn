# Whispering 中文版

> 基于 [EpicenterHQ/epicenter](https://github.com/EpicenterHQ/epicenter) Whispering `v7.11.0` 的中文化 fork —— AGPL-3.0

Whispering 是一款语音转文字桌面应用(Tauri v2 + Svelte 5 + Rust,内置 [whisper.cpp](https://github.com/ggerganov/whisper.cpp)),支持本地或云端转录、录音管理、文本转换、全局/应用内快捷键等。本仓库在上游 `v7.11.0` 基础上做了以下改动。

## ✨ 本 fork 的改动

### 1. Ubuntu 22.04 自构建(GLIBC 兼容)
官方预编译 deb 需要 **GLIBC 2.38+**,在 Ubuntu 22.04(GLIBC 2.35)上无法启动,报 `version GLIBC_2.38 not found`。本版本在 Ubuntu 22.04 上从源码重新编译,链接本地 GLIBC 2.34,**可直接运行**。

### 2. 全中文界面
所有用户可见的显示文本——界面、设置、提示、错误信息、托盘菜单、对话框、首次运行向导等——译为地道中文。代码标识符、设置键、CSS 类、品牌名保持原样。中文标点用全角。翻译由 LLM 辅助完成并经 `svelte-check` 与构建校验未破坏语法。

### 3. 中文语音识别默认
默认转录引擎改为本地 `whisper.cpp` + `ggml-small`(多语言模型,约 488MB),输出语言设为「自动检测」。实测对中文识别准确,**开箱即用,无需云端 API 或密钥**。当然仍可在设置里切换为 OpenAI / Groq / Deepgram / ElevenLabs / Mistral / Speaches / Parakeet / Moonshine 等其他引擎。

### 4. 禁用自动更新检查
启动时不再检查更新,以避免:① 自动更新到不兼容的官方 GLIBC 2.38+ 版本而再次打不开;② 网络不通时每次启动弹「检查更新失败」提示。

### 5. Wayland 全局快捷键(新增)
官方版在 GNOME Wayland 下全局热键**完全不工作**(`tauri-plugin-global-shortcut` 只有 X11 后端 `XGrabKey`,Wayland 下静默失效)。本 fork 加了一条 **GNOME 原生自定义快捷键 + D-Bus 单实例转发** 的桥绕过它:GNOME 抓键 → 跑 `whispering <命令>` 起第二进程 → `tauri-plugin-single-instance`(D-Bus,Wayland 可用)把参数转发给已运行的主实例 → 主实例发 `whispering://command` 事件给前端 → 前端按命令 id 调对应 `callback()`(与热键按下走同一条录音链)。`<Ctrl><Shift>;` 切换录音现已可用,详见下文「🎹 Wayland 全局快捷键」。

## 📥 下载安装

从 [Releases](../../releases) 下载 `Whispering_7.11.0_amd64.deb`,然后:

```bash
sudo dpkg -i Whispering_7.11.0_amd64.deb
sudo apt-get install -f   # 自动补齐依赖
```

启动:在应用菜单中搜索「Whispering」,或命令行执行 `whispering`。

## 🎙 首次使用(中文识别)

首次启动后默认引擎为本地 whisper.cpp。模型文件 `ggml-small.bin`(约 488MB)会自动下载到:

```
~/.local/share/com.bradenwong.whispering/models/whisper/ggml-small.bin
```

也可手动放置该文件以跳过下载。输出语言默认「自动」,会自动识别中文/英文等;如需强制中文,在「设置 → 转录 → 输出语言」选「中文」。

## ⚠️ 已知限制

- **自动粘贴到光标(Wayland 仍废)**:`writeToCursorOnSuccess` 在 GNOME Wayland 下不起作用——arboard 日志确认 GNOME 不给 `ext-data-control`,回退 X11 剪贴板,enigo 模拟输入进不了原生 Wayland 窗口。所以转写文字只进剪贴板,需手动 `Ctrl+V`。要彻底自动粘贴得上 ydotool/libei,另说。
- **`pushToTalk` 无全局快捷键**:它要「按下开始 / 松开停止」两个状态,一次性 CLI 调用表达不了,所以未纳入桥(其余命令都能桥,见下)。应用内仍可用。
- 仅构建 **Linux amd64** deb(未构建 macOS / Windows 包)。

## 🎹 Wayland 全局快捷键(本 fork 新增)

官方版在 GNOME Wayland 下全局热键**完全不工作**——`tauri-plugin-global-shortcut` 的 Linux 后端(`global-hotkey 0.7.0`)只有 X11 的 `XGrabKey`,Wayland 下注册"成功"但事件永不触发。改业务代码或升 Tauri 都救不了(瓶颈是插件无 Wayland 后端 + compositor 不给任意应用抓全局键的 API)。本 fork 用一条 **GNOME 原生 + D-Bus** 的桥绕过:

1. **GNOME 抓键**:`gsettings` 自定义快捷键(compositor 级、Wayland 原生),mutter 自己抓键、绑一条 shell 命令。这是 GNOME 42 下唯一干净的「全局键→命令」通道(`xdg-desktop-portal` 的 `InputCapture` 要 GNOME 47+)。
2. **命令触发主实例**:GNOME 跑 `whispering <command-id>`,起第二个进程;`tauri-plugin-single-instance`(D-Bus,Wayland 完全可用)检测到重复启动,把命令行参数转发给已运行的主实例回调。
3. **主实例转发为事件**:single-instance 回调(原本只 `set_focus`)改成——识别到已知 command id 就 `emit("whispering://command", id)` 给前端并返回。
4. **前端复用录音链**:`+layout.svelte` 的 `onMount` 监听该事件,按 id 在 `commands` 注册表里找到对应命令,调它的 `callback()`——和热键按下时走的是同一条录音链。

改动仅约 25 行(Rust `lib.rs` 加常量+改回调、前端 `+layout.svelte` 加 `onMount` 监听),"抓键"外包给 GNOME,"触发录音"复用已有链路。

**可桥命令**:`toggleManualRecording` `startManualRecording` `stopManualRecording` `cancelManualRecording` `startVadRecording` `stopVadRecording` `toggleVadRecording` `openTransformationPicker` `runTransformationOnClipboard`(都是 `() =>` 回调)。**不含 `pushToTalk`**(要按下/松开双态)。

**绑一个快捷键(示例:Ctrl+Shift+; 切换录音)**:

```bash
K=/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/
# 注意:custom-keybindings 是数组,设值会覆盖,务必先保留你已有的绑定再拼接
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings "['$K']"
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$K name 'Whispering 切换录音'
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$K command '/usr/bin/whispering toggleManualRecording'
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$K binding '<Ctrl><Shift>semicolon'
```

换键改最后一行(如 `<Super>F4`);要「停止录音」就再开一份 `custom1/`、`command` 换 `stopManualRecording`。绑定即时生效,无需重启。

> 验证过:在主实例运行时跑 `/usr/bin/whispering toggleManualRecording`,经 D-Bus 转发后主实例真的开始录音(创建 wav → cpal 音频流 → 停止时写 wav → 自动进 Whisper 中文转写),与按下 `<Ctrl><Shift>;` 走的是同一条路径。

## 🔨 从源码构建

```bash
# 系统依赖(Ubuntu 22.04)
sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libclang-dev \
  libasound2-dev libudev-dev libxkbcommon-dev libxkbfile-dev \
  libxcb1-dev libvulkan-dev mesa-vulkan-drivers \
  cmake build-essential pkg-config

# 工具链
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl -fsSL https://bun.sh/install | bash

# 构建
git clone https://github.com/RobotXTeam/whispering-cn.git
cd whispering-cn/apps/whispering
bun install
bun tauri build
# 产物:src-tauri/target/release/bundle/deb/Whispering_7.11.0_amd64.deb
```

> `transcribe-rs` 0.2.1 已 vendor 进仓(`apps/whispering/src-tauri/vendor/transcribe-rs/`),`Cargo.toml` 用相对路径 `[patch.crates-io]` 指向它——clone 即可构建,无需额外放置外部 crate。Linux target 的 `whisper-rs` 不启 `vulkan` feature,故 Ubuntu 22.04 无 `glslc` 也能编译(纯 CPU 后端,转录功能完整;Vulkan 仅 GPU 加速)。

## 📄 协议与致谢

- 上游:[EpicenterHQ/epicenter](https://github.com/EpicenterHQ/epicenter),© Braden Wong,**AGPL-3.0**。
- 本 fork 沿用 **AGPL-3.0**,源码与构建产物完全开放。
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) © Georgi Gerganov(MIT)。
- 中文翻译由 LLM 辅助完成。

---

*本 fork 不附属于 EpicenterHQ;目的仅是在 Ubuntu 22.04 上提供一个可用、中文化、中文识别友好的 Whispering。*
