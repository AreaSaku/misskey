/*
 * SPDX-FileCopyrightText: syuilo and other misskey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SoundStore } from '@/store.js';
import { defaultStore } from '@/store.js';
import * as os from '@/os.js';

let ctx: AudioContext;
const cache = new Map<string, AudioBuffer>();
let canPlay = true;

export const soundsTypes = [
	// 音声なし
	null,

	// ドライブの音声
	'_driveFile_',

	// プリインストール
	'gengyou/New-Posts-ririse',
	'gengyou/New-My-Posts-ririse',
	'gengyou/Notice-ririse',
	'gengyou/New-Antenna-Posts-ririse',
	'gengyou/New-Channel-Posts-ririse',
	'gengyou/New-Posts-kiritan',
	'gengyou/New-My-Posts-kiritan',
	'gengyou/Notice-kiritan',
	'gengyou/Square-Wave-10Hz-3sec',
	'gengyou/Our-Shinano',
	'kq/Police-alert-sound',
	'r_/New-Posts-r_',
	'r_/New-My-Posts-r_',
	'r_/Notice1-r_',
	'r_/Notice2-r_',
] as const;

export const operationTypes = [
	'noteMy',
	'note',
	'antenna',
	'channel',
	'notification',
	'reaction',
] as const;

/** サウンドの種類 */
export type SoundType = typeof soundsTypes[number];

/** スプライトの種類 */
export type OperationType = typeof operationTypes[number];

/**
 * 音声を読み込む
 * @param soundStore サウンド設定
 * @param options `useCache`: デフォルトは`true` 一度再生した音声はキャッシュする
 */
export async function loadAudio(soundStore: SoundStore, options?: { useCache?: boolean; }) {
	if (_DEV_) console.log('loading audio. opts:', options);
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (soundStore.type === null || (soundStore.type === '_driveFile_' && !soundStore.fileUrl)) {
		return;
	}
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (ctx == null) {
		ctx = new AudioContext();
	}
	if (options?.useCache ?? true) {
		if (soundStore.type === '_driveFile_' && cache.has(soundStore.fileId)) {
			if (_DEV_) console.log('use cache');
			return cache.get(soundStore.fileId) as AudioBuffer;
		} else if (cache.has(soundStore.type)) {
			if (_DEV_) console.log('use cache');
			return cache.get(soundStore.type) as AudioBuffer;
		}
	}

	let response: Response;

	if (soundStore.type === '_driveFile_') {
		try {
			response = await fetch(soundStore.fileUrl);
		} catch (err) {
			try {
				// URLが変わっている可能性があるのでドライブ側からURLを取得するフォールバック
				const apiRes = await os.api('drive/files/show', {
					fileId: soundStore.fileId,
				});
				response = await fetch(apiRes.url);
			} catch (fbErr) {
				// それでも無理なら諦める
				return;
			}
		}
	} else {
		try {
			response = await fetch(`/client-assets/sounds/${soundStore.type}.mp3`);
		} catch (err) {
			return;
		}
	}

	const arrayBuffer = await response.arrayBuffer();
	const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

	if (options?.useCache ?? true) {
		if (soundStore.type === '_driveFile_') {
			cache.set(soundStore.fileId, audioBuffer);
		} else {
			cache.set(soundStore.type, audioBuffer);
		}
	}

	return audioBuffer;
}

/**
 * 既定のスプライトを再生する
 * @param type スプライトの種類を指定
 */
export function play(operationType: OperationType) {
	const sound = defaultStore.state[`sound_${operationType}`];
	if (_DEV_) console.log('play', operationType, sound);
	if (sound.type == null || !canPlay) return;

	canPlay = false;
	playFile(sound).then(() => {
		// ごく短時間に音が重複しないように
		setTimeout(() => {
			canPlay = true;
		}, 25);
	});
}

/**
 * サウンド設定形式で指定された音声を再生する
 * @param soundStore サウンド設定
 */
export async function playFile(soundStore: SoundStore) {
	const buffer = await loadAudio(soundStore);
	if (!buffer) return;
	createSourceNode(buffer, soundStore.volume)?.start();
}

export function createSourceNode(buffer: AudioBuffer, volume: number) : AudioBufferSourceNode | null {
	const masterVolume = defaultStore.state.sound_masterVolume;
	if (isMute() || masterVolume === 0 || volume === 0) {
		return null;
	}

	const gainNode = ctx.createGain();
	gainNode.gain.value = masterVolume * volume;

	const soundSource = ctx.createBufferSource();
	soundSource.buffer = buffer;
	soundSource.connect(gainNode).connect(ctx.destination);

	return soundSource;
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
