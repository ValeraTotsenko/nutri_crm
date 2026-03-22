import '@testing-library/jest-dom'

// Mock Telegram WebApp
window.Telegram = {
  WebApp: {
    initData: 'mock_init_data',
    initDataUnsafe: { user: { id: 123456789 } },
    colorScheme: 'light',
    ready: () => {},
    expand: () => {},
    BackButton: { show: () => {}, hide: () => {}, onClick: () => {} },
    MainButton: { show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {} },
  },
}
