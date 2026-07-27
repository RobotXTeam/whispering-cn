<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Switch } from '@epicenter/ui/switch';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<svelte:head>
	<title>声音设置 - Whispering</title>
</svelte:head>

<Field.Set>
	<Field.Legend>声音</Field.Legend>
	<Field.Description>
		配置你的 Whispering 声音偏好。
	</Field.Description>
	<Field.Separator />
	<Field.Group>
		<Field.Set>
			<Field.Legend variant="label">手动录音声音</Field.Legend>
			<Field.Description>
				配置手动录音事件的声音。
			</Field.Description>
			<Field.Group>
				<Field.Field orientation="horizontal">
					<Switch
						id="sound.playOn.manual-start"
						bind:checked={
							() => settings.value['sound.playOn.manual-start'],
							(v) => settings.updateKey('sound.playOn.manual-start', v)
						}
					/>
					<Field.Label for="sound.playOn.manual-start">
						手动录音开始时播放声音
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="sound.playOn.manual-stop"
						bind:checked={
							() => settings.value['sound.playOn.manual-stop'],
							(v) => settings.updateKey('sound.playOn.manual-stop', v)
						}
					/>
					<Field.Label for="sound.playOn.manual-stop">
						手动录音停止时播放声音
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="sound.playOn.manual-cancel"
						bind:checked={
							() => settings.value['sound.playOn.manual-cancel'],
							(v) => settings.updateKey('sound.playOn.manual-cancel', v)
						}
					/>
					<Field.Label for="sound.playOn.manual-cancel">
						取消手动录音时播放声音
					</Field.Label>
				</Field.Field>
			</Field.Group>
		</Field.Set>

		<Field.Separator />

		<Field.Set>
			<Field.Legend variant="label">VAD 录音声音</Field.Legend>
			<Field.Description>
				配置语音活动检测事件的声音。
			</Field.Description>
			<Field.Group>
				<Field.Field orientation="horizontal">
					<Switch
						id="sound.playOn.vad-start"
						bind:checked={
							() => settings.value['sound.playOn.vad-start'],
							(v) => settings.updateKey('sound.playOn.vad-start', v)
						}
					/>
					<Field.Label for="sound.playOn.vad-start">
						VAD 录音会话开始时播放声音
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="sound.playOn.vad-capture"
						bind:checked={
							() => settings.value['sound.playOn.vad-capture'],
							(v) => settings.updateKey('sound.playOn.vad-capture', v)
						}
					/>
					<Field.Label for="sound.playOn.vad-capture">
						VAD 捕获时播放声音
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="sound.playOn.vad-stop"
						bind:checked={
							() => settings.value['sound.playOn.vad-stop'],
							(v) => settings.updateKey('sound.playOn.vad-stop', v)
						}
					/>
					<Field.Label for="sound.playOn.vad-stop">
						VAD 录音会话停止时播放声音
					</Field.Label>
				</Field.Field>
			</Field.Group>
		</Field.Set>

		<Field.Separator />

		<Field.Set>
			<Field.Legend variant="label">完成声音</Field.Legend>
			<Field.Description>
				配置转录和转换完成时的声音。
			</Field.Description>
			<Field.Group>
				<Field.Field orientation="horizontal">
					<Switch
						id="play-sound-transcription"
						bind:checked={
							() => settings.value['sound.playOn.transcriptionComplete'],
							(v) => settings.updateKey('sound.playOn.transcriptionComplete', v)
						}
					/>
					<Field.Label for="play-sound-transcription">
						转录后播放声音
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="play-sound-transformation"
						bind:checked={
							() => settings.value['sound.playOn.transformationComplete'],
							(v) =>
								settings.updateKey('sound.playOn.transformationComplete', v)
						}
					/>
					<Field.Label for="play-sound-transformation">
						转换后播放声音
					</Field.Label>
				</Field.Field>
			</Field.Group>
		</Field.Set>
	</Field.Group>
</Field.Set>
