<script lang="ts" setup>
import { getItems } from '@ui/api/endpoints'
import ShopItem from '@ui/components/ShopItem.vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const data = ref<any[]>([])
const isLoading = ref(true)
const searchQuery = ref('')

const fetchItems = async (): Promise<void> => {
  isLoading.value = true
  const res = await getItems()

  if (res) {
    data.value = res
  }
  isLoading.value = false
}

const filteredItems = computed(() => {
  if (!searchQuery.value) return data.value
  return data.value.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

onMounted(async () => {
  await fetchItems()
})
</script>

<template>
  <div class="shop-layout">
    <div class="shop-header">
      <div class="search-container">
        <i class="fas fa-search"></i>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('shop.searchPlaceholder', 'Szukaj w sklepie...')"
        />
      </div>

      <div class="actions-dock">
        <button class="action-btn" :title="t('shop.refresh', 'Odśwież')" @click="fetchItems">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
        </button>
      </div>
    </div>

    <div class="shop-glass-panel">
      <div v-if="isLoading" class="loading-overlay">
        <i class="fas fa-spinner fa-spin"></i>
        <span>{{ t('shop.loading', 'Ładowanie sklepu...') }}</span>
      </div>

      <div v-else-if="filteredItems.length === 0" class="empty-state">
        <div class="empty-icon"><i class="fas fa-shopping-basket"></i></div>
        <h3>{{ t('shop.noResultsTitle', 'Brak produktów') }}</h3>
        <p>{{ t('shop.noResultsDesc', 'Nie znaleziono produktów spełniających kryteria.') }}</p>
      </div>

      <div v-else class="shop-grid custom-scrollbar">
        <ShopItem v-for="item in filteredItems" :key="item.uuid" :item="item" data-aos="fade-up" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-layout {
  width: 100%;
  height: calc(100vh - 60px);
  padding: 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header & Search */
.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-container {
  display: flex;
  align-items: center;
  background: rgba(20, 20, 25, 0.6);
  backdrop-filter: blur(10px);
  padding: 0.6rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 320px;
  transition: all 0.3s ease;
}
.search-container:focus-within {
  background: rgba(20, 20, 25, 0.9);
  border-color: rgba(var(--primary-rgb), 0.5);
  box-shadow: 0 0 15px rgba(var(--primary-rgb), 0.2);
}
.search-container i {
  color: var(--text-secondary);
  margin-right: 0.8rem;
}
.search-container input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  width: 100%;
}

/* Actions Dock */
.actions-dock {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(20, 20, 25, 0.6);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

/* Main Panel */
.shop-glass-panel {
  flex: 1;
  background: rgba(20, 20, 25, 0.4);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Loading & Empty */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 50;
  color: white;
  gap: 1rem;
}
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}
.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.1);
}

/* Grid */
.shop-grid {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
