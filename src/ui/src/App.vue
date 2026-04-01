<script setup lang="ts">
import { onMounted } from 'vue'
import { applyTheme } from '@ui/assets/theme/themes'
import useGeneralStore from '@ui/stores/general-store'
import useUserStore from '@ui/stores/user-store'
import { connectPlayer, disconnectPlayer } from '@ui/api/endpoints'
import { useSocketService } from '@ui/services/socket-service'
import { LOGGER } from '@ui/services/logger-service'
import { showToast } from '@ui/utils'

const generalStore = useGeneralStore()
const userStore = useUserStore()
const { emit: emitSocket } = useSocketService()

window.electron?.ipcRenderer?.on('toast:show', (_, data: string) => {
  showToast(`${data}`)
})

window.electron?.ipcRenderer?.on('change:version', (_, ver: string) => {
  generalStore.changeVersion(ver)
})

window.electron?.ipcRenderer?.on('change:max-ram', (_, ram: string) => {
  generalStore.changeMaxRAM(parseInt(ram))
})

let heartbeatInterval: number | undefined = undefined

const startHeartbeat = (): void => {
  if (heartbeatInterval) clearInterval(heartbeatInterval)
  heartbeatInterval = window.setInterval(
    () => {
      if (generalStore.currentState === 'minecraft-started' && generalStore.mcInstance) {
        emitSocket('player:mc-started', { nickname: userStore.user?.nickname })
      }
    },
    10 * 60 * 1000
  )
}

const stopHeartbeat = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = undefined
  }
}

window.electron?.ipcRenderer?.on(
  'launch:change-state',
  async (_event, state: string, pid?: number) => {
    const parsedState = JSON.parse(state)
    generalStore.setCurrentState(parsedState)
    if (pid) generalStore.mcInstance = pid

    if (parsedState === 'minecraft-started') {
      LOGGER.with('Launch State').log('Minecraft is running..')
      generalStore.setIsOpeningGame(true)

      // Clear logs after 15 seconds delay
      setTimeout(() => {
        if (generalStore.currentState === 'minecraft-started') {
          generalStore.setCurrentLog('')
        }
      }, 15000)

      window.discord.setActivity(`W PokeGoGo Launcher`, 'Gram..')
      await connectPlayer()
      emitSocket('player:mc-started', { nickname: userStore.user?.nickname })
      startHeartbeat()
    }

    if (parsedState === 'minecraft-closed') {
      generalStore.setCurrentState('start')
      generalStore.setIsOpeningGame(false)
      generalStore.setCurrentLog('')
      window.discord.setActivity(`W PokeGoGo Launcher`, 'Przeglądam..')
      LOGGER.with('Launch State').log('Minecraft is closed.')
      await disconnectPlayer()
      emitSocket('player:mc-closed', { nickname: userStore.user?.nickname })
      stopHeartbeat()
    }
  }
)

window.electron?.ipcRenderer?.on('launch:show-log', (_event, data: string, ended?: string) => {
  if (!ended) {
    generalStore.setCurrentLog(data)
  }
})

onMounted(() => {
  generalStore.loadSettings()

  applyTheme(
    localStorage.getItem('customTheme') && generalStore.settings.theme === 'custom'
      ? 'custom'
      : generalStore.getTheme()
  )
})
</script>

<template>
  <RouterView />
</template>

<style lang="css">
@import '@ui/assets/base.css';
</style>
