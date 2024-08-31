<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
  <div class="mk-youtube-player" :style="{ background: thumbnailUrl ? `url(${thumbnailUrl})` : '#000', backgroundSize: 'cover', backgroundPosition: 'center' }">
    <div v-if="!isPlaying" class="info">
      <button class="_button" @click="play" :disabled="!videoId">
        <i class="ph-play ph-bold ph-lg"></i>
      </button>
      <div v-if="error" class="error-message">{{ error }}</div>
    </div>
    <div v-else id="youtube-player"></div>
    <div class="metadata">
      <h3>{{ videoTitle }}</h3>
      <p>{{ channelTitle }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import YouTubePlayer from 'youtube-player';

const props = defineProps<{
  video: {
    id: string;
    title: string;
    channelId: string;
    channelTitle: string;
  } | null;
}>();

const videoId = computed(() => props.video?.id ?? '');
const videoTitle = computed(() => props.video?.title ?? 'YouTube Video');
const channelTitle = computed(() => props.video?.channelTitle ?? '');

const thumbnailUrl = computed(() => videoId.value ? `https://img.youtube.com/vi/${videoId.value}/0.jpg` : null);
const isPlaying = ref(false);
const error = ref('');

let player: any;

onMounted(() => {
  initializePlayer();
});

watch(() => props.video, () => {
  if (player && videoId.value) {
    player.loadVideoById(videoId.value);
  }
});

function initializePlayer() {
  player = YouTubePlayer('youtube-player', {
    videoId: videoId.value,
    playerVars: {
      autoplay: 0,
      modestbranding: 1,
      rel: 0,
    },
  });

  player.on('ready', () => {
    console.log('YouTube player is ready');
  });

  player.on('error', (event: any) => {
    console.error('YouTube player error:', event);
    error.value = 'An error occurred while loading the video.';
  });

  player.on('stateChange', (event: any) => {
    if (event.data === 1) { // playing
      isPlaying.value = true;
    } else if (event.data === 0 || event.data === 2) { // ended or paused
      isPlaying.value = false;
    }
  });
}

function play() {
  if (player) {
    player.playVideo();
    isPlaying.value = true;
    error.value = ''; // Clear any previous errors
  }
}

// エラーハンドリング関数
function handleThumbnailError() {
  console.error('Failed to load thumbnail');
  error.value = 'Failed to load video thumbnail.';
}
</script>

<style lang="scss" scoped>
.mk-youtube-player {
  position: relative;
  width: 100%;
  padding-top: 56.25%; // 16:9 aspect ratio
  background-color: #000;

  #youtube-player {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .info {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);

    ._button {
      font-size: 3em;
      color: #fff;
      background: none;
      border: none;
      cursor: pointer;
    }
  }

  .metadata {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: #fff;

    h3 {
      margin: 0;
      font-size: 1.2em;
    }

    p {
      margin: 5px 0 0;
      font-size: 0.9em;
    }
  }

  .error-message {
    color: #ff4136;
    margin-top: 10px;
  }
}
</style>
