<script lang="ts" setup>
import { ref, reactive, computed } from 'vue'
import { themes, main } from '@ui/assets/theme/themes'
import useGeneralStore from '@ui/stores/general-store'

// --- KONFIGURACJA UI ---
// Definiujemy kategorie zakładek
const categories = {
  colors: { label: 'Paleta Główna', icon: 'fas fa-palette' },
  backgrounds: { label: 'Tła & Obrazy', icon: 'fas fa-image' },
  ui: { label: 'UI & Elementy', icon: 'fas fa-layer-group' },
  text: { label: 'Tekst & Komunikaty', icon: 'fas fa-font' },
  login: { label: 'Login & Form', icon: 'fas fa-sign-in-alt' },
  effects: { label: 'Efekty & Inne', icon: 'fas fa-magic' }
}

// Mapowanie kluczy zmiennych na czytelne nazwy i kategorie
// To obejmuje WSZYSTKIE pola z twojego pliku themes.ts
const propertyConfig: Record<
  string,
  { label: string; category: keyof typeof categories; type?: 'textarea' | 'text' }
> = {
  // --- Paleta Główna ---
  name: { label: 'Nazwa wewn. (bez spacji)', category: 'effects', type: 'text' },
  primary: { label: 'Kolor Wiodący (Primary)', category: 'colors' },
  primaryShop: { label: 'Akcent Sklepu', category: 'colors' },
  primaryDark: { label: 'Primary Ciemny', category: 'colors' },
  primaryLight: { label: 'Primary Jasny / Off-White', category: 'colors' },

  // --- Tła ---
  bgDark: { label: 'Tło Ciemne (Główne)', category: 'backgrounds' },
  bgCard: { label: 'Tło Karty (Przezroczyste)', category: 'backgrounds' },
  bgLight: { label: 'Tło Jasne / Surface', category: 'backgrounds' },
  bgBody: { label: 'Tło Body (Podkład)', category: 'backgrounds' },
  bgPrimary: { label: 'Tło Primary', category: 'backgrounds' },
  bgInput: { label: 'Tło Inputów', category: 'backgrounds' },
  loadingOverlay: { label: 'Overlay Ładowania', category: 'backgrounds' },
  vignetteColor: { label: 'Kolor Winiety', category: 'backgrounds' },
  backgroundImage: { label: 'URL Obrazka Tła', category: 'backgrounds', type: 'text' },

  // --- Tekst ---
  textPrimary: { label: 'Tekst Główny', category: 'text' },
  textSecondary: { label: 'Tekst Drugorzędny', category: 'text' },
  textSecondaryAlt: { label: 'Tekst Alternatywny', category: 'text' },
  textMuted: { label: 'Tekst Wyciszony', category: 'text' },
  breadcrumbsText: { label: 'Tekst Breadcrumbs', category: 'text' },
  errorMessage: { label: 'Tekst Błędu', category: 'text' },

  // --- UI Elements ---
  border: { label: 'Border (Główny)', category: 'ui' },
  border2: { label: 'Border (Drugi)', category: 'ui' },
  borderPrimary: { label: 'Border Primary', category: 'ui' },
  borderRadius: { label: 'Zaokrąglenie (px)', category: 'ui', type: 'text' },
  borderRadiusSmall: { label: 'Małe zaokrąglenie', category: 'ui', type: 'text' },
  newsItem: { label: 'News Item Tło', category: 'ui' },
  newsItemHover: { label: 'News Item Hover', category: 'ui' },
  btnHover: { label: 'Przycisk Hover', category: 'ui' },
  btnGlow: { label: 'Poświata Przycisku', category: 'ui' },
  footerHover: { label: 'Stopka Hover', category: 'ui' },
  shopItem: { label: 'Gradient Sklepu', category: 'ui', type: 'textarea' },
  navIcon: { label: 'Ikony Nawigacji', category: 'ui' },
  navItem: { label: 'Tło Nawigacji', category: 'ui' },
  navItemHoverNavIcon: { label: 'Nav Hover Ikona', category: 'ui' },
  navItemActive: { label: 'Nav Aktywny', category: 'ui' },
  tagDark: { label: 'Tag Ciemny', category: 'ui' },
  statusPulse: { label: 'Puls Statusu', category: 'ui' },
  banBtn: { label: 'Przycisk Ban', category: 'ui' },
  banBtnText: { label: 'Tekst Ban', category: 'ui' },
  toastError: { label: 'Toast Błąd', category: 'ui' },
  toastWarning: { label: 'Toast Ostrzeżenie', category: 'ui' },

  // --- Login & Form ---
  loginTabBtnBg: { label: 'Login Tab Tło', category: 'login' },
  loginTabBtnHover: { label: 'Login Tab Hover', category: 'login' },
  loginInvalidBg: { label: 'Login Invalid Tło', category: 'login' },
  loginInvalidBorder: { label: 'Login Invalid Border', category: 'login' },
  btnMicrosoft: { label: 'Przycisk Microsoft', category: 'login', type: 'textarea' },
  playerLogout: { label: 'Przycisk Wyloguj', category: 'login' },

  // --- Efekty & Inne ---
  gradientPrimary: { label: 'Gradient Główny', category: 'effects', type: 'textarea' },
  gradientBanned: { label: 'Gradient Ban', category: 'effects', type: 'textarea' },
  gradientOverlay: { label: 'Gradient Overlay', category: 'effects', type: 'textarea' },
  shadowGlow: { label: 'Cień Glow', category: 'effects', type: 'text' },
  shadowCard: { label: 'Cień Karty', category: 'effects', type: 'text' },
  transition: { label: 'Animacja (CSS)', category: 'effects', type: 'text' },
  firstFloating: { label: 'Emoji 1 (Latające)', category: 'effects', type: 'text' },
  secondFloating: { label: 'Emoji 2 (Latające)', category: 'effects', type: 'text' }
}

