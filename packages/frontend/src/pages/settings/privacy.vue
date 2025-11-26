<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/privacy" :label="i18n.ts.privacy" :keywords="['privacy']" icon="ti ti-lock-open">
	<div class="_gaps_m">
		<MkFeatureBanner icon="/client-assets/unlocked_3d.png" color="#aeff00">
			<SearchText>{{ i18n.ts._settings.privacyBanner }}</SearchText>
		</MkFeatureBanner>

		<SearchMarker :keywords="['follow', 'lock']">
			<MkSwitch v-model="isLocked" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeFollowManuallyApprove }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.lockedAccountInfo }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<MkDisableSection :disabled="!isLocked">
			<SearchMarker :keywords="['follow', 'auto', 'accept']">
				<MkSwitch v-model="autoAcceptFollowed" @update:modelValue="save()">
					<template #label><SearchLabel>{{ i18n.ts.autoAcceptFollowed }}</SearchLabel></template>
				</MkSwitch>
			</SearchMarker>
		</MkDisableSection>

		<SearchMarker :keywords="['reaction', 'public']">
			<MkSwitch v-model="publicReactions" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeReactionsPublic }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.makeReactionsPublicDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['following', 'visibility']">
			<MkSelect v-model="followingVisibility" :items="followingVisibilityDef" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.followingVisibility }}</SearchLabel></template>
			</MkSelect>
		</SearchMarker>

		<SearchMarker :keywords="['follower', 'visibility']">
			<MkSelect v-model="followersVisibility" :items="followersVisibilityDef" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.followersVisibility }}</SearchLabel></template>
			</MkSelect>
		</SearchMarker>

		<!--
		<SearchMarker :keywords="['online', 'status']">
			<MkSwitch v-model="hideOnlineStatus" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.hideOnlineStatus }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.hideOnlineStatusDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>
		-->

		<SearchMarker :keywords="['crawle', 'index', 'search']">
			<MkSwitch v-model="noCrawle" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.noCrawle }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.noCrawleDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['crawle', 'ai']">
			<MkSwitch v-model="preventAiLearning" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.preventAiLearning }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.preventAiLearningDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<SearchMarker :keywords="['explore']">
			<MkSwitch v-model="isExplorable" @update:modelValue="save()">
				<template #label><SearchLabel>{{ i18n.ts.makeExplorable }}</SearchLabel></template>
				<template #caption><SearchText>{{ i18n.ts.makeExplorableDescription }}</SearchText></template>
			</MkSwitch>
		</SearchMarker>

		<!--
<SearchMarker :keywords="['chat']">
			<FormSection>
				<template #label><SearchLabel>{{ i18n.ts.directMessage }}</SearchLabel></template>

				<div class="_gaps_m">
					<MkInfo v-if="$i.policies.chatAvailability === 'unavailable'">{{ i18n.ts._chat.chatNotAvailableForThisAccountOrServer }}</MkInfo>
					<SearchMarker :keywords="['chat']">
						<MkSelect v-model="chatScope" :items="chatScopeDef" @update:modelValue="save()">
							<template #label><SearchLabel>{{ i18n.ts._chat.chatAllowedUsers }}</SearchLabel></template>
							<template #caption>{{ i18n.ts._chat.chatAllowedUsers_note }}</template>
						</MkSelect>
					</SearchMarker>
				</div>
			</FormSection>
		</SearchMarker>
