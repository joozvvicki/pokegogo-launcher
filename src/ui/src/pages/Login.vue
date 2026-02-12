<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script lang="ts" setup>
import Header from '@ui/components/core/Header.vue'
import Background from '@ui/components/Background.vue'
import { Message } from 'primevue'

import { useLoginService } from '@ui/services/login-service'
import { AccountType, ActiveTab } from '@ui/types/app'

const { useMethods, useVariables } = useLoginService()

const { handleLogin, handleChangeTab, removeSavedAccount, handleRegister } = useMethods()
const { savedAccounts, appState, formState, login$ } = useVariables()

import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <Header />
  <Background />

  <footer class="absolute z-200 bottom-2 w-full text-center">
    <div class="text-[10px] text-[var(--text-muted)] text-center">
      <p>&copy; 2025-2026 Pokemongogo.pl. {{ t('login.copyright') }}</p>
    </div>
  </footer>

  <div class="flex justify-center items-center h-[calc(100vh-54.5px)]">
    <div
      class="flex my-auto overflow-hidden flex-col justify-center border-[var(--primary)]/20 border w-1/3 mx-auto p-10 rounded-xl backdrop-blur-md"
    >
      <Transition name="fade" mode="out-in">
        <div v-if="appState.activeTab === ActiveTab.LOGIN">
          <h1 class="text-2xl w-full text-center mb-2">{{ t('login.title') }}</h1>
          <p class="text-center mb-4">
            {{ t('login.subtitle') }}
          </p>

          <div class="flex gap-2">
            <div
              v-for="savedAccount in savedAccounts"
              :key="savedAccount.nickname"
              class="relative px-4 py-2 flex items-center flex-col gap-1 border border-[var(--primary)]/20 rounded-md backdrop-blur-2xl w-1/3 hover:bg-[var(--primary-shop)] hover:text-white hover:cursor-pointer"
              @click="handleLogin(savedAccount)"
            >
              <button
                class="absolute top-2 right-2 hover:cursor-pointer"
                @click.stop="removeSavedAccount(savedAccount)"
              >
                <i class="fa fa-trash" />
              </button>
              <img
                v-if="savedAccount.url"
                :src="savedAccount.url"
                class="rounded-full w-8 h-8"
                @dragstart.prevent="null"
              />
              <div
                v-else
                class="rounded-full border-[var(--border)] border-2 w-8 h-8 flex items-center justify-center"
              >
                <i class="fa fa-user" />
              </div>
              <p class="text-[10px] text-[var(--text-muted)]">
                {{ savedAccount.nickname }}
              </p>
            </div>
          </div>

          <div v-if="savedAccounts.length" class="flex relative w-full">
            <hr class="my-4 w-full border-[var(--primary)]" />
            <span class="mt-[7px] mx-2">{{ t('login.or') }}</span>
            <hr class="my-4 w-full border-[var(--primary)]" />
          </div>

          <div class="flex relative flex-col w-full">
            <div class="form-group h-full" :class="{ '!mb-5': login$.nick.$error }">
              <div class="input-wrapper flex">
                <i
                  class="fa fa-user absolute top-1/2 -translate-y-1/2 ml-3 text-[var(--primary)]"
                />
                <input
                  v-model="formState.nick"
                  type="text"
                  :placeholder="t('login.placeholder.nick')"
                  class="form-input !pl-[2rem] group"
                  :class="{ invalid: login$.nick.$error }"
                />
              </div>
              <div class="error-message" :class="{ show: login$.nick.$error }">
                {{ login$.nick.$errors[0]?.$message }}
              </div>
            </div>

            <div class="form-group h-full" :class="{ '!mb-5': login$.password.$error }">
              <div class="input-wrapper flex">
                <i
                  class="fa fa-lock absolute top-1/2 -translate-y-1/2 ml-3 text-[var(--primary)]"
                />
                <input
                  v-model="formState.password"
                  :type="formState.passwordType"
                  placeholder="Podaj hasło.."
                  class="form-input !pl-[2rem] group"
                  :class="{ invalid: login$.password.$error }"
                />
                <i
                  class="fa absolute top-1/2 right-3 -translate-y-1/2 ml-3 hover:text-[var(--primary)] hover:cursor-pointer"
                  :class="{
                    'fa-eye-slash': formState.passwordType === 'password',
                    'fa-eye': formState.passwordType === 'text'
                  }"
                  @click="
                    formState.passwordType =
                      formState.passwordType === 'password' ? 'text' : 'password'
                  "
                />
              </div>
              <div class="error-message" :class="{ show: login$.password.$error }">
                {{ login$.password.$errors[0]?.$message }}
              </div>
            </div>

            <button class="btn-primary mt-2" @click="handleLogin(null)">
              {{ t('login.loginButton') }}
            </button>
          </div>

          <div class="flex relative w-full">
            <hr class="my-4 w-full border-[var(--primary)]" />
            <span class="mt-[7px] mx-2">{{ t('login.or') }}</span>
            <hr class="my-4 w-full border-[var(--primary)]" />
          </div>

          <button
            class="btn-microsoft"
            @click="handleLogin({ accountType: AccountType.MICROSOFT })"
          >
            <i class="fab fa-microsoft"></i>
            <span>{{ t('login.microsoftLogin') }}</span>
          </button>

          <p class="text-xs text-center">
            {{ t('login.noAccount') }}
            <span
              class="text-[var(--primary)] hover:cursor-pointer hover:underline"
              @click="handleChangeTab(ActiveTab.REGISTER)"
              >{{ t('login.register') }}</span
            >
          </p>
        </div>
        <div v-else>
          <h1 class="text-2xl w-full text-center mb-2">{{ t('register.title') }}</h1>
          <p class="text-center mb-4">
            {{ t('register.subtitle') }}
          </p>

          <Message
            severity="info"
            class="!bg-blue-400/20 !text-blue-500 !outline !outline-blue-700 !mb-4"
          >
            <span class="text-[10px]">
              {{ t('register.info') }}
            </span>
          </Message>

          <div class="flex relative flex-col w-full">
            <div class="form-group h-full" :class="{ '!mb-5': login$.nick.$error }">
              <div class="input-wrapper flex">
                <i
                  class="fa fa-user absolute top-1/2 -translate-y-1/2 ml-3 text-[var(--primary)]"
                />
                <input
                  v-model="formState.nick"
                  type="text"
                  :placeholder="t('register.placeholder.nick')"
                  class="form-input group !pl-[2rem]"
                  :class="{ invalid: login$.nick.$error }"
                />
              </div>
              <div class="error-message" :class="{ show: login$.nick.$error }">
                {{ login$.nick.$errors[0]?.$message }}
              </div>
            </div>

            <div class="form-group h-full" :class="{ '!mb-5': login$.email?.$error }">
              <div class="input-wrapper flex">
                <i
                  class="fa fa-envelope absolute top-1/2 -translate-y-1/2 ml-3 text-[var(--primary)]"
                />
                <input
                  v-model="formState.email"
                  type="text"
                  :placeholder="t('register.placeholder.email')"
                  class="form-input !pl-[2rem] group"
                  :class="{ invalid: login$.email?.$error }"
                />
              </div>
              <div class="error-message" :class="{ show: login$.email?.$error }">
                {{ login$.email?.$errors[0]?.$message }}
              </div>
            </div>

            <div class="form-group h-full" :class="{ '!mb-5': login$.password.$error }">
              <div class="input-wrapper flex">
                <i
                  class="fa fa-lock absolute top-1/2 -translate-y-1/2 ml-3 text-[var(--primary)]"
                />
                <input
                  v-model="formState.password"
                  :type="formState.passwordType"
                  placeholder="Podaj hasło.."
                  class="form-input !pl-[2rem] group"
                  :class="{ invalid: login$.password.$error }"
                />
                <i
                  class="fa absolute top-1/2 right-3 -translate-y-1/2 ml-3 hover:text-[var(--primary)] hover:cursor-pointer"
                  :class="{
                    'fa-eye-slash': formState.passwordType === 'password',
                    'fa-eye': formState.passwordType === 'text'
                  }"
                  @click="
                    formState.passwordType =
                      formState.passwordType === 'password' ? 'text' : 'password'
                  "
                />
              </div>
              <div class="error-message" :class="{ show: login$.password.$error }">
                {{ login$.password.$errors[0]?.$message }}
              </div>
            </div>

            <div class="form-group h-full" :class="{ '!mb-5': login$.repeatPassword?.$error }">
              <div class="input-wrapper flex">
                <i
                  class="fa fa-lock absolute top-1/2 -translate-y-1/2 ml-3 text-[var(--primary)]"
                />
                <input
                  v-model="formState.repeatPassword"
                  :type="formState.repeatPasswordType"
                  :placeholder="t('register.placeholder.repeatPassword')"
                  class="form-input !pl-[2rem] group"
                  :class="{ invalid: login$.repeatPassword?.$error }"
                />
                <i
                  class="fa absolute top-1/2 right-3 -translate-y-1/2 ml-3 hover:text-[var(--primary)] hover:cursor-pointer"
                  :class="{
                    'fa-eye-slash': formState.repeatPasswordType === 'password',
                    'fa-eye': formState.repeatPasswordType === 'text'
                  }"
                  @click="
                    formState.repeatPasswordType =
                      formState.repeatPasswordType === 'password' ? 'text' : 'password'
                  "
                />
              </div>
              <div class="error-message" :class="{ show: login$.repeatPassword?.$error }">
                {{ login$.repeatPassword?.$errors[0]?.$message }}
              </div>
            </div>

            <button class="btn-primary my-2" @click="handleRegister">
              {{ t('register.registerButton') }}
            </button>

            <p class="text-xs text-center">
              {{ t('register.hasAccount') }}
              <span
                class="text-[var(--primary)] hover:cursor-pointer hover:underline"
                @click="handleChangeTab(ActiveTab.LOGIN)"
              >
                {{ t('register.login') }}
              </span>
            </p>
          </div>
        </div>
      </Transition>
    </div>
  </div>

  <div id="toastContainer" class="toast-container"></div>
  <div v-if="appState.loading" class="loading-overlay">
    <div class="loading-content">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <div class="loading-text">
        <span id="loading-message">{{ appState.loadingMessage ?? t('general.loading') }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="css">
@import '@ui/assets/login.css';

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
