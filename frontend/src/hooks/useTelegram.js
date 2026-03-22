import { useEffect } from 'react'

const tg = window.Telegram?.WebApp

export function useTelegram() {
  useEffect(() => {
    tg?.ready()
    tg?.expand()
  }, [])

  return {
    tg,
    initData: tg?.initData || '',
    theme: tg?.colorScheme || 'light',
    user: tg?.initDataUnsafe?.user || null,
    backButton: tg?.BackButton,
    mainButton: tg?.MainButton,
  }
}

export function useBackButton(onClick) {
  const { backButton } = useTelegram()
  useEffect(() => {
    if (!backButton) return
    backButton.show()
    backButton.onClick(onClick)
    return () => {
      backButton.offClick(onClick)
      backButton.hide()
    }
  }, [backButton, onClick])
}
