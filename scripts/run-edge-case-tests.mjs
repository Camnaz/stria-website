/**
 * Edge Case Monitoring Test Runner
 * Runs viewport tests + accessibility checks on TraceV2
 * Usage: node scripts/run-edge-case-tests.cjs
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { 
      cwd: PROJECT_ROOT, 
      stdio: 'pipe',
      ...options 
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => stdout += data.toString());
    child.stderr?.on('data', (data) => stderr += data.toString());
    
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}\n${stderr}`));
    });
    
    child.on('error', (err) => reject(err));
  });
}

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server not ready at ${url} after ${timeout}ms`);
}

async function main() {
  console.log('🚀 Starting TraceV2 Edge Case Monitoring\n');
  console.log('='.repeat(60));
  
  let previewProcess = null;
  
  try {
    // 1. Build the project
    console.log('\n📦 Building project...');
    await runCommand('npm', ['run', 'build']);
    console.log('✅ Build complete');
    
    // 2. Start preview server
    console.log('\n🌐 Starting preview server on port 4173...');
    previewProcess = spawn('npx', ['vite', 'preview', '--host', '0.0.0.0', '--port', '4173'], {
      cwd: PROJECT_ROOT,
      stdio: 'ignore',
      detached: true
    });
    previewProcess.unref();
    
    // 3. Wait for server
    await waitForServer('http://localhost:4173');
    console.log('✅ Preview server ready');
    
    // 4. Run viewport tests (update BASE_URL to preview)
    console.log('\n📱 Running viewport tests (7 viewports)...');
    const viewportScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const viewports = [
    { width: 375, height: 667, name: 'mobile-375' },
    { width: 480, height: 800, name: 'mobile-480' },
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 1024, height: 768, name: 'tablet-1024' },
    { width: 1280, height: 800, name: 'desktop-1280' },
    { width: 1440, height: 900, name: 'desktop-1440' },
    { width: 1920, height: 1080, name: 'desktop-1920' },
  ];
  
  const results = [];
  
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    
    // Full page screenshot
    await page.screenshot({ path: \`viewport-\${vp.name}.png\`, fullPage: true });
    
    // Check for horizontal overflow
    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    console.log(\`\${vp.name} (\${vp.width}px): overflow=\${overflow}, bodyWidth=\${bodyWidth}\`);
    
    // Check footer specifically
    const footer = await page.$('footer, [class*="footer"]');
    if (footer) {
      const footerBox = await footer.boundingBox();
      console.log(\`  Footer: width=\${footerBox?.width}, x=\${footerBox?.x}\`);
    }
    
    // Check hero text max-width
    const hero = await page.$('[class*="hero"] h1, [class*="hero"] p');
    if (hero) {
      const heroBox = await hero.boundingBox();
      console.log(\`  Hero text: width=\${heroBox?.width}, rightEdge=\${(heroBox?.x || 0) + (heroBox?.width || 0)}\`);
    }
    
    results.push({ viewport: vp.name, width: vp.width, overflow, bodyWidth });
  }
  
  await browser.close();
  
  // Summary
  const critical = results.filter(r => r.overflow);
  if (critical.length > 0) {
    console.log('\\n❌ CRITICAL: Horizontal overflow detected in:', critical.map(c => c.viewport).join(', '));
    process.exit(1);
  } else {
    console.log('\\n✅ No horizontal overflow in any viewport');
  }
})();
`;
    await runCommand('node', ['-e', viewportScript]);
    console.log('✅ Viewport tests passed');
    
    // 5. Run edge case audit
    console.log('\n🔍 Running edge case audit (10 pages × 10 viewports)...');
    const fs = await import('fs');
    let auditScript = fs.readFileSync(resolve(PROJECT_ROOT, 'edge-case-audit.cjs'), 'utf-8');
    auditScript = auditScript.replace(
      'http://localhost:5176',
      'http://localhost:4173'
    );
    // Write temp file
    const tempAuditPath = resolve(PROJECT_ROOT, 'edge-case-audit-temp.cjs');
    fs.writeFileSync(tempAuditPath, auditScript);
    await runCommand('node', [tempAuditPath]);
    fs.unlinkSync(tempAuditPath);
    console.log('✅ Edge case audit complete');
    
    // 6. Run Lighthouse accessibility audit
    console.log('\n♿ Running Lighthouse accessibility audit...');
    const lighthouseScript = `
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

async function runLighthouse() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['accessibility', 'performance', 'best-practices', 'seo'],
    port: chrome.port,
  };
  
  const runnerResult = await lighthouse('http://localhost:4173/', options);
  
  const scores = {
    accessibility: runnerResult.lhr.categories.accessibility.score * 100,
    performance: runnerResult.lhr.categories.performance.score * 100,
    bestPractices: runnerResult.lhr.categories['best-practices'].score * 100,
    seo: runnerResult.lhr.categories.seo.score * 100,
  };
  
  console.log('Lighthouse Scores:', JSON.stringify(scores, null, 2));
  
  // Budget assertions from lighthouse-budget.json
  const budgets = {
    accessibility: 95,
    performance: 90,
    bestPractices: 90,
    seo: 90
  };
  
  const failures = [];
  for (const [category, minScore] of Object.entries(budgets)) {
    if (scores[category] < minScore) {
      failures.push(\`\${category}: \${scores[category]} < \${minScore}\`);
    }
  }
  
  await chrome.kill();
  
  if (failures.length > 0) {
    console.log('❌ LIGHTHOUSE BUDGET VIOLATIONS:', failures.join(', '));
    process.exit(1);
  } else {
    console.log('✅ All Lighthouse budgets met');
  }
}

runLighthouse().catch(err => {
  console.error('Lighthouse error:', err);
  process.exit(1);
});
`;
    await runCommand('node', ['-e', lighthouseScript]);
    console.log('✅ Lighthouse audit passed');
    
    // 7. Run axe-core accessibility checks
    console.log('\n🪓 Running axe-core WCAG accessibility checks...');
    const axeScript = `
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const pages = [
    { path: '/', name: 'home' },
    { path: '/trace', name: 'trace' },
    { path: '/forge', name: 'forge' },
    { path: '/platform', name: 'platform' },
    { path: '/architecture', name: 'architecture' },
    { path: '/trace/documentation', name: 'docs' },
    { path: '/demo', name: 'demo' },
  ];
  
  let totalViolations = 0;
  const criticalViolations = [];
  
  for (const p of pages) {
    await page.goto('http://localhost:4173' + p.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();
    
    const violations = results.violations;
    totalViolations += violations.length;
    
    if (violations.length > 0) {
      console.log('\n' + p.name + ': ' + violations.length + ' violations');
      for (const v of violations) {
        if (v.impact === 'critical' || v.impact === 'serious') {
          criticalViolations.push({
            page: p.name,
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length
          });
          console.log('  ' + v.impact.toUpperCase() + ': ' + v.id + ' - ' + v.description + ' (' + v.nodes.length + ' nodes)');
        }
      }
    } else {
      console.log(p.name + ': ✅ No violations');
    }
  }
  
  await browser.close();
  
  console.log('\n📊 Total violations: ' + totalViolations);
  console.log('📊 Critical/Serious: ' + criticalViolations.length);
  
  if (criticalViolations.length > 0) {
    console.log('\n❌ CRITICAL/SERIOUS ACCESSIBILITY VIOLATIONS FOUND');
    process.exit(1);
  } else {
    console.log('\n✅ No critical/serious accessibility violations');
  }
})();
`;
    await runCommand('node', ['-e', axeScript]);
    console.log('✅ axe-core checks passed');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED - TraceV2 Edge Case Monitoring Complete');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ TEST FAILURE:', error.message);
    process.exitCode = 1;
  } finally {
    // Cleanup preview server
    if (previewProcess && previewProcess.pid) {
      try {
        process.kill(previewProcess.pid);
      } catch {}
    }
  }
}

main();
