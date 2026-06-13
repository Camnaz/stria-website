
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Enable performance metrics
  await page.goto('https://striasystems.com/', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Get performance metrics
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      // Wait for LCP
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntriesByType('largest-contentful-paint');
        if (entries.length > 0) {
          const lcp = entries[entries.length - 1].startTime;
          observer.disconnect();
          
          // Also get CLS
          let cls = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                cls += entry.value;
              }
            }
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
          
          // Get FID (First Input Delay) - requires user interaction
          // We'll measure TBT (Total Blocking Time) as proxy
          const navigation = performance.getEntriesByType('navigation')[0];
          const ttfb = navigation ? navigation.responseStart - navigation.requestStart : null;
          const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null;
          
          setTimeout(() => {
            clsObserver.disconnect();
            resolve({
              lcp: lcp ? Math.round(lcp) : null,
              cls: Math.round(cls * 1000) / 1000,
              fid: null, // Needs real user interaction
              fcp: fcp ? Math.round(fcp) : null,
              ttfb: ttfb ? Math.round(ttfb) : null
            });
          }, 1000);
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      
      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
        const navigation = performance.getEntriesByType('navigation')[0];
        const ttfb = navigation ? navigation.responseStart - navigation.requestStart : null;
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null;
        resolve({
          lcp: null,
          cls: 0,
          fid: null,
          fcp: fcp ? Math.round(fcp) : null,
          ttfb: ttfb ? Math.round(ttfb) : null
        });
      }, 10000);
    });
  });
  
  await browser.close();
  console.log(JSON.stringify(metrics));
})();