-->

		<SearchMarker :keywords="['lockdown']">
			<FormSection>
				<template #label><SearchLabel>{{ i18n.ts.lockdown }}</SearchLabel><span class="_beta">{{ i18n.ts.beta }}</span></template>

				<div class="_gaps_m">
					<SearchMarker :keywords="['login', 'signin']">
						<MkSwitch :modelValue="requireSigninToViewContents" @update:modelValue="update_requireSigninToViewContents">
							<template #label><SearchLabel>{{ i18n.ts._accountSettings.requireSigninToViewContents }}</SearchLabel></template>
							<template #caption><SearchText>{{ i18n.ts._accountSettings.requireSigninToViewContentsDescription }}</SearchText></template>
						</MkSwitch>
					</SearchMarker>

					<SearchMarker :keywords="['followers', 'limit']">
						<FormSlot>
							<template #label><SearchLabel>{{ i18n.ts.makeNotesFollowersOnlyBefore }}</SearchLabel></template>

							<div class="_gaps_m">
								<MkSelect v-model="makeNotesFollowersOnlyBefore_type" class="_bordered">
									<option value="relative">{{ i18n.ts.relativeTime }}</option>
									<option value="absolute">{{ i18n.ts.absoluteTime }}</option>
									<option value="never">{{ i18n.ts._accountSettings.disableAllLockdownOptions }}</option>
								</MkSelect>

								<MkInput v-if="makeNotesFollowersOnlyBefore_type === 'relative'" v-model="makeNotesFollowersOnlyBefore_relative" type="number" class="_bordered">
									<template #suffix>
										<MkSelect v-model="makeNotesFollowersOnlyBefore_relativeType" class="_bordered">
											<option value="sec">{{ i18n.ts.sec }}</option>
											<option value="min">{{ i18n.ts.min }}</option>
											<option value="hour">{{ i18n.ts.hour }}</option>
											<option value="day">{{ i18n.ts.day }}</option>
											<option value="week">{{ i18n.ts.week }}</option>
											<option value="month">{{ i18n.ts.month }}</option>
											<option value="year">{{ i18n.ts.year }}</option>
										</MkSelect>
									</template>
								</MkInput>

								<MkInput v-else-if="makeNotesFollowersOnlyBefore_type === 'absolute'" v-model="makeNotesFollowersOnlyBefore_absolute" type="datetime-local" class="_bordered">
								</MkInput>

								<details class="_bordered task _gaps">
									<summary class="task_title">
										<div class="task_caption">
											<div class="task_title">
												{{ i18n.ts._accountSettings.lockdown_forExistingNotes }}
											</div>
											<div class="task_status">
												<span v-if="lockdownForExistingNotesStatus === 'not-configured'">{{ i18n.ts._accountSettings.lockdown_notConfigured }}</span>
												<span v-else-if="lockdownForExistingNotesStatus === 'working'">
													<span v-if="makeNotesFollowersOnlyBefore_type === 'relative'">{{ i18n.ts._accountSettings.lockdown_working_makeNotesFollowersOnlyBeforeRelative({ time: formatDateTimeString(makeNotesFollowersOnlyBefore_value * 1000) }) }}</span>
													<span v-else-if="makeNotesFollowersOnlyBefore_type === 'absolute'">{{ i18n.ts._accountSettings.lockdown_working_makeNotesFollowersOnlyBeforeAbsolute({ time: formatDateTimeString(makeNotesFollowersOnlyBefore_value * 1000) }) }}</span>
												</span>
												<span v-else-if="lockdownForExistingNotesStatus === 'completed'">{{ i18n.ts._accountSettings.lockdown_completed }}</span>
											</div>
										</div>

										<div class="task_tags">
											<span>Notes created before &lt; target time</span>
											<i class="ti ti-arrow-right"></i>
											<span>Followers only</span>
										</div>
									</summary>
									<div class="task_content">
										<ul>
											<li>
												{{ i18n.ts._accountSettings.lockdown_forExistingNotesDescription_1 }}
											</li>
											<li>
												{{ i18n.ts._accountSettings.lockdown_forExistingNotesDescription_2 }}
											</li>
											<li>
												{{ i18n.ts._accountSettings.lockdown_forExistingNotesDescription_3 }}
											</li>
										</ul>
										<p class="fxRow _gaps">
											<MkButton primary :disabled="lockdownForExistingNotesStatus === 'working'" @click="run_makeNotesFollowersOnlyBefore">{{ i18n.ts._accountSettings.lockdown_execute }}</MkButton>
											<MkButton :disabled="lockdownForExistingNotesStatus !== 'working'" @click="stop_makeNotesFollowersOnlyBefore">{{ i18n.ts._accountSettings.lockdown_cancel }}</MkButton>

											<span v-if="lockdownForExistingNotesStatus === 'not-configured'">{{ i18n.ts._accountSettings.lockdown_forExistingNotesStatus_notConfigured }}</span>
											<span v-else-if="lockdownForExistingNotesStatus === 'working'">{{ i18n.ts._accountSettings.lockdown_forExistingNotesStatus_working }}</span>
											<span v-else-if="lockdownForExistingNotesStatus === 'completed'">{{ i18n.ts._accountSettings.lockdown_forExistingNotesStatus_completed }}</span>
											<span v-else-if="lockdownForExistingNotesStatus === 'failed'" class="_error">{{ i18n.ts._accountSettings.lockdown_forExistingNotesStatus_failed }}</span>
										</p>
									</div>
								</details>
							</div>
						</FormSlot>
					</SearchMarker>

					<SearchMarker :keywords="['notes', 'visibility']">
						<FormSlot>
							<template #label><SearchLabel>{{ i18n.ts.makeNotesHiddenBefore }}</SearchLabel></template>

							<div class="_gaps_m">
								<MkInput v-model="makeNotesHiddenBefore" type="datetime-local" class="_bordered">
									<template #caption>
										<SearchText>{{ i18n.ts.makeNotesHiddenBeforeDescription }}</SearchText>
									</template>
								</MkInput>
							</div>
						</FormSlot>
					</SearchMarker>
				</div>
			</FormSection>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import type { MkSelectItem } from '@/components/MkSelect.vue';
