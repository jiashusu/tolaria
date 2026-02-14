import { test } from '@playwright/test'

test('capture app screenshot for review', async ({ page }) => {
  await page.goto('/')
  // Wait for mock data to load
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/app-screenshot.png', fullPage: true })
})

test('capture editor with note selected', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click the first note in the list
  await page.click('.note-list__item')
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/editor-screenshot.png', fullPage: true })
})

test('live preview: click on heading reveals syntax', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click a note to load it
  await page.click('.note-list__item')
  await page.waitForTimeout(300)

  // Screenshot before clicking heading (syntax hidden)
  await page.screenshot({ path: 'test-results/live-preview-before.png', fullPage: true })

  // Click on the "Build Laputa App" heading text in the editor
  await page.click('.cm-live-heading-1')
  await page.waitForTimeout(200)

  // Screenshot after clicking heading (syntax revealed)
  await page.screenshot({ path: 'test-results/live-preview-after.png', fullPage: true })
})