// --- LOGIKA KOMPONENTU ---

const isVisible = ref(false)
const activeTab = ref<keyof typeof categories>('colors')
const customTheme = ref<Record<string, string> | null>(
  localStorage.getItem('customTheme') ? JSON.parse(localStorage.getItem('customTheme')!) : null
)

const editingTheme = reactive<Record<string, string>>({
  ...(customTheme.value ?? main),
  name: 'custom'
} as Record<string, string>)

const categorizedFields = computed(() => {
  const groups: Record<string, Array<{ key: string; label: string; type: string }>> = {}

  Object.keys(categories).forEach((k) => (groups[k] = []))

  Object.keys(editingTheme).forEach((key): void => {
    const config = propertyConfig[key]

    const category = config?.category || 'effects'
    const label = config?.label || key

    let type: string | undefined = config?.type
    if (!type) {
      const val = editingTheme[key]
      if (typeof val === 'string' && (val.includes('gradient') || val.length > 50))
        type = 'textarea'
      else if (isColor(val)) type = 'color'
      else type = 'text'
    }

    if (groups[category]) {
      groups[category].push({ key, label, type })
    }
  })

  return groups
})

const open = (): void => {
  isVisible.value = true
}
const close = (): void => {
  isVisible.value = false
}

const isColor = (val: string): boolean => {
  if (typeof val !== 'string') return false
  return val.startsWith('#') || val.startsWith('rgb') || val.startsWith('rgba')
}

const getHexPart = (color: string): string => {
  if (!color || typeof color !== 'string') return '#000000'
  if (color.startsWith('#')) return color.substring(0, 7)
  if (color.startsWith('rgb')) {
    const parts = color.match(/\d+/g)
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0]).toString(16).padStart(2, '0')
      const g = parseInt(parts[1]).toString(16).padStart(2, '0')
      const b = parseInt(parts[2]).toString(16).padStart(2, '0')
      return `#${r}${g}${b}`
    }
  }
  return '#000000'
}

const getAlphaPart = (color: string): number => {
  if (!color || typeof color !== 'string') return 100
  if (color.startsWith('#') && color.length === 9) {
    const alphaHex = color.substring(7, 9)
    return Math.round((parseInt(alphaHex, 16) / 255) * 100)
  }
  if (color.startsWith('rgba')) {
    const parts = color.match(/[\d.]+/g)
    if (parts && parts.length >= 4) return Math.round(parseFloat(parts[3]) * 100)
  }
  return 100
}

const setAlphaInHex = (hex: string, alphaPercent: number): string => {
  const alphaVal = Math.round((alphaPercent / 100) * 255)
  const alphaHex = alphaVal.toString(16).padStart(2, '0')
  return `${hex}${alphaHex}`
}

const updateFromPicker = (key: string, newHex: string): void => {
  const currentVal = editingTheme[key]
  const currentAlpha = getAlphaPart(currentVal)
  const finalColor = setAlphaInHex(newHex, currentAlpha)
  editingTheme[key] = finalColor
  updateLivePreview(key, finalColor)
}