import FormSection from '@/components/form/section.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import FormSlot from '@/components/form/slot.vue';
import { formatDateTimeString } from '@/utility/format-time-string.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkInput from '@/components/MkInput.vue';
import * as os from '@/os.js';
import MkDisableSection from '@/components/MkDisableSection.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';
import MkButton from '@/components/MkButton.vue';
import SearchMarker from '@/components/MkSettingsSearch.vue';
import SearchLabel from '@/components/global/SearchLabel.vue';
import SearchText from '@/components/global/SearchText.vue';

const $i = ensureSignin();

const isLocked = ref($i.isLocked);
const autoAcceptFollowed = ref($i.autoAcceptFollowed);
const noCrawle = ref($i.noCrawle);
const preventAiLearning = ref($i.preventAiLearning);
const isExplorable = ref($i.isExplorable);
const requireSigninToViewContents = ref($i.requireSigninToViewContents ?? false);
const makeNotesFollowersOnlyBefore = ref($i.makeNotesFollowersOnlyBefore ?? null);
const makeNotesHiddenBefore = ref($i.makeNotesHiddenBefore ?? null);
const hideOnlineStatus = ref($i.hideOnlineStatus);
const publicReactions = ref($i.publicReactions);
const {
	model: followingVisibility,
	def: followingVisibilityDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.public, value: 'public' },
		// { label: i18n.ts.followers, value: 'followers' },
		// { label: i18n.ts.private, value: 'private' },
	],
	initialValue: $i.followingVisibility,
});
const {
	model: followersVisibility,
	def: followersVisibilityDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.public, value: 'public' },
		// { label: i18n.ts.followers, value: 'followers' },
		// { label: i18n.ts.private, value: 'private' },
	],
	initialValue: $i.followersVisibility,
});
const {
	model: chatScope,
	def: chatScopeDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts._chat._chatAllowedUsers.everyone, value: 'everyone' },
		{ label: i18n.ts._chat._chatAllowedUsers.followers, value: 'followers' },
		{ label: i18n.ts._chat._chatAllowedUsers.following, value: 'following' },
		{ label: i18n.ts._chat._chatAllowedUsers.mutual, value: 'mutual' },
		{ label: i18n.ts._chat._chatAllowedUsers.none, value: 'none' },
	],
	initialValue: $i.chatScope,
});
const makeNotesFollowersOnlyBefore_type = computed({
	get() {
		if (makeNotesFollowersOnlyBefore.value == null) {
			return 'never';
		} else if (makeNotesFollowersOnlyBefore.value === -1) {
			return 'relative';
		} else {
			return 'absolute';
		}
	},
	set(value) {
		if (value === 'never') {
			makeNotesFollowersOnlyBefore.value = null;

			makeNotesFollowersOnlyBefore_relative.value = null;
			makeNotesFollowersOnlyBefore_relativeType.value = 'sec';
			makeNotesFollowersOnlyBefore_absolute.value = null;
		} else if (value === 'relative') {
			makeNotesFollowersOnlyBefore_absolute.value = null;
		} else if (value === 'absolute') {
			makeNotesFollowersOnlyBefore_relative.value = null;
			makeNotesFollowersOnlyBefore_relativeType.value = 'sec';
		}
	},
});
const makeNotesFollowersOnlyBefore_value = computed(() => {
	if (makeNotesFollowersOnlyBefore.value == null) return null;

	if (makeNotesFollowersOnlyBefore.value === -1) {
		const seconds = (() => {
			const secondsPerUnit = (() => {
				switch (makeNotesFollowersOnlyBefore_relativeType.value) {
					case 'sec': return 1;
					case 'min': return 60;
					case 'hour': return 60 * 60;
					case 'day': return 60 * 60 * 24;
					case 'week': return 60 * 60 * 24 * 7;
					case 'month': return 60 * 60 * 24 * 30;
					case 'year': return 60 * 60 * 24 * 365;
				}
			})();

			return makeNotesFollowersOnlyBefore_relative.value != null
				? makeNotesFollowersOnlyBefore_relative.value * secondsPerUnit
				: null;
		})();

		if (seconds == null) return null;

		return Math.floor(Date.now() / 1000) - seconds;
	} else {
		return makeNotesFollowersOnlyBefore.value;
	}
});
const makeNotesFollowersOnlyBefore_relative = ref<number | null>(
	makeNotesFollowersOnlyBefore.value === -1 ? 1 : null,
);
const makeNotesFollowersOnlyBefore_relativeType = ref<'sec' | 'min' | 'hour' | 'day' | 'week' | 'month' | 'year'>('day');
const makeNotesFollowersOnlyBefore_absolute = ref<string | null>(
	makeNotesFollowersOnlyBefore.value != null && makeNotesFollowersOnlyBefore.value !== -1
		? new Date((makeNotesFollowersOnlyBefore.value ?? 0) * 1000).toISOString().slice(0, 19)
		: null,
);

