/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type { Packed } from '@/misc/json-schema.js';
import type { DriveFilesRepository } from '@/models/_.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type Connection from '@/server/api/stream/Connection.js';
import type { NoteStreamingHidingService } from '@/server/api/stream/NoteStreamingHidingService.js';
import { NsfwTimelineChannel } from '@/server/api/stream/channels/nsfw-timeline.js';

vi.mock('@/core/entities/NoteEntityService.js', () => ({ NoteEntityService: class {} }));
vi.mock('@/server/api/stream/NoteStreamingHidingService.js', () => ({ NoteStreamingHidingService: class {} }));

function createNote(overrides: Partial<Packed<'Note'>> = {}): Packed<'Note'> {
	return {
		id: 'note',
		createdAt: new Date(0).toISOString(),
		userId: 'author',
		user: { id: 'author', host: 'remote.example' },
		text: 'image post',
		cw: null,
		visibility: 'public',
		fileIds: ['image'],
		// Remote media is deliberately serialized as non-sensitive by WKH.
		files: [{ id: 'image', type: 'image/png', isSensitive: false }],
		...overrides,
	} as Packed<'Note'>;
}

describe('NSFW timeline stream', () => {
	let subscriber: EventEmitter;
	let connection: Connection;
	let driveFilesRepository: Mocked<Pick<DriveFilesRepository, 'existsBy'>>;
	let noteEntityService: Mocked<Pick<NoteEntityService, 'withMyRenoteReaction'>>;
	let noteStreamingHidingService: Mocked<Pick<NoteStreamingHidingService, 'filter'>>;
	let channel: NsfwTimelineChannel;

	beforeEach(async () => {
		subscriber = new EventEmitter();
		connection = {
			user: { id: 'viewer' },
			subscriber,
			userIdsWhoMeMuting: new Set(),
			userIdsWhoMeMutingRenotes: new Set(),
			userIdsWhoBlockingMe: new Set(),
			userMutedInstances: new Set(),
			mutingChannels: new Set(),
			sendMessageToWs: vi.fn(),
		} as unknown as Connection;
		driveFilesRepository = { existsBy: vi.fn().mockResolvedValue(true) };
		noteEntityService = { withMyRenoteReaction: vi.fn().mockImplementation(async note => note) };
		noteStreamingHidingService = { filter: vi.fn().mockImplementation(async note => note) };
		channel = new NsfwTimelineChannel(
			{ id: 'subscription', connection },
			driveFilesRepository as unknown as DriveFilesRepository,
			noteEntityService as unknown as NoteEntityService,
			noteStreamingHidingService as unknown as NoteStreamingHidingService,
		);
		await channel.init({});
	});

	async function publish(note: Packed<'Note'>) {
		await Promise.all(subscriber.listeners('notesStream').map(listener => listener(note)));
	}

	test('sends database-qualified media even when the packed sensitivity flag is false', async () => {
		const note = createNote();

		await publish(note);

		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', {
			id: 'subscription',
			type: 'note',
			body: note,
		});
	});

	test('does not send media that fails the database sensitivity and remote-image check', async () => {
		driveFilesRepository.existsBy.mockResolvedValue(false);

		await publish(createNote());

		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
		expect(noteStreamingHidingService.filter).not.toHaveBeenCalled();
	});

	test.each(['home', 'followers', 'specified'] as const)('excludes %s notes before fetching media', async visibility => {
		await publish(createNote({ visibility }));

		expect(driveFilesRepository.existsBy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('excludes channel posts', async () => {
		await publish(createNote({ channelId: 'channel' }));

		expect(driveFilesRepository.existsBy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('excludes notes without attachments', async () => {
		await publish(createNote({ fileIds: [], files: [] }));

		expect(driveFilesRepository.existsBy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test.each(['userIdsWhoMeMuting', 'userIdsWhoBlockingMe'] as const)('honors %s', async key => {
		connection[key].add('author');

		await publish(createNote());

		expect(driveFilesRepository.existsBy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('honors muted remote instances', async () => {
		connection.userMutedInstances.add('remote.example');

		await publish(createNote());

		expect(driveFilesRepository.existsBy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('keeps image quotes when pure renotes are disabled', async () => {
		channel.dispose();
		await channel.init({ withRenotes: false });
		const note = createNote({ renoteId: 'original', renote: createNote({ id: 'original' }) });

		await publish(note);

		expect(connection.sendMessageToWs).toHaveBeenCalledOnce();
	});

	test('honors the upstream hiding service decision', async () => {
		noteStreamingHidingService.filter.mockResolvedValue(null);

		await publish(createNote());

		expect(noteStreamingHidingService.filter).toHaveBeenCalledWith(expect.anything(), 'viewer');
		expect(noteEntityService.withMyRenoteReaction).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});

	test('forwards the viewer-specific copy instead of modifying the shared note', async () => {
		const note = createNote({ renoteId: 'original', renote: createNote({ id: 'original' }) });
		const before = structuredClone(note);
		const viewerNote = structuredClone(note);
		viewerNote.renote!.myReaction = 'viewer-reaction';
		noteEntityService.withMyRenoteReaction.mockResolvedValue(viewerNote);

		await publish(note);

		expect(noteEntityService.withMyRenoteReaction).toHaveBeenCalledWith(note, 'viewer');
		expect(connection.sendMessageToWs).toHaveBeenCalledWith('channel', expect.objectContaining({ body: viewerNote }));
		expect(note).toEqual(before);
	});

	test('stops receiving shared notes when the channel is disposed', async () => {
		expect(subscriber.listenerCount('notesStream')).toBe(1);
		channel.dispose();

		await publish(createNote());

		expect(subscriber.listenerCount('notesStream')).toBe(0);
		expect(driveFilesRepository.existsBy).not.toHaveBeenCalled();
		expect(connection.sendMessageToWs).not.toHaveBeenCalled();
	});
});
