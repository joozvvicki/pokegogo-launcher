<script lang="ts" setup>
import { connectPlayer, disconnectPlayer } from '@ui/api/endpoints'
import { LOGGER } from '@ui/services/logger-service'
import useGeneralStore from '@ui/stores/general-store'
import useUserStore from '@ui/stores/user-store'
import { createParticles, refreshMicrosoftToken, showToast } from '@ui/utils'
import { differenceInMilliseconds, intervalToDuration, parseISO } from 'date-fns'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const generalStore = useGeneralStore()

const states = computed<Record<string, string>>(() => ({
  start: t('launcher.launchButton.states.start'),
  'java-install': t('launcher.launchButton.states.javaInstall'),
  'files-verify': t('launcher.launchButton.states.filesVerify'),
  'minecraft-start': t('launcher.launchButton.states.minecraftStart'),
  'minecraft-started': t('launcher.launchButton.states.minecraftStarted'),
  'minecraft-closed': t('launcher.launchButton.states.minecraftClosed')
}))

const userStore = useUserStore()

const isBanned = computed(() => {
  return userStore.hwidBanned
    ? userStore.hwidBanned
    : userStore.user?.banEndDate
      ? differenceInMilliseconds(parseISO(userStore.user?.banEndDate as string), new Date()) > 0
      : !!userStore.user?.isBanned
})

const handleToggleGame = async (e: Event): Promise<void> => {
  try {
    switch (generalStore.currentState) {
      case 'files-verify':
      case 'minecraft-started':
      case 'minecraft-start':
        await handleKillGame()
        break
      case 'minecraft-closed':
        generalStore.mcInstance = null
        generalStore.setIsOpeningGame(false)
        generalStore.setCurrentState('start')
        break
      case 'start':
        await handleLaunchGame(e)
        break
      default:
        break
    }
  } catch (err) {
    LOGGER.with('Launch State').err((err as Error).toString())
    showToast(t('launcher.launchButton.errors.generic'), 'error')
  }
}

const handleLaunchGame = async (e: Event): Promise<void> => {
  createParticles(e.target as HTMLElement)

  let mcToken = localStorage.getItem('mcToken')

  if (userStore.user?.accountType === 'microsoft' && mcToken?.includes('exp')) {
    LOGGER.with('Launch State').log(t('launcher.launchButton.errors.tokenVerify'))
    const exp = parseInt(JSON.parse(mcToken as string).exp)
    const now = new Date().getTime()

    LOGGER.with('Launch State').log(`${now} ${exp}`)

    if (now >= exp) {
      LOGGER.with('Launch State').log(t('launcher.launchButton.errors.tokenRefreshing'))
      try {
        const res = await refreshMicrosoftToken(
          localStorage.getItem(`msToken:${userStore.user?.nickname}`)
        )

        if (res) {
          localStorage.setItem(`msToken:${userStore.user?.nickname}`, res.msToken)
          localStorage.setItem('mcToken', res.mcToken)

          mcToken = res.mcToken
        }

        LOGGER.with('Launch State').success(t('launcher.launchButton.errors.tokenRefreshed'))
      } catch (err: unknown) {
        LOGGER.with('Launch State').err('Błąd odświażania tokenu.', `${err}`)
        showToast(t('launcher.launchButton.errors.tokenRefreshError'))

        generalStore.setCurrentState('start')
        return
      }
    }
  }

  const res = await window.electron?.ipcRenderer?.invoke('launch:game', {
    token: userStore.user?.accountType === 'microsoft' ? mcToken : JSON.stringify(userStore.user),
    accessToken: localStorage.getItem('token'),
    javaVersion: '21',
    isDev: generalStore.settings.updateChannel === 'dev',
    settings: {
      resolution: generalStore.settings.resolution,
      ram: generalStore.settings.ram,
      displayMode: generalStore.settings.displayMode,
      gameMode: generalStore.settings.gameMode
    },
    accountType: userStore.user?.accountType
  })

  if (res) generalStore.mcInstance = parseInt(res)
}

const state = computed(() => {
  return states.value[generalStore.currentState]
})

const handleKillGame = async (): Promise<void> => {
  if (!generalStore.isOpeningGame) return

  await window.electron?.ipcRenderer?.invoke('launch:exit', generalStore.mcInstance)
  generalStore.mcInstance = null
  generalStore.setCurrentState('start')
  setTimeout(() => {
    generalStore.setCurrentLog('')
  }, 250)
}

const now = ref(new Date())
let timerInterval: number | undefined = undefined

const pad = (num: number): string => String(num).padStart(2, '0')

const formattedBanTime = computed(() => {
  const banEndDateString = userStore.user?.banEndDate as string | null

  if (!banEndDateString?.length) {
    return t('launcher.launchButton.ban.perm')
  }

  const banEndDate = parseISO(banEndDateString)
  const remainingMs = differenceInMilliseconds(banEndDate, now.value)

  if (remainingMs <= 0) {
    clearInterval(timerInterval)
    return t('launcher.launchButton.ban.ended')
  }

  const duration = intervalToDuration({
    start: now.value,
    end: banEndDate
  })

  const totalHours = (duration.days || 0) * 24 + (duration.hours || 0)
  const hours = pad(totalHours)
  const minutes = pad(duration.minutes || 0)
  const seconds = pad(duration.seconds || 0)

  return t('launcher.launchButton.ban.remaining', { time: `${hours}:${minutes}:${seconds}` })
})

