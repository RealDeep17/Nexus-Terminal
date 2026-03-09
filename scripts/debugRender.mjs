import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching headless browser...");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('BROWSER ERROR:', msg.text());
        } else {
            console.log('BROWSER LOG:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('PAGE ERROR EXCEPTION:', err.message);
    });

    console.log("Navigating to local Vite app...");
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });

    console.log("Wait complete. Closing...");
    await browser.close();
})();
