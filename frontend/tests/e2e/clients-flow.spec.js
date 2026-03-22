import { test, expect } from '@playwright/test'

// E2E тесты запускаются против реального запущенного приложения
// npm run dev + playwright test

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

test.describe('Clients flow', () => {
  test.beforeEach(async ({ page }) => {
    // Инжектируем мок Telegram WebApp
    await page.addInitScript(() => {
      window.Telegram = {
        WebApp: {
          initData: 'mock_init_data',
          initDataUnsafe: { user: { id: 123456789 } },
          colorScheme: 'light',
          ready: () => {},
          expand: () => {},
          BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
          MainButton: { show: () => {}, hide: () => {}, setText: () => {}, onClick: () => {} },
        },
      }
    })
    await page.goto(BASE_URL)
  })

  test('главная страница показывает список клиентов', async ({ page }) => {
    await expect(page).toHaveURL(/\/clients/)
    await expect(page.locator('h1')).toContainText('Клиенты')
  })

  test('нижняя навигация имеет 3 таба', async ({ page }) => {
    const tabs = page.locator('nav a')
    await expect(tabs).toHaveCount(3)
  })

  test('FAB кнопка открывает форму добавления клиента', async ({ page }) => {
    await page.locator('button[aria-label="+"]').click()
    await expect(page.getByText('Новый клиент')).toBeVisible()
  })

  test('переход на вкладку Лиды', async ({ page }) => {
    await page.getByText('Лиды').click()
    await expect(page).toHaveURL(/\/leads/)
  })

  test('переход на вкладку Задачи', async ({ page }) => {
    await page.getByText('Задачи').click()
    await expect(page).toHaveURL(/\/tasks/)
  })
})
