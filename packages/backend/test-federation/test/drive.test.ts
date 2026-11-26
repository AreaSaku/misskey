import { describe, test, beforeAll, vi } from 'vitest';
import assert, { strictEqual } from 'node:assert';
import * as Misskey from 'misskey-js';
import { createAccount, deepStrictEqualWithExcludedFields, fetchAdmin, type LoginUser, resolveRemoteNote, resolveRemoteUser, sleep, uploadFile, waitForFollowRelation, WAIT_FOR_FEDERATION } from './utils.js';

const aAdmin = await fetchAdmin('a.test');
const bAdmin = await fetchAdmin('b.test');

async function assertRemoteSensitive(note: Misskey.entities.Note, viewer: LoginUser) {
	assert(note.files != null);
	strictEqual(note.files.length, 1);
	// WKH intentionally masks the remote API flag, but retains the real flag in storage.
	strictEqual(note.files[0].isSensitive, false);
	await vi.waitFor(async () => {
		const timeline = await viewer.client.request('notes/nsfw-timeline', { limit: 100 });
		assert(timeline.some(n => n.id === note.id));
	}, WAIT_FOR_FEDERATION);
}

describe('Drive', () => {
	describe('Upload image in a.test and resolve from b.test', () => {
		let uploader: LoginUser;

		beforeAll(async () => {
			uploader = await createAccount('a.test');
		});

		let image: Misskey.entities.DriveFile, imageInB: Misskey.entities.DriveFile;
		let uploadedNoteInB: Misskey.entities.Note;

		describe('Upload', () => {
			beforeAll(async () => {
				image = await uploadFile('a.test', uploader);
				const noteWithImage = (await uploader.client.request('notes/create', { fileIds: [image.id] })).createdNote;
				uploadedNoteInB = await resolveRemoteNote('a.test', noteWithImage.id, bAdmin);
				assert(uploadedNoteInB.files != null);
				strictEqual(uploadedNoteInB.files.length, 1);
				imageInB = uploadedNoteInB.files[0];
			});

			test('Check consistency of DriveFile', async () => {
				// console.log(`a.test: ${JSON.stringify(image, null, '\t')}`);
				// console.log(`b.test: ${JSON.stringify(imageInB, null, '\t')}`);

				deepStrictEqualWithExcludedFields(image, imageInB, [
					'id',
					'createdAt',
					'size',
					'url',
					'thumbnailUrl',
					'userId',
				]);
				strictEqual(image.isSensitive, false);
				const timeline = await bAdmin.client.request('notes/nsfw-timeline', { limit: 100 });
				assert(!timeline.some(n => n.id === uploadedNoteInB.id));
			});

			test('A regular uploader cannot mark an image as sensitive', async () => {
				const updated = await uploader.client.request('drive/files/update', { fileId: image.id, isSensitive: true });
				strictEqual(updated.isSensitive, false);
			});
		});

		let updatedImage: Misskey.entities.DriveFile, updatedImageInB: Misskey.entities.DriveFile;

		describe('Update', () => {
			beforeAll(async () => {
				updatedImage = await aAdmin.client.request('drive/files/update', {
					fileId: image.id,
					name: 'updated_192.jpg',
					isSensitive: true,
				});

				updatedImageInB = await bAdmin.client.request('drive/files/show', {
					fileId: imageInB.id,
				});
			});

			test('Check consistency', () => {
				// console.log(`a.test: ${JSON.stringify(updatedImage, null, '\t')}`);
				// console.log(`b.test: ${JSON.stringify(updatedImageInB, null, '\t')}`);

				// FIXME: not updated with `drive/files/update`
				strictEqual(updatedImage.isSensitive, true);
				strictEqual(updatedImage.name, 'updated_192.jpg');
				strictEqual(updatedImageInB.isSensitive, false);
				strictEqual(updatedImageInB.name, '192.jpg');
			});
		});

		let reupdatedImageInB: Misskey.entities.DriveFile;
		let reupdatedNoteInB: Misskey.entities.Note;

		describe('Re-update with attaching to Note', () => {
			beforeAll(async () => {
				const noteWithUpdatedImage = (await uploader.client.request('notes/create', { fileIds: [updatedImage.id] })).createdNote;
				reupdatedNoteInB = await resolveRemoteNote('a.test', noteWithUpdatedImage.id, bAdmin);
				assert(reupdatedNoteInB.files != null);
				strictEqual(reupdatedNoteInB.files.length, 1);
				reupdatedImageInB = reupdatedNoteInB.files[0];
			});

			test('Check consistency', async () => {
				// console.log(`b.test: ${JSON.stringify(reupdatedImageInB, null, '\t')}`);

				// The database-backed NSFW timeline must recognize the updated flag.
				await assertRemoteSensitive(reupdatedNoteInB, bAdmin);
				// FIXME: but `name` is not updated
				strictEqual(reupdatedImageInB.name, '192.jpg');
			});
		});
	});

	describe('Sensitive flag', () => {
		describe('isSensitive is federated in delivering to followers', () => {
			let alice: LoginUser, bob: LoginUser;
			let bobInA: Misskey.entities.UserDetailedNotMe, aliceInB: Misskey.entities.UserDetailedNotMe;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);

				[bobInA, aliceInB] = await Promise.all([
					resolveRemoteUser('b.test', bob.id, alice),
					resolveRemoteUser('a.test', alice.id, bob),
				]);

				await bob.client.request('following/create', { userId: aliceInB.id });
				await waitForFollowRelation(bob, alice, 1);
			});

			test('A moderator-marked image is recognized by the remote NSFW timeline', async () => {
				const file = await uploadFile('a.test', alice);
				const marked = await aAdmin.client.request('drive/files/update', { fileId: file.id, isSensitive: true });
				strictEqual(marked.isSensitive, true);
				await alice.client.request('notes/create', { text: 'sensitive', fileIds: [file.id] });

				const noteInB = await vi.waitFor(async () => {
					const notes = await bob.client.request('notes/timeline', {});
					strictEqual(notes.length, 1);
					return notes[0];
				}, WAIT_FOR_FEDERATION);
				await assertRemoteSensitive(noteInB, bob);
			});
		});

		describe('isSensitive is federated in resolving', () => {
			let alice: LoginUser, bob: LoginUser;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);
			});

			test('A moderator-marked image is recognized by the remote NSFW timeline', async () => {
				const file = await uploadFile('a.test', alice);
				const marked = await aAdmin.client.request('drive/files/update', { fileId: file.id, isSensitive: true });
				strictEqual(marked.isSensitive, true);
				const note = (await alice.client.request('notes/create', { text: 'sensitive', fileIds: [file.id] })).createdNote;

				const noteInB = await resolveRemoteNote('a.test', note.id, bob);
				await assertRemoteSensitive(noteInB, bob);
			});
		});

		/** @see https://github.com/misskey-dev/misskey/issues/12208 */
		describe('isSensitive is federated in replying', () => {
			let alice: LoginUser, bob: LoginUser;

			beforeAll(async () => {
				[alice, bob] = await Promise.all([
					createAccount('a.test'),
					createAccount('b.test'),
				]);
			});

			test('A moderator-marked image is recognized by the remote NSFW timeline', async () => {
				const bobNote = (await bob.client.request('notes/create', { text: 'I\'m Bob' })).createdNote;

				const file = await uploadFile('a.test', alice);
				const marked = await aAdmin.client.request('drive/files/update', { fileId: file.id, isSensitive: true });
				strictEqual(marked.isSensitive, true);
				const bobNoteInA = await resolveRemoteNote('b.test', bobNote.id, alice);
				const note = (await alice.client.request('notes/create', { text: 'sensitive', fileIds: [file.id], replyId: bobNoteInA.id })).createdNote;
				await sleep();

				const noteInB = await resolveRemoteNote('a.test', note.id, bob);
				await assertRemoteSensitive(noteInB, bob);
			});
		});
	});
});
