/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SoundStore } from '@/store.js';
import { defaultStore } from '@/store.js';

let ctx: AudioContext;
const cache = new Map<string, AudioBuffer>();
let canPlay = true;

export const soundsTypes = [
	// 音声なし
	null,

	// ドライブの音声
	'_driveFile_',

	// プリインストール
	'cx/New-Posts-ririse',
	'cx/New-My-Posts-ririse',
	'cx/Notice-ririse',
	'cx/New-Antenna-Posts-ririse',
	'cx/New-Channel-Posts-ririse',
	'cx/New-Posts-kiritan',
	'cx/New-My-Posts-kiritan',
	'cx/Notice-kiritan',
	'cx/Square-Wave-10Hz-3sec',
	'cx/Our-Shinano',
	'cx/ノコギリ波',
	'cx/無音',
	'r_/New-Posts-r_',
	'r_/New-My-Posts-r_',
	'r_/Notice1-r_',
	'r_/Notice2-r_',
	'r_/antenna-r_',
	'r_/channel-r_',
	'r_/myreaction-r_',
	'r_/unn-r_',
	'GB2110/kankai',
	'GB2110/YMU251-D104-unused',
	'GB2110/5MH601RH18_OP',
	'GB2110/5MH601RH18_dingdong',
	'GB2110/5MH601RH18_ED',
	'oishitake/soga',
	'oishitake/Chiba-City-Song',
	'kq/Police-alert',
	'kq/Police-alert-sound',
	'kq/209chime',
	'keikyu/siemens-gto',
	'keikyu/pass',
	'nagoya/higashiyama-f',
	'nagoya/higashiyama-t',
	'nagoya/meijo-r',
	'nagoya/meijo-l',
	'nagoya/meiko-n',
	'nagoya/meiko-k',
	'nagoya/tsurumai-a',
	'nagoya/tsurumai-k',
	'nagoya/sakuradori-to',
	'nagoya/sakuradori-ta',	
	'syuilo/n-aec',
	'syuilo/n-cea-4va',
	'syuilo/n-ea',
	'syuilo/triple',
	'syuilo/square-pico',
] as const;

export const operationTypes = [
	'noteMy',
	'note',
	'notification',
	'reaction',
] as const;

/** サウンドの種類 */
export type SoundType = typeof soundsTypes[number];

/** スプライトの種類 */
export type OperationType = typeof operationTypes[number];

/**
 * 音声を読み込む
 * @param url url
 * @param options `useCache`: デフォルトは`true` 一度再生した音声はキャッシュする
 */
export async function loadAudio(url: string, options?: { useCache?: boolean; }) {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (ctx == null) {
		ctx = new AudioContext();
	}
	if (options?.useCache ?? true) {
		if (cache.has(url)) {
			return cache.get(url) as AudioBuffer;
		}
	}

	let response: Response;

	try {
		response = await fetch(url);
	} catch (err) {
		return;
	}

	const arrayBuffer = await response.arrayBuffer();
	const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

	if (options?.useCache ?? true) {
		cache.set(url, audioBuffer);
	}

	return audioBuffer;
}

/**
 * 既定のスプライトを再生する
 * @param type スプライトの種類を指定
 */
export function playMisskeySfx(operationType: OperationType) {
	const sound = defaultStore.state[`sound_${operationType}`];
	playMisskeySfxFile(sound).then((succeed) => {
		if (!succeed && sound.type === '_driveFile_') {
			// ドライブファイルが存在しない場合はデフォルトのサウンドを再生する
			const soundName = defaultStore.def[`sound_${operationType}`].default.type as Exclude<SoundType, '_driveFile_'>;
			if (_DEV_) console.log(`Failed to play sound: ${sound.fileUrl}, so play default sound: ${soundName}`);
			playMisskeySfxFileInternal({
				type: soundName,
				volume: sound.volume,
			});
		}
	});
}

/**
 * サウンド設定形式で指定された音声を再生する
 * @param soundStore サウンド設定
 */
export async function playMisskeySfxFile(soundStore: SoundStore): Promise<boolean> {
	// 連続して再生しない
	if (!canPlay) return false;
	// ユーザーアクティベーションが必要な場合はそれがない場合は再生しない
	if ('userActivation' in navigator && !navigator.userActivation.hasBeenActive) return false;
	// サウンドがない場合は再生しない
	if (soundStore.type === null || soundStore.type === '_driveFile_' && !soundStore.fileUrl) return false;

	canPlay = false;
	return await playMisskeySfxFileInternal(soundStore).finally(() => {
		// ごく短時間に音が重複しないように
		setTimeout(() => {
			canPlay = true;
		}, 25);
	});
}

async function playMisskeySfxFileInternal(soundStore: SoundStore): Promise<boolean> {
	if (soundStore.type === null || (soundStore.type === '_driveFile_' && !soundStore.fileUrl)) {
		return false;
	}
	const masterVolume = defaultStore.state.sound_masterVolume;
	if (isMute() || masterVolume === 0 || soundStore.volume === 0) {
		return true; // ミュート時は成功として扱う
	}
	const url = soundStore.type === '_driveFile_' ? soundStore.fileUrl : `/client-assets/sounds/${soundStore.type}.mp3`;
	const buffer = await loadAudio(url).catch(() => {
		return undefined;
	});
	if (!buffer) return false;
	const volume = soundStore.volume * masterVolume;
	createSourceNode(buffer, { volume }).soundSource.start();
	return true;
}

export async function playUrl(url: string, opts: {
	volume?: number;
	pan?: number;
	playbackRate?: number;
}) {
	if (opts.volume === 0) {
		return;
	}
	const buffer = await loadAudio(url);
	if (!buffer) return;
	createSourceNode(buffer, opts).soundSource.start();
}

export function createSourceNode(buffer: AudioBuffer, opts: {
	volume?: number;
	pan?: number;
	playbackRate?: number;
}): {
	soundSource: AudioBufferSourceNode;
	panNode: StereoPannerNode;
	gainNode: GainNode;
} {
	const panNode = ctx.createStereoPanner();
	panNode.pan.value = opts.pan ?? 0;

	const gainNode = ctx.createGain();

	gainNode.gain.value = opts.volume ?? 1;

	const soundSource = ctx.createBufferSource();
	soundSource.buffer = buffer;
	soundSource.playbackRate.value = opts.playbackRate ?? 1;
	soundSource
		.connect(panNode)
		.connect(gainNode)
		.connect(ctx.destination);

	return { soundSource, panNode, gainNode };
}

/**
 * 音声の長さをミリ秒で取得する
 * @param file ファイルのURL（ドライブIDではない）
 */
export async function getSoundDuration(file: string): Promise<number> {
	const audioEl = document.createElement('audio');
	audioEl.src = file;
	return new Promise((resolve) => {
		const si = setInterval(() => {
			if (audioEl.readyState > 0) {
				resolve(audioEl.duration * 1000);
				clearInterval(si);
				audioEl.remove();
			}
		}, 100);
	});
}

/**
 * ミュートすべきかどうかを判断する
 */
export function isMute(): boolean {
	if (defaultStore.state.sound_notUseSound) {
		// サウンドを出力しない
		return true;
	}

	// noinspection RedundantIfStatementJS
	if (defaultStore.state.sound_useSoundOnlyWhenActive && document.visibilityState === 'hidden') {
		// ブラウザがアクティブな時のみサウンドを出力する
		return true;
	}

	return false;
}
