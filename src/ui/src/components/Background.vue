<script lang="ts" setup>
import { themes } from '@ui/assets/theme/themes'
import useGeneralStore from '@ui/stores/general-store'
import firstFloating from '@ui/assets/img/firstFloating.png'
import secondFloating from '@ui/assets/img/secondFloating.png'
import background from '@ui/assets/img/choinka.png'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const generalStore = useGeneralStore()

// start zgodny z aktualnym stanem zakładki
const isTabActive = ref(!document.hidden)

const handleVisibilityChange = (): void => {
  isTabActive.value = !document.hidden
  console.log(
    'visibilitychange, document.hidden =',
    document.hidden,
    'isTabActive =',
    isTabActive.value
  )
}

onMounted(() => {
  console.log('onMounted, document.hidden =', document.hidden, 'isTabActive =', isTabActive.value)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

const bgImage = computed(() => {
  return generalStore.getTheme() === 'custom'
    ? generalStore.settings.customTheme?.backgroundImage
    : (themes.find((theme) => theme.name === generalStore.getTheme())?.backgroundImage ??
        background)
})

const firstFloatingBlock = computed(() => {
  return generalStore.getTheme() === 'custom'
    ? generalStore.settings.customTheme?.firstFloating
    : (themes.find((theme) => theme.name === generalStore.getTheme())?.firstFloating ??
        firstFloating)
})

const secondFloatingBlock = computed(() => {
  return generalStore.getTheme() === 'custom'
    ? generalStore.settings.customTheme?.secondFloating
    : (themes.find((theme) => theme.name === generalStore.getTheme())?.secondFloating ??
        secondFloating)
})
</script>

<template>
  <div class="animated-bg">
    <img
      :src="bgImage"
      alt="background"
      class="absolute !h-[100vh] w-full !object-cover"
      @dragstart.prevent="null"
    />

    <div class="particles"></div>
  </div>
  <div class="vignette"></div>
  <div class="background">
    <div class="bg-gradient"></div>
    <div class="floating-blocks" :class="{ 'floating-paused': !isTabActive }">
      <div class="block-1" @dragstart.prevent="null">
        {{ firstFloatingBlock }}
      </div>
      <div class="block-2" @dragstart.prevent="null">
        {{ firstFloatingBlock }}
      </div>
      <div class="block-3" @dragstart.prevent="null">
        {{ firstFloatingBlock }}
      </div>
      <div class="ghost-1" @dragstart.prevent="null">
        {{ secondFloatingBlock }}
      </div>
      <div class="ghost-2" @dragstart.prevent="null">
        {{ secondFloatingBlock }}
      </div>
      <div class="ghost-3" @dragstart.prevent="null">
        {{ secondFloatingBlock }}
      </div>
    </div>
  </div>
</template>