watch(makeNotesFollowersOnlyBefore_relative, (value) => {
	if (value != null) {
		makeNotesFollowersOnlyBefore.value = -1;
	} else {
		makeNotesFollowersOnlyBefore.value = null;
	}
});
watch(makeNotesFollowersOnlyBefore_absolute, (value) => {
	if (value != null) {
		makeNotesFollowersOnlyBefore.value = Math.floor(Date.parse(value) / 1000);
	} else {
		makeNotesFollowersOnlyBefore.value = null;
	}
});
watch(makeNotesFollowersOnlyBefore_type, (value) => {
	if (value === 'never') {
		makeNotesFollowersOnlyBefore.value = null;
	} else if (value === 'relative') {
		makeNotesFollowersOnlyBefore.value = -1;
	} else if (value === 'absolute') {
		makeNotesFollowersOnlyBefore.value = Math.floor(Date.now() / 1000);
	} else {
		makeNotesFollowersOnlyBefore.value = null;
	}
});

const makeNotesFollowersOnlyBefore_presets: MkSelectItem<number>[] = [
	{ label: i18n.ts.oneHour, value: -3600 },
	{ label: i18n.ts.oneDay, value: -86400 },
	{ label: i18n.ts.threeDays, value: -259200 },
	{ label: i18n.ts.oneWeek, value: -604800 },
	{ label: i18n.ts.oneMonth, value: -2592000 },
	{ label: i18n.ts.threeMonths, value: -7776000 },
	{ label: i18n.ts.sixMonths, value: -15552000 },
	{ label: i18n.ts.oneYear, value: -31536000 },
	{ label: i18n.ts.threeYears, value: -94608000 },
];

const lockdownForExistingNotesStatus = ref<'not-configured' | 'working' | 'completed' | 'failed'>('not-configured');

const update_requireSigninToViewContents = async (value: boolean) => {
	requireSigninToViewContents.value = value;
	await os.apiWithDialog('i/update', {
		requireSigninToViewContents: requireSigninToViewContents.value,
	});
	instance.requireSigninToViewContents = requireSigninToViewContents.value;
};

const run_makeNotesFollowersOnlyBefore = async () => {
	if (!confirm(i18n.ts._accountSettings.lockdown_confirmation)) return;

	lockdownForExistingNotesStatus.value = 'working';

	await os.apiWithDialog('i/make-notes-followers-only-before', {
		until: makeNotesFollowersOnlyBefore_value.value,
	});

	lockdownForExistingNotesStatus.value = 'completed';
	os.success();
};

const stop_makeNotesFollowersOnlyBefore = async () => {
	if (!confirm(i18n.ts._accountSettings.lockdown_stop_confirmation)) return;

	await os.apiWithDialog('i/stop-make-notes-followers-only-before', {
		until: makeNotesFollowersOnlyBefore_value.value,
	});

	lockdownForExistingNotesStatus.value = 'not-configured';
	os.success();
};

const save = () => {
	misskeyApi('i/update', {
		isLocked: isLocked.value,
		autoAcceptFollowed: autoAcceptFollowed.value,
		noCrawle: noCrawle.value,
		preventAiLearning: preventAiLearning.value,
		isExplorable: isExplorable.value,
		makeNotesFollowersOnlyBefore: makeNotesFollowersOnlyBefore.value,
		makeNotesHiddenBefore: makeNotesHiddenBefore.value,
		hideOnlineStatus: hideOnlineStatus.value,
		publicReactions: publicReactions.value,
		chatScope: chatScope.value,
		followingVisibility: followingVisibility.value,
		followersVisibility: followersVisibility.value,
	});
};

definePage(() => ({
	title: i18n.ts.privacy,
	icon: 'ti ti-lock-open',
}));
</script>

<style lang="scss" scoped>
.task {
	&:where(details) {
		--border: max(1px, 0.055rem) solid var(--divider);

		box-shadow: 0 0 0 var(--focusBorderWidth) var(--focus);
		border-radius: var(--radius);
		background-color: var(--panel);
		border: var(--border);

		&[open] .task_title {
			border-bottom: var(--border);
		}
	}

	&_title {
		display: flex;
		gap: 10px;
		padding: 16px;
		flex-direction: column;

		cursor: pointer;

		@container (width >= 960px) {
			flex-direction: row;
		}
	}

	&_caption {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	&_tags {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		font-size: 0.9em;
	}

	&_status {
		color: var(--fgTransparentWeak);

		._error & {
			color: var(--error);
		}
	}

	&_content {
		border-radius: 0 0 var(--radius) var(--radius);
		padding: 16px;
	}
}
</style>
