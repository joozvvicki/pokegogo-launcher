<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script lang="ts" setup>
import { changeItemIndex, getItems, removeItem } from '@ui/api/endpoints'
import AddItem from '@ui/components/modals/AddItem.vue'
import useUserStore from '@ui/stores/user-store'
import { showToast } from '@ui/utils'
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const url = import.meta.env.RENDERER_VITE_API_URL
const userStore = useUserStore()

const allItems = ref<any[]>([])
const isLoadingItems = ref<boolean>(true)
const filteredItems = ref<any[]>([])
const searchQuery = ref('')
const noResultsVisible = ref(false)
const addItemModalRef = ref()

async function fetchItems(): Promise<void> {
  isLoadingItems.value = true
  if (!userStore.user) return

  const res = await getItems()

  if (res) {
    allItems.value = res
    filteredItems.value = [...allItems.value.sort((a, b) => (a.index > b.index ? 1 : -1))]
    noResultsVisible.value = false
    isLoadingItems.value = false
  }
}

const handleChangeItemIndex = async (item: any, step: number = 1): Promise<void> => {
  const res = await changeItemIndex(item.uuid, step)

  if (res) {
    showToast(
      `${t('items.toasts.indexChanged')} ${item.name} ` +
        `z ${item.index} ` +
        `na ${item.index + step}.`
    )
    await fetchItems()
  }
}

const handleRemoveItem = async (item: any): Promise<void> => {
  const res = await removeItem(item.uuid)

  if (res) {
    showToast(`${t('items.toasts.deleted')} ${item.name}.`)
    await fetchItems()
  }
}

watch(searchQuery, () => {
  filteredItems.value = allItems.value
    .sort((a, b) => (a.index > b.index ? 1 : -1))
    .filter(
      (item: any) =>
        item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        item.serviceName.toLowerCase().includes(searchQuery.value.toLowerCase())
    )

  if (!filteredItems.value?.length) {
    noResultsVisible.value = true
  } else {
    noResultsVisible.value = false
  }
})

onMounted(async () => {
  await fetchItems()
})
</script>

<template>
  <div class="users-container">
    <div class="search-input-wrapper mb-2">
      <i class="fas fa-search search-icon !text-[0.9rem] ml-3"></i>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input !p-2 !py-1 !pl-8 !text-[0.8rem]"
        :placeholder="t('items.searchPlaceholder')"
      />
    </div>

    <div class="logs-table-wrapper">
      <div v-if="isLoadingItems" class="loading-users">
        <i :class="'fas fa-spinner fa-spin'"></i>
        {{ t('items.loading') }}
        <button class="btn-primary" style="max-width: 300px" @click="fetchItems">
          {{ t('items.refresh') }}
        </button>
      </div>
      <template v-else>
        <div
          v-if="noResultsVisible"
          id="noResults"
          class="no-results flex items-center justify-center h-full flex-col gap-2"
        >
          <i class="fas fa-search"></i>
          <h3 class="text-lg">{{ t('items.noResultsTitle') }}</h3>
          <p>{{ t('items.noResultsDesc') }}</p>
        </div>
        <table v-else class="logs-table select-none">
          <thead>
            <tr class="font-black text-[0.9rem]">
              <th>{{ t('items.table.name') }}</th>
              <th>{{ t('items.table.price') }}</th>
              <th>{{ t('items.table.desc') }}</th>
              <th>
                <div class="relative flex flex-row-reverse gap-2 z-300">
                  <button class="info-btn" @click="fetchItems">
                    <i :class="'fas fa-refresh'"></i>
                  </button>
                  <button class="info-btn" @click="addItemModalRef?.openModal(null, 'add')">
                    <i :class="'fas fa-plus'"></i>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in filteredItems" :key="item.uuid">
              <tr>
                <td>
                  <div class="flex items-center gap-3">
                    <div class="flex flex-col gap-1">
                      <button
                        v-if="item.index !== filteredItems[0].index"
                        class="nav-icon"
                        @click="handleChangeItemIndex(item, -1)"
                      >
                        <i class="fa fa-chevron-up"></i>
                      </button>
                      <img
                        :src="
                          item.src.includes('https://') || item.src.includes('blob')
                            ? item.src
                            : `${url}/items/image/${item.uuid}`
                        "
                        class="w-[30px] h-[30px]"
                        @dragstart.prevent="null"
                      />
                      <button
                        v-if="item.index !== filteredItems[filteredItems.length - 1].index"
                        class="nav-icon"
                        @click="handleChangeItemIndex(item, 1)"
                      >
                        <i class="fa fa-chevron-down"></i>
                      </button>
                    </div>
                    <strong>{{ item.name }}</strong>
                  </div>
                </td>
                <td>
                  {{
                    item?.price
                      ? Number(item.price).toFixed(2) + ' PLN'
                      : t('items.priceParams.none')
                  }}
                </td>
                <td>
                  <pre
                    class="px-4 py-2 border-dashed border-[var(--border)] border rounded-xl max-w-3xl text-wrap"
                    >{{ item.desc }}</pre
                  >
                </td>
                <td>
                  <div class="reverse">
                    <button class="ban-btn" @click="handleRemoveItem(item)">
                      <i :class="'fas fa-trash'"></i>
                    </button>
                    <button class="nav-icon" @click="addItemModalRef?.openModal(item, 'edit')">
                      <i :class="'fas fa-pencil'"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </template>
    </div>
    <AddItem ref="addItemModalRef" @refresh-data="fetchItems" />
  </div>
</template>

<style scoped>
.loading-users {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.users-container {
  padding: 0.5rem;
  height: calc(100vh - 54.5px);
}
.reverse {
  display: flex;
  flex-direction: row-reverse;
  gap: 0.5rem;
}
.logs-table-wrapper {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-card);
  position: relative;
  height: calc(100vh - 109px);
  overflow-y: auto;
  border: 1px dashed var(--border);
}
.logs-table {
  width: 100%;
  height: calc(100vh - 157px);
  border-collapse: collapse;
}
.logs-table th {
  background: var(--bg-body);
  padding: 0.5rem 1rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}
.logs-table td {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
}

.logs-table tr {
  background: var(--bg-card);
}

.logs-table tr:hover {
  background: none;
}

.copy-btn {
  margin-left: 0.4rem;
  font-size: 0.7rem;
  padding: 0.2rem 0.3rem;
  border-radius: 0.3rem;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.4);
}

.copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  color: rgba(255, 255, 255, 0.2);
}

.online-dot {
  bottom: 4px;
  right: -2px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--bg-dark);
  border-radius: 50%;
}
.no-results {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}
.no-results i {
  font-size: 3rem;
  opacity: 0.5;
}
</style>
