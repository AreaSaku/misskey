/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, Scope } from '@nestjs/common';
import { In, IsNull, Like, Not } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import type { Packed } from '@/misc/json-schema.js';
import type { DriveFilesRepository } from '@/models/_.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { isQuotePacked, isRenotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import { NoteStreamingHidingService } from '../NoteStreamingHidingService.js';
import Channel, { type ChannelRequest } from '../channel.js';

@Injectable({ scope: Scope.TRANSIENT })
export class NsfwTimelineChannel extends Channel {
	public readonly chName = 'nsfwTimeline';
	public static shouldShare = false as const;
	public static requireCredential = true as const;
	private withRenotes: boolean;

	constructor(
		@Inject(REQUEST)
		request: ChannelRequest,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private noteEntityService: NoteEntityService,
		private noteStreamingHidingService: NoteStreamingHidingService,
	) {
		super(request);
	}

	@bindThis
	public async init(params: JsonObject) {
		this.withRenotes = !!(params.withRenotes ?? true);
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		if (note.fileIds == null || note.fileIds.length === 0) return;
		if (note.visibility !== 'public') return;
		if (note.channelId != null) return;
		if (isRenotePacked(note) && !isQuotePacked(note) && !this.withRenotes) return;
		if (this.isNoteMutedOrBlocked(note)) return;

		const hasRemoteSensitiveImage = await this.driveFilesRepository.existsBy({
			id: In(note.fileIds),
			isSensitive: true,
			userHost: Not(IsNull()),
			type: Like('image/%'),
		});
		if (!hasRemoteSensitiveImage) return;

		const filtered = await this.noteStreamingHidingService.filter(note, this.user!.id);
		if (!filtered) return;
		note = filtered;

		if (isRenotePacked(note) && !isQuotePacked(note) && note.renote && Object.keys(note.renote.reactions).length > 0) {
			const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user!.id);
			note.renote.myReaction = myRenoteReaction;
		}

		this.send('note', note);
	}

	@bindThis
	public dispose() {
		this.subscriber.off('notesStream', this.onNote);
	}
}
