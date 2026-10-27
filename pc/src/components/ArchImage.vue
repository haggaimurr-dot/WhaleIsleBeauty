<template>
  <div class="arch-image" :class="[shape, placeholder ? `ph-${placeholder}` : '']">
    <img v-if="!placeholder" :src="src" :alt="alt" loading="lazy" />
    <span v-else class="image-note">妆面示意</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ src: string; alt: string; shape?: 'arch' | 'rect' }>(), { shape: 'arch' })
const placeholder = computed(() => props.src.startsWith('placeholder:') ? props.src.slice(12) : '')
</script>
<style lang="scss" scoped>
@import '../../../src/styles/tokens.scss';
.arch-image { position: relative; background: $blush; overflow: hidden; width: 100%; height: 100%; }
.arch { border-radius: 999px 999px 20px 20px; }
.rect { border-radius: 14px; }
img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-note { position: absolute; bottom: 16px; left: 0; right: 0; text-align: center; font-size: 10px; letter-spacing: 2px; color: $mocha; opacity: .6; }
@each $name, $bg in $placeholders { .ph-#{$name} { background: $bg; } }
</style>
