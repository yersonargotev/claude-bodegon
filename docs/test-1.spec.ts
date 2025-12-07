import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.exito.com/tecnologia/consolas-y-videojuegos');
  await page.getByTestId('product-link').first().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Product Image' }).first().click({
    button: 'right'
  });
  const download = await downloadPromise;
  await page.locator('.swiper-pagination > span:nth-child(2)').click();
  const download1Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Product Image' }).nth(1).click({
    button: 'right'
  });
  const download1 = await download1Promise;
  await page.locator('.swiper-pagination > span:nth-child(3)').click();
  const download2Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Product Image' }).nth(2).click({
    button: 'right'
  });
  const download2 = await download2Promise;
  await page.goto('https://www.exito.com/tecnologia/consolas-y-videojuegos');
  await page.getByTestId('product-link').nth(4).click();
  const download3Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Product Image' }).first().click({
    button: 'right'
  });
  const download3 = await download3Promise;
  await page.locator('.swiper-pagination > span:nth-child(2)').click();
  const download4Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Product Image' }).nth(1).click({
    button: 'right'
  });
  const download4 = await download4Promise;
  await page.goto('https://www.exito.com/tecnologia/consolas-y-videojuegos');
  await page.getByRole('link', { name: 'Imagen del producto' }).nth(3).click();
  const download5Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Product Image' }).first().click({
    button: 'right'
  });
  const download5 = await download5Promise;
  await page.locator('.swiper-pagination').click();
  await page.locator('.swiper-pagination > span:nth-child(3)').click();
});