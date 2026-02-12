<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import LaunchButton from '@ui/components/buttons/LaunchButton.vue'
import useGeneralStore from '@ui/stores/general-store'
import { getServerStatus } from '@ui/api/endpoints'
import { LOGGER } from '@ui/services/logger-service'
import { format, parseISO } from 'date-fns'

const url = import.meta.env.RENDERER_VITE_API_URL
const generalStore = useGeneralStore()
const time = ref<number>(0)
const serverStatus = ref<{ players: { online: number } } | null>(null)

import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const props = defineProps<{
  events: any[]
}>()

const serverStatusInterval = ref<unknown>()

const normalEvents = computed(() => {
  return props.events
    .filter((event) => event.type === 'normal')
    ?.sort((a, b) => (parseISO(a.startDate).getTime() < parseISO(b.startDate).getTime() ? 1 : -1))
})

const megaEvent = computed(() => {
  return props.events.find((event) => event?.type === 'mega')
})

const setServerStatus = async (): Promise<void> => {
  serverStatus.value = await getServerStatus(time)
}

onMounted(async () => {
  await setServerStatus()

  serverStatusInterval.value = setInterval(
    async () => {
      await setServerStatus()
      LOGGER.with('ServerStatus').log('Refreshed server status')
    },
    1000 * 60 * 5
  )
})
</script>

<template>
  <div class="home-container">
    <div class="dashboard-grid">
      <!-- Hero Section (Mega Event or Featured) -->
      <div v-if="megaEvent || normalEvents.length > 0" class="hero-section">
        <div class="hero-bg">
          <img
            v-if="megaEvent"
            :src="
              megaEvent.src.includes('https://') || megaEvent.src.includes('blob')
                ? megaEvent.src
                : `${url}/events/image/${megaEvent.uuid}`
            "
            alt="Hero Background"
          />
          <div class="hero-overlay"></div>
        </div>
        <div class="hero-content">
          <div v-if="megaEvent" class="hero-tag">Active Event</div>
          <h1 class="hero-title">{{ megaEvent?.name || 'Welcome to PokeGoGo' }}</h1>
          <p class="hero-desc">
            {{ megaEvent?.desc || 'Join the adventure on the best Pixelmon server!' }}
          </p>
          <div v-if="megaEvent?.startDate" class="hero-meta">
            <i class="far fa-calendar-alt"></i>
            <span>{{ format(megaEvent.startDate, 'dd MMM yyyy') }}</span>
            <span v-if="megaEvent?.endDate"> - {{ format(megaEvent.endDate, 'dd MMM yyyy') }}</span>
          </div>
        </div>
      </div>

      <!-- News Feed -->
      <div class="news-section">
        <h2 class="section-title">Latest Updates</h2>
        <div class="news-grid">
          <article
            v-for="event in normalEvents.filter((_, i) => i < 3)"
            :key="event.uuid"
            class="news-card"
          >
            <div class="news-img">
              <img
                :src="
                  event.src.includes('https://') || event.src.includes('blob')
                    ? event.src
                    : `${url}/events/image/${event.uuid}`
                "
                loading="lazy"
              />
            </div>
            <div class="news-content">
              <span class="news-date">
                {{ event?.startDate ? format(event.startDate, 'dd MMM') : '' }}
              </span>
              <h3>{{ event.name }}</h3>
              <p>
                {{ event.desc?.length > 80 ? event.desc.substring(0, 80) + '...' : event.desc }}
              </p>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- Floating Dock -->
    <div class="floating-dock">
      <div class="dock-stats">
        <div class="dock-stat-item" :title="t('home.playersOnline')">
          <i class="fas fa-users"></i>
          <span>{{ serverStatus?.players?.online ?? '0' }}</span>
        </div>
        <div class="dock-divider"></div>
        <div class="dock-stat-item" :title="t('home.ping')">
          <i class="fas fa-signal"></i>
          <span>{{ time.toFixed(0) }}ms</span>
        </div>
        <div class="dock-divider"></div>
        <div class="dock-stat-item" :title="t('home.ram')">
          <i class="fas fa-microchip"></i>
          <span>{{ generalStore.settings.ram }}GB</span>
        </div>
      </div>

      <div class="dock-main-action">
        <LaunchButton class="dock-launch-btn" />
      </div>

      <div class="dock-extra">
        <div class="dock-stat-item" :title="t('home.uptime')">
          <i class="fas fa-server"></i>
          <span>Online</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  width: 100%;
  height: calc(100vh - 60px);
  overflow-y: auto;
  padding: 1rem 2rem 140px 1rem; /* Increase bottom padding for dock */
  position: relative;
}

.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Floating Dock */
.floating-dock {
  position: fixed;
  bottom: 30px;
  left: 50%; /* Center horizontally */
  transform: translateX(calc(-50% + 3.5rem)); /* Offset by half of Sidebar (7rem) */
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.8rem 1.5rem;
  background: rgba(20, 20, 25, 0.85); /* Darker, aesthetic background */
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
  z-index: 100;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.floating-dock:hover {
  transform: translateX(calc(-50% + 3.5rem)) translateY(-4px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.2);
}

.dock-stats,
.dock-extra {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dock-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 30px;
  cursor: help;
  transition: color 0.2s;
}

.dock-stat-item:hover {
  color: var(--text-primary);
}

.dock-stat-item i {
  font-size: 1rem;
  margin-bottom: 2px;
  color: var(--primary);
}

.dock-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
}

.dock-launch-btn {
  width: 220px !important;
  height: 55px !important;
  font-size: 1.1rem !important;
  border-radius: 18px !important;
  box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.3);
}

/* Hero Section */
.hero-section {
  position: relative;
  width: 100%;
  height: 380px; /* Slightly taller */
  border-radius: 32px; /* Rounder */
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.hero-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 10s ease;
}

.hero-section:hover .hero-bg img {
  transform: scale(1.05);
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.5) 50%,
    transparent 100%
  );
}

.hero-content {
  position: relative;
  z-index: 2;
  padding: 4rem;
  max-width: 55%;
  color: white;
}

.hero-tag {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 30px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 1rem;
  letter-spacing: 1px;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1rem;
  background: linear-gradient(to right, #fff, #ccc);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-desc {
  font-size: 1.1rem;
  opacity: 0.8;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.9rem;
  color: var(--primary);
  font-weight: 600;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  width: fit-content;
}

/* News Section */
.news-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-left: 0.5rem;
  letter-spacing: -0.5px;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.news-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
}

.news-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
  border-color: rgba(var(--primary-rgb), 0.3);
}

.news-img {
  width: 100%;
  height: 160px;
  overflow: hidden;
  position: relative;
}

.news-img::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
}

.news-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.news-card:hover .news-img img {
  transform: scale(1.1);
}

.news-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.news-date {
  font-size: 0.7rem;
  color: var(--primary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.news-content h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.news-content p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .news-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
