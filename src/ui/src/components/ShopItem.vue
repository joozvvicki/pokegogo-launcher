<script setup lang="ts">
const props = defineProps<{
  item: any
}>()

const url = import.meta.env.RENDERER_VITE_API_URL

const fmt = (n: number): string =>
  `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(n)} PLN`

const handleClick = (e: MouseEvent): void => {
  if (props.item.uuid) {
    e.preventDefault()
    window.open(`${import.meta.env.RENDERER_VITE_WEBPAGE}/item?uuid=` + props.item.uuid)
  }
}
</script>

<template>
  <div class="shop-card" @click="handleClick">
    <div class="card-image-wrapper">
      <div class="glow-bg"></div>
      <img
        :src="
          item.src.includes('https://') || item.src.includes('blob')
            ? item.src
            : `${url}/items/image/${item.uuid}`
        "
        :alt="item.name"
        loading="lazy"
        @dragstart.prevent
      />
    </div>

    <div class="card-content">
      <h3 class="item-title">{{ item.name }}</h3>

      <div class="card-footer">
        <span class="price-badge">
          {{ fmt(item.price) }}
        </span>
        <button class="buy-btn">
          <i class="fas fa-external-link-alt"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shop-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  height: 340px;
}

.shop-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(var(--primary-rgb), 0.3);
  transform: translateY(-6px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
}

/* Image */
.card-image-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  overflow: hidden;
}

.glow-bg {
  position: absolute;
  width: 120px;
  height: 120px;
  background: var(--primary);
  opacity: 0.15;
  filter: blur(40px);
  border-radius: 50%;
  transition: opacity 0.3s;
}

.shop-card:hover .glow-bg {
  opacity: 0.25;
}

.card-image-wrapper img {
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.3));
  transition: transform 0.3s ease;
  z-index: 1;
}

.shop-card:hover img {
  transform: scale(1.08);
}

/* Content */
.card-content {
  padding: 1.2rem;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.item-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-badge {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--primary);
  background: rgba(var(--primary-rgb), 0.15);
  padding: 0.4rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--primary-rgb), 0.2);
}

.buy-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.shop-card:hover .buy-btn {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}
</style>
