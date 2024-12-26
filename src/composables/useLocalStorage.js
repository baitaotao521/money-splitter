import { ref, watch } from 'vue'

export function useLocalStorage(key, defaultValue) {
  const stored = localStorage.getItem(key)
  const state = ref(stored ? JSON.parse(stored) : defaultValue)

  watch(
    state,
    (newValue) => {
      localStorage.setItem(key, JSON.stringify(newValue))
    },
    { deep: true }
  )

  return {
    state,
    setState: (newValue) => {
      state.value = newValue
    }
  }
} 