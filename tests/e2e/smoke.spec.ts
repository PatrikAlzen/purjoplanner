import { test, expect } from '@playwright/test'

test.describe('PurjoPlanner roadmap planner smoke test', () => {
  test('load board, create a task, edit it, switch theme, add/remove a lane, and persist across reload', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'PurjoPlanner' })).toBeVisible()

    // Wait for hydration + initial board data load to finish before interacting.
    await expect(page.locator('.lane-label input').first()).toHaveValue(/.+/)

    // Create a new task via the "+ New task" button.
    await page.getByRole('button', { name: '+ New task' }).click()

    const panel = page.locator('.panel.open')
    await expect(panel).toBeVisible()

    // Edit name, description and link in the panel.
    const nameInput = panel.locator('.panel-name')
    await nameInput.fill('Launch marketing site')

    const descInput = panel.locator('#panel-desc')
    await descInput.fill('Coordinate with design and content teams.')

    const linkInput = panel.locator('#panel-link')
    await linkInput.fill('https://wiki.example.com/ticket-42')

    // Wait for debounced persistence (300ms) before closing the panel.
    await page.waitForTimeout(500)
    await panel.locator('.panel-close').click()
    await expect(panel).not.toBeVisible()

    await expect(page.getByText('Launch marketing site')).toBeVisible()

    // Add a new lane.
    const laneLabelsBefore = await page.locator('.lane-label input').count()
    await page.getByRole('button', { name: '+ Add lane' }).click()
    await expect(page.locator('.lane-label input')).toHaveCount(laneLabelsBefore + 1)

    // Remove the newly added empty lane (remove button only visible on hover).
    const lastLane = page.locator('.lane').last()
    await lastLane.hover()
    await lastLane.locator('.lane-remove').click()
    await expect(page.locator('.lane-label input')).toHaveCount(laneLabelsBefore)

    // Switch theme via the theme picker dropdown.
    await page.locator('.theme-picker .picker-btn').click()
    await page.locator('.theme-picker .menu-item', { hasText: 'Midnight' }).click()
    await expect(page.locator('.theme-picker .picker-btn')).toContainText('Midnight')

    // Reload and confirm the task, its edits, and theme choice persisted.
    await page.reload()
    await expect(page.getByText('Launch marketing site')).toBeVisible()
    await expect(page.locator('.theme-picker .picker-btn')).toContainText('Midnight')
  })
})
