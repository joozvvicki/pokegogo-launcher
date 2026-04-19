import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  setActivity: (details: string, state: string) => {
    ipcRenderer.send('discord:update-activity', { details, state })
  }
}

const customElectronAPI = {
  ...electronAPI,
  shell: {
    openExternal: (url: string) => shell.openExternal(url)
  },
  images: {
    getEvent: (uuid: string, url: string) => ipcRenderer.invoke('image:get-event', uuid, url)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', customElectronAPI)
    contextBridge.exposeInMainWorld('discord', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = customElectronAPI
  // @ts-ignore (define in dts)
  window.discord = api
}