const updateFromSlider = (key: string, newAlpha: string): void => {
  const currentVal = editingTheme[key]
  const hexPart = getHexPart(currentVal)
  const finalColor = setAlphaInHex(hexPart, parseInt(newAlpha))
  editingTheme[key] = finalColor
  updateLivePreview(key, finalColor)
}

const updateLivePreview = (key: string, value: string): void => {
  if (value === null || value === undefined) return
  document.documentElement.style.setProperty(
    `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
    value
  )
}

const loadBaseTheme = (themeName: string): void => {
  const base = themes.find((t) => t.name === themeName) || main
  Object.assign(editingTheme, JSON.parse(JSON.stringify(base)))
  editingTheme.name = 'custom' // Zawsze nadpisz nazwę na custom

  Object.entries(editingTheme).forEach(([k, v]): void => {
    if (typeof v === 'string') updateLivePreview(k, v)
  })
}

const generalStore = useGeneralStore()

const saveAndClose = (): void => {
  generalStore.setCustomTheme(editingTheme)
  close()
}

const exportTheme = (): void => {
  try {
    // 1. Konwersja obiektu motywu na tekst JSON (z wcięciami dla czytelności)
    const dataStr = JSON.stringify(editingTheme, null, 2)

    // 2. Utworzenie Bloba (pliku w pamięci)
    const blob = new Blob([dataStr], { type: 'application/json' })

    // 3. Utworzenie tymczasowego linku do pobrania
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `theme-${editingTheme.name || 'custom'}.json`

    // 4. Kliknięcie i posprzątanie
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Błąd podczas eksportu motywu:', error)
  }
}

const importTheme = (): void => {
  // 1. Tworzymy dynamicznie input file
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'

  // 2. Nasłuchujemy zmiany (wyboru pliku)
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    if (!file) return

    const reader = new FileReader()

    // 3. Po wczytaniu pliku
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsedTheme = JSON.parse(content)

        // Walidacja: czy to w ogóle jest obiekt?
        if (typeof parsedTheme !== 'object' || parsedTheme === null) {
          alert('Nieprawidłowy format pliku motywu.')
          return
        }

        // 4. Aktualizacja stanu i podglądu CSS
        Object.assign(editingTheme, parsedTheme)

        // Aplikujemy zmiany wizualne dla każdej właściwości
        Object.entries(parsedTheme).forEach(([key, value]) => {
          if (typeof value === 'string') {
            updateLivePreview(key, value)
          }
        })
      } catch (err) {
        console.error('Błąd parsowania JSON:', err)
        alert('Błąd podczas importu pliku. Sprawdź czy plik jest poprawnym JSON-em.')
      }
    }

    // Rozpocznij czytanie pliku jako tekst
    reader.readAsText(file)
  }

  // 5. Symulujemy kliknięcie, by otworzyć dialog systemowy
  input.click()
}

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-fade">
      <div v-if="isVisible" class="theme-editor-wrapper">
        <div class="backdrop" @click="close"></div>

        <div class="editor-panel">
          <div class="panel-header">
            <h3><i class="fas fa-swatchbook mr-2"></i> Edytor Motywu</h3>
            <div class="flex gap-2">
              <button class="nav-icon" @click="importTheme">
                <i class="fas fa-upload"></i>
              </button>
              <button class="nav-icon" @click="exportTheme">
                <i class="fas fa-download"></i>
              </button>
              <button class="close-btn" @click="close"><i class="fas fa-times"></i></button>
            </div>
          </div>

          <div class="presets-row">
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="t in themes"
                :key="t.name"
                class="preset-btn"
                :style="{ borderColor: t.primary }"
                @click="loadBaseTheme(t.name)"
              >
                {{ t.name }}
              </button>
            </div>
          </div>

          <div class="tabs-nav">
            <button
              v-for="(cat, key) in categories"
              :key="key"
              class="tab-btn"
              :class="{ active: activeTab === key }"
              :title="cat.label"
              @click="activeTab = key"
            >
              <i :class="cat.icon"></i>
              <span class="hidden sm:inline text-[10px] uppercase mt-1">{{
                cat.label.split(' ')[0]
              }}</span>
            </button>
          </div>

          <div class="editor-scroll-area custom-scrollbar">
            <div
              v-if="categorizedFields[activeTab]?.length === 0"
              class="text-center text-[var(--text-muted)] mt-10"
            >
              Brak opcji w tej kategorii.
            </div>

            <div
              v-for="field in categorizedFields[activeTab]"
              :key="field.key"
              class="control-group"
            >
              <div class="label-row">
                <label>{{ field.label }}</label>
                <span class="var-name" title="Kliknij by skopiować" @click="(): void => {}"
                  >--{{ field.key }}</span
                >
              </div>

              <div class="input-combo">
                <div v-if="field.type === 'color'" class="color-controls">
                  <div
                    class="color-preview-wrapper"
                    :style="{ backgroundColor: editingTheme[field.key] }"
                  >
                    <input
                      type="color"
                      :value="getHexPart(editingTheme[field.key])"
                      @input="
                        (e) => updateFromPicker(field.key, (e.target as HTMLInputElement).value)
                      "
                    />
                  </div>
                  <div class="alpha-slider-wrapper" title="Przezroczystość (Alpha)">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      :value="getAlphaPart(editingTheme[field.key])"
                      @input="
                        (e) => updateFromSlider(field.key, (e.target as HTMLInputElement).value)
                      "
                    />
                  </div>
                </div>

                <textarea
                  v-if="field.type === 'textarea'"
                  v-model="editingTheme[field.key]"
                  rows="3"
                  class="text-input"
                  spellcheck="false"
                  @input="updateLivePreview(field.key, editingTheme[field.key])"
                ></textarea>

                <input
                  v-else
                  v-model="editingTheme[field.key]"
                  type="text"
                  class="text-input"
                  :placeholder="field.key"
                  spellcheck="false"
                  @input="updateLivePreview(field.key, editingTheme[field.key])"
                />
              </div>
            </div>
          </div>

          <div class="panel-footer">
            <button class="btn-save" @click="saveAndClose">
              <i class="fas fa-save"></i> Zapisz i Zamknij
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.theme-editor-wrapper {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  justify-content: flex-start;
  font-family: sans-serif;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.editor-panel {
  position: relative;
  width: 420px;
  max-width: 95vw;
  height: 100%;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  box-shadow: 20px 0 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-dark);
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px;
}
.close-btn:hover {
  color: var(--text-primary);
}

.presets-row {
  color: var(--text-primary);
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border2);
}

.preset-btn {
  padding: 4px 12px;
  border: 1px solid;
  border-radius: 20px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.2s;
}
.preset-btn:hover {
  opacity: 1;
  transform: scale(1.05);
}

.tabs-nav {
  display: flex;
  padding: 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  flex: 1;
  min-width: 60px;
  padding: 12px 4px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  transition: all 0.2s;
}
.tab-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}
.tab-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--primary);
  background: linear-gradient(to top, var(--primary-shop) 0%, transparent 100%);
}

.editor-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.control-group {
  margin-bottom: 1.25rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.var-name {
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--text-primary);
  opacity: 0.5;
  cursor: help;
}

.input-combo {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.color-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.color-preview-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--border);
  position: relative;
  overflow: hidden;
  background-image:
    linear-gradient(45deg, var(--bg-card) 25%, transparent 25%),
    linear-gradient(-45deg, var(--bg-card) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--bg-card) 75%),
    linear-gradient(-45deg, transparent 75%, var(--bg-card) 75%);
  background-size: 10px 10px;
  background-position:
    0 0,
    0 5px,
    5px -5px,
    -5px 0px;
}

.color-preview-wrapper input[type='color'] {
  opacity: 0;
  position: absolute;
  top: -5px;
  left: -5px;
  width: 200%;
  height: 200%;
  cursor: pointer;
}

.alpha-slider-wrapper {
  width: 50px;
  display: flex;
  align-items: center;
}
.alpha-slider-wrapper input[type='range'] {
  width: 100%;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
}
.alpha-slider-wrapper input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.text-input {
  flex: 1;
  width: 0; /* flex fix */
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.8rem;
  outline: none;
  transition: all 0.2s;
}
.text-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-shop);
}

.panel-footer {
  padding: 1.25rem;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
}

.btn-save {
  width: 100%;
  padding: 12px;
  background: var(--bg-card);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
.btn-save:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadowGlow);
}

/* Animacje */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
}
.slide-fade-enter-active .editor-panel,
.slide-fade-leave-active .editor-panel {
  transition: transform 0.3s cubic-bezier(0.2, 1, 0.3, 1);
}
.slide-fade-enter-from .editor-panel,
.slide-fade-leave-to .editor-panel {
  transform: translateX(-100%);
}

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
