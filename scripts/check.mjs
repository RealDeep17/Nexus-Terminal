import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('Browser Console Error:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.log('Browser Page Error:', err.message);
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await browser.close();
})();