window.electron?.ipcRenderer?.on('launch:change-state', async (_event, state: string) => {
  const parsedState = JSON.parse(state)
  generalStore.setCurrentState(parsedState)

  if (parsedState === 'minecraft-start') {
    window.discord.setActivity(
      `W PokeGoGo Launcher`,
      t('launcher.launchButton.states.minecraftStart')
    )
  }

  if (parsedState === 'minecraft-started') {
    LOGGER.with('Launch State').log('Minecraft is running..')
    generalStore.setIsOpeningGame(true)
    window.discord.setActivity(`W PokeGoGo Launcher`, 'Gram..')
    await connectPlayer()
  }

  if (parsedState === 'minecraft-closed') {
    generalStore.setCurrentState('start')
    generalStore.setIsOpeningGame(false)
    generalStore.setCurrentLog('')
    window.discord.setActivity(`W PokeGoGo Launcher`, 'Przeglądam..')
    LOGGER.with('Launch State').log('Minecraft is closed.')
    await disconnectPlayer()
  }
})

window.electron?.ipcRenderer?.on('launch:show-log', (_event, data: string, ended?: string) => {
  if (!ended) {
    generalStore.setCurrentLog(data)
    return
  }

  generalStore.setCurrentLog('')
})

const currentState = computed(() => {
  return generalStore.currentState
})

onMounted(async () => {
  timerInterval = window.setInterval(() => {
    now.value = new Date()
  }, 1000)

  try {
    const isRunning = generalStore.mcInstance

    if (isRunning) {
      generalStore.setIsOpeningGame(true)
      generalStore.setCurrentState('minecraft-started')
      LOGGER.with('Launch State').log('Minecraft is running..')
      window.discord.setActivity(`W PokeGoGo Launcher`, 'Gram..')
    }
  } catch {
    LOGGER.with('Launch State').log('Minecraft is not running.')
  }
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
})
</script>

<template>
  <div class="relative">
    <button
      class="launch-button"
      :class="{
        banned: isBanned,
        running: generalStore.isOpeningGame,
        'mb-7': generalStore.currentLog.length
      }"
      :disabled="isBanned"
      @click="(e) => handleToggleGame(e)"
    >
      <div class="launch-button-bg"></div>
      <template v-if="currentState === 'start'">
        <div class="title">
          <template v-if="isBanned">
            <i class="fas fa-exclamation-triangle text-2xl"></i>
            <div class="flex flex-col">
              <span class="title" :class="{ 'mb-2': userStore.user?.banEndDate }">
                {{ t('launcher.launchButton.ban.bannedTitle') }}
              </span>
              <span class="text-[0.7rem] text-black">
                {{ userStore.user?.banEndDate ? formattedBanTime : '' }}
              </span>
            </div>
          </template>
          <template v-else>
            <i class="fas fa-play"></i>
            <span>{{ t('launcher.launchButton.actions.launch') }}</span>
          </template>
        </div>
      </template>
      <div v-else class="launch-running">
        <div
          class="title"
          :class="{
            'margin-title': generalStore.isOpeningGame
          }"
        >
          <i v-if="currentState !== 'start'" class="fas fa-spinner fa-spin"></i>
          <span>{{ state }}</span>
        </div>
        <span v-if="generalStore.isOpeningGame" class="info">{{
          t('launcher.launchButton.actions.abort')
        }}</span>
      </div>
    </button>
    <Transition name="slide-down">
      <div v-if="generalStore.currentLog.length" class="launch-button-info">
        {{
          generalStore.currentLog.length > 80
            ? generalStore.currentLog.slice(0, 80) + '..'
            : generalStore.currentLog
        }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.launch-button-info {
  position: absolute;
  bottom: 110%; /* Position above the button */
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 300px;
  min-width: 150px;
  background: rgba(20, 20, 25, 0.9);
  backdrop-filter: blur(10px);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
  color: var(--text-primary);
  text-align: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 20;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launch-button-info::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: rgba(20, 20, 25, 0.9);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.launch-running {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.launch-running .title {
  font-size: 0.8rem; /* Smaller font text during loading */
}

.launch-button {
  position: relative;
  width: 100%;
  height: 100%; /* Fill parent */
  padding: 0;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 18px; /* Match dock radius */
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 2;
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.2); /* Inner glow */
}

.banned {
  background: var(--gradient-banned);
}

.banned:hover,
.banned:focus {
  box-shadow: none !important;
  transform: none !important;
}

.launch-button .title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  z-index: 5;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Adjusted typography for running state */
.launch-running .title {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 4px; /* Space between title and info */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  padding: 0 0.5rem;
}

.launch-button .info {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.margin-title {
  margin-bottom: 2px;
}

.launch-button-bg {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.6s ease;
  z-index: 1;
}

.launch-button:hover .launch-button-bg {
  left: 100%;
}

.launch-button:hover {
  transform: scale(1.02); /* More subtle scale */
  box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.3);
}

/* Base Pulse Animation for Running State */
.launch-button.running {
  animation: pulse-glow 2s infinite;
}

/* Danger Hover Effect for Running State */
.launch-button.running:hover {
  background: var(--gradient-banned);
  animation: none; /* Stop pulsing on hover to focus on danger */
  box-shadow:
    0 0 20px rgba(239, 68, 68, 0.4),
    inset 0 0 20px rgba(0, 0, 0, 0.2);
  transform: scale(1.02);
}

.launch-button.running:hover .info {
  color: white; /* Make 'Click to abort' clearer on red bg */
  opacity: 1;
}

@keyframes pulse-glow {
  0% {
    box-shadow:
      0 0 0 0 rgba(var(--primary-rgb), 0.4),
      inset 0 0 20px rgba(255, 255, 255, 0.2);
  }
  70% {
    box-shadow:
      0 0 0 10px rgba(var(--primary-rgb), 0),
      inset 0 0 20px rgba(255, 255, 255, 0.2);
  }
  100% {
    box-shadow:
      0 0 0 0 rgba(var(--primary-rgb), 0),
      inset 0 0 20px rgba(255, 255, 255, 0.2);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
