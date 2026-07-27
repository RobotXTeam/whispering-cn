import { createTaggedError, extractErrorMessage } from 'wellcrafted/error';
import { Ok, type Result, tryAsync } from 'wellcrafted/result';
import { WHISPER_RECOMMENDED_MEDIA_TRACK_CONSTRAINTS } from '$lib/constants/audio';
import type {
	Device,
	DeviceAcquisitionOutcome,
	DeviceIdentifier,
	UpdateStatusMessageFn,
} from '$lib/services/types';
import { asDeviceIdentifier } from '$lib/services/types';

const { DeviceStreamServiceError, DeviceStreamServiceErr } = createTaggedError(
	'DeviceStreamServiceError',
);
type DeviceStreamServiceError = ReturnType<typeof DeviceStreamServiceError>;

/**
 * Check if we already have microphone permissions granted.
 * Uses Permissions API if available, otherwise returns false to trigger proper permission flow.
 */
async function hasExistingAudioPermission(): Promise<boolean> {
	// Try the Permissions API first (not all browsers support it)
	if ('permissions' in navigator) {
		const { data: permissionStatus, error } = await tryAsync({
			try: async () => {
				const permissionStatus = await navigator.permissions.query({
					name: 'microphone',
				});
				return permissionStatus;
			},
			catch: (error) =>
				DeviceStreamServiceErr({
					message: `我们需要权限才能访问您的麦克风。请检查浏览器设置后重试。${extractErrorMessage(error)}`,
				}),
		});
		if (!error) return permissionStatus.state === 'granted';
	}

	// Return false to let the actual getUserMedia call handle permissions
	// This avoids unnecessary stream creation just for checking
	return false;
}

export async function enumerateDevices(): Promise<
	Result<Device[], DeviceStreamServiceError>
> {
	const hasPermission = await hasExistingAudioPermission();
	if (!hasPermission) {
		// extension.openWhisperingTab({});
	}
	return tryAsync({
		try: async () => {
			const allAudioDevicesStream = await navigator.mediaDevices.getUserMedia({
				audio: WHISPER_RECOMMENDED_MEDIA_TRACK_CONSTRAINTS,
			});
			const devices = await navigator.mediaDevices.enumerateDevices();
			for (const track of allAudioDevicesStream.getTracks()) {
				track.stop();
			}
			const audioInputDevices = devices.filter(
				(device) => device.kind === 'audioinput',
			);
			// On Web: Return Device objects with both ID and label
			return audioInputDevices.map((device) => ({
				id: asDeviceIdentifier(device.deviceId),
				label: device.label,
			}));
		},
		catch: (error) =>
			DeviceStreamServiceErr({
				message: `我们需要权限才能访问您的麦克风。请检查浏览器设置后重试。${extractErrorMessage(error)}`,
			}),
	});
}

/**
 * Get a media stream for a specific device identifier
 * @param deviceIdentifier - The device identifier
 *   - On Web: This is the deviceId (unique identifier)
 *   - On Desktop: This is the device name
 */
async function getStreamForDeviceIdentifier(
	deviceIdentifier: DeviceIdentifier,
) {
	const hasPermission = await hasExistingAudioPermission();
	if (!hasPermission) {
		// extension.openWhisperingTab({});
	}
	return tryAsync({
		try: async () => {
			// On Web: deviceIdentifier IS the deviceId, use it directly
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					...WHISPER_RECOMMENDED_MEDIA_TRACK_CONSTRAINTS,
					deviceId: { exact: deviceIdentifier },
				},
			});
			return stream;
		},
		catch: (error) =>
			DeviceStreamServiceErr({
				message: `无法连接到所选麦克风。这可能是因为该设备已被其他应用占用、已断开连接,或缺少适当权限。请检查您的麦克风是否已连接、未被其他应用使用,并且已授予麦克风权限。 ${extractErrorMessage(error)}`,
			}),
	});
}

export async function getRecordingStream({
	selectedDeviceId,
	sendStatus,
}: {
	selectedDeviceId: DeviceIdentifier | null;
	sendStatus: UpdateStatusMessageFn;
}): Promise<
	Result<
		{ stream: MediaStream; deviceOutcome: DeviceAcquisitionOutcome },
		DeviceStreamServiceError
	>
> {
	// Try preferred device first if specified
	if (!selectedDeviceId) {
		// No device selected
		sendStatus({
			title: '🔍 未选择设备',
			description:
				"别担心!我们会自动为您寻找最合适的麦克风……",
		});
	} else {
		sendStatus({
			title: '🎯 正在连接设备',
			description:
				'马上就好!只需要您授权使用麦克风……',
		});

		const { data: preferredStream, error: getPreferredStreamError } =
			await getStreamForDeviceIdentifier(selectedDeviceId);

		if (!getPreferredStreamError) {
			return Ok({
				stream: preferredStream,
				deviceOutcome: { outcome: 'success', deviceId: selectedDeviceId },
			});
		}

		// We reach here if the preferred device failed, so we'll fall back to the first available device
		sendStatus({
			title: '⚠️ 正在寻找新麦克风',
			description:
				"那个麦克风不起作用。让我们试试找另一个……",
		});
	}

	// Try to get any available device as fallback
	const getFirstAvailableStream = async (): Promise<
		Result<
			{ stream: MediaStream; deviceId: DeviceIdentifier },
			DeviceStreamServiceError
		>
	> => {
		const { data: devices, error: enumerateDevicesError } =
			await enumerateDevices();
		if (enumerateDevicesError)
			return DeviceStreamServiceErr({
				message:
					'枚举录音设备并获取第一个可用流时出错。请确认您已授予访问音频设备的权限',
			});

		for (const device of devices) {
			const { data: stream, error } = await getStreamForDeviceIdentifier(
				device.id,
			);
			if (!error) {
				return Ok({ stream, deviceId: device.id });
			}
		}

		return DeviceStreamServiceErr({
			message: '无法连接到任何可用的麦克风',
		});
	};

	// Get fallback stream
	const { data: fallbackStreamData, error: getFallbackStreamError } =
		await getFirstAvailableStream();
	if (getFallbackStreamError) {
		const errorMessage = selectedDeviceId
			? "我们无法连接到任何麦克风。请确认已插好并重试!"
			: "嗯……我们找不到可用的麦克风。请检查连接后重试!";
		return DeviceStreamServiceErr({
			message: errorMessage,
		});
	}

	// Return the stream with appropriate device outcome
	if (!selectedDeviceId) {
		return Ok({
			stream: fallbackStreamData.stream,
			deviceOutcome: {
				outcome: 'fallback',
				reason: 'no-device-selected',
				deviceId: fallbackStreamData.deviceId,
			},
		});
	}
	return Ok({
		stream: fallbackStreamData.stream,
		deviceOutcome: {
			outcome: 'fallback',
			reason: 'preferred-device-unavailable',
			deviceId: fallbackStreamData.deviceId,
		},
	});
}

export function cleanupRecordingStream(stream: MediaStream) {
	for (const track of stream.getTracks()) {
		track.stop();
	}
}
