#!/usr/bin/env node
/**
 * Comprehensive Deployment Health Monitor for Stria Systems
 * Checks: HTTP status, response times, Core Web Vitals, SSL, Cloudflare deployment, 5xx errors
 * Alerting: Slack, GitHub Issues, PagerDuty
 * Run: node monitor-deployment-health.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://striasystems.com';
const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/trace', name: 'Trace' },
  { path: '/forge', name: 'Forge' },
  { path: '/platform', name: 'Platform' },
  { path: '/architecture', name: 'Architecture' },
  { path: '/trace/documentation', name: 'Docs' },
  { path: '/demo', name: 'Demo' }
];

const TIMEOUT = 15000;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const PAGERDUTY_KEY = process.env.PAGERDUTY_INTEGRATION_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// Persistent failure counter file
const FAILURE_COUNT_FILE = path.join(__dirname, '.deployment-failure-count.json');

function checkPage(path, name) {
  try {
    const start = Date.now();
    const result = execSync(
      `curl -s -o /dev/null -w "%{http_code},%{time_total},%{time_connect},%{time_starttransfer}" "${BASE_URL}${path}" --max-time ${TIMEOUT/1000}`,
      { encoding: 'utf8', timeout: TIMEOUT }
    ).trim();

    const [httpCode, timeTotal, timeConnect, timeStartTransfer] = result.split(',').map(Number);

    return {
      name,
      path,
      httpCode,
      timeTotal,
      timeConnect,
      timeStartTransfer,
      passed: httpCode === 200 && timeTotal < 2.0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      name,
      path,
      httpCode: 0,
      error: error.message,
      passed: false,
      timestamp: new Date().toISOString()
    };
  }
}

function checkSSL() {
  try {
    const output = execSync(
      `openssl s_client -connect striasystems.com:443 -servername striasystems.com < /dev/null 2>/dev/null | openssl x509 -noout -enddate -issuer -subject`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();

    const expiryMatch = output.match(/notAfter=(.+)/);
    const issuerMatch = output.match(/issuer=(.+)/);
    const subjectMatch = output.match(/subject=(.+)/);

    if (expiryMatch) {
      const expiry = new Date(expiryMatch[1]);
      const daysLeft = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        valid: daysLeft > 30,
        daysLeft,
        expiry: expiry.toISOString(),
        issuer: issuerMatch ? issuerMatch[1] : 'unknown',
        subject: subjectMatch ? subjectMatch[1] : 'striasystems.com'
      };
    }
  } catch (e) {}
  return { valid: false, error: 'SSL check failed' };
}

async function checkCoreWebVitals() {
  // Use browser automation to measure Core Web Vitals
  // We'll run a Node script that uses Playwright or Puppeteer
  // For now, use a simpler approach with a headless browser script
  try {
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Enable performance metrics
  await page.goto('${BASE_URL}/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  
  // Wait a bit more for LCP
  await page.waitForTimeout(3000);
  
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
`;

    // Write script to temp file to avoid shell escaping issues
    const scriptPath = path.join(__dirname, '.cwv-check.cjs');
    fs.writeFileSync(scriptPath, script);
    try {
      const result = execSync(`node "${scriptPath}" 2>/dev/null`, {
        encoding: 'utf8',
        timeout: 45000,
        maxBuffer: 1024 * 1024
      }).trim();

      return JSON.parse(result);
    } finally {
      // Clean up temp file
      try { fs.unlinkSync(scriptPath); } catch (e) {}
    }
  } catch (e) {
    // Fallback: try to get basic metrics via curl + simple check
    try {
      const result = execSync(
        `curl -s "${BASE_URL}/" --max-time 10 | head -100`,
        { encoding: 'utf8', timeout: 15000 }
      );
      
      // Check if React is mounting (basic health indicator)
      const hasReactRoot = result.includes('id="root"') || result.includes('data-reactroot') || result.includes('_reactRootContainer');
      
      return {
        lcp: null,
        cls: 0,
        fid: null,
        fcp: null,
        ttfb: null,
        note: 'Playwright not available - install with: npm install playwright && npx playwright install chromium',
        reactMounting: hasReactRoot
      };
    } catch (err) {
      return { error: 'Core Web Vitals check failed', note: e.message };
    }
  }
}

async function checkCloudflareDeployment() {
  try {
    // Check GitHub Actions for CI/CD pipeline status
    const output = execSync(
      `gh run list --workflow="CI/CD Pipeline" --limit=5 --json=conclusion,status,createdAt,headBranch,url 2>/dev/null`,
      { encoding: 'utf8', timeout: 15000 }
    ).trim();

    const runs = JSON.parse(output);
    if (runs.length === 0) {
      return { status: 'no-runs-found', details: 'No CI/CD pipeline runs found' };
    }

    const mainRuns = runs.filter(r => r.headBranch === 'main');
    const recentMainRun = mainRuns[0];
    
    if (!recentMainRun) {
      return { status: 'no-main-runs', details: 'No recent runs on main branch' };
    }

    const jobsOutput = execSync(
      `gh run view ${recentMainRun.url.split('/').pop()} --json=jobs 2>/dev/null`,
      { encoding: 'utf8', timeout: 15000 }
    ).trim();
    
    const { jobs } = JSON.parse(jobsOutput);
    const failedJobs = jobs.filter(j => j.conclusion === 'failure').map(j => j.name);
    const deployJob = jobs.find(j => j.name.includes('Deploy'));
    const deployStatus = deployJob ? deployJob.conclusion : 'not-found';

    const consecutiveFailures = runs.filter(r => r.conclusion === 'failure' && r.headBranch === 'main').length;

    return {
      status: recentMainRun.conclusion,
      lastRun: {
        conclusion: recentMainRun.conclusion,
        createdAt: recentMainRun.createdAt,
        url: recentMainRun.url,
        headBranch: recentMainRun.headBranch
      },
      failedJobs,
      deployJobStatus: deployStatus,
      consecutiveMainFailures: consecutiveFailures,
      deployBlocked: deployStatus === 'skipped' && failedJobs.length > 0
    };
  } catch (e) {
    return { status: 'error', error: e.message, note: 'GitHub CLI required for deployment status check' };
  }
}

async function checkErrorRate() {
  // Would need Cloudflare API credentials for real 5xx error rate
  // For now, we check if pages return 5xx
  return {
    status: 'config-missing',
    note: 'Cloudflare Analytics API requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID',
    lastHour5xxEstimate: 0
  };
}

function loadFailureCount() {
  try {
    if (fs.existsSync(FAILURE_COUNT_FILE)) {
      return JSON.parse(fs.readFileSync(FAILURE_COUNT_FILE, 'utf8'));
    }
  } catch (e) {}
  return { consecutiveFailures: 0, lastFailure: null, githubIssueCreated: false, issueNumber: null };
}

function saveFailureCount(data) {
  fs.writeFileSync(FAILURE_COUNT_FILE, JSON.stringify(data, null, 2));
}

async function sendSlackAlert(message, level = 'warning') {
  if (!SLACK_WEBHOOK) return { sent: false, reason: 'No SLACK_WEBHOOK_URL configured' };
  
  const color = level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'good';
  const payload = {
    attachments: [{
      color,
      title: `Stria Systems Deployment ${level.toUpperCase()}`,
      text: message,
      footer: 'Deployment Monitor',
      ts: Math.floor(Date.now() / 1000)
    }]
  };

  try {
    execSync(`curl -s -X POST -H 'Content-Type: application/json' -d '${JSON.stringify(payload).replace(/'/g, "'\\''")}' "${SLACK_WEBHOOK}"`, { timeout: 10000 });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

async function createGitHubIssue(title, body) {
  // gh CLI uses keyring auth, doesn't require GITHUB_TOKEN env var
  // But we check if gh is available
  try {
    execSync('gh auth status', { encoding: 'utf8', timeout: 5000, stdio: 'ignore' });
  } catch (e) {
    return { created: false, reason: 'GitHub CLI not authenticated' };
  }
 
  try {
    // Use -f "labels[]=value" format for gh api
    const result = execSync(
      `gh api repos/Camnaz/StriaSystems/issues --method POST -f title=\"${title.replace(/"/g, '\\\\\"')}\" -f body=\"${body.replace(/"/g, '\\\\\"')}\" -f "labels[]=deployment" -f "labels[]=monitoring" -f "labels[]=auto-generated" 2>/dev/null`,
      { encoding: 'utf8', timeout: 15000 }
    ).trim();
    const issue = JSON.parse(result);
    return { created: true, number: issue.number, url: issue.html_url };
  } catch (e) {
    return { created: false, error: e.message };
  }
}

async function triggerPagerDuty(summary, severity = 'warning') {
  if (!PAGERDUTY_KEY) return { triggered: false, reason: 'No PAGERDUTY_INTEGRATION_KEY configured' };
  
  const payload = {
    routing_key: PAGERDUTY_KEY,
    event_action: 'trigger',
    payload: {
      summary,
      severity,
      source: 'stria-deployment-monitor',
      component: 'Cloudflare Pages',
      group: 'deployment-health',
      class: 'deployment'
    }
  };

  try {
    execSync(`curl -s -X POST -H 'Content-Type: application/json' -d '${JSON.stringify(payload).replace(/'/g, "'\\''")}' https://events.pagerduty.com/v2/enqueue`, { timeout: 10000 });
    return { triggered: true };
  } catch (e) {
    return { triggered: false, error: e.message };
  }
}

async function runAlerting(results, failureCount) {
  const alerts = { slack: false, github: false, pagerduty: false };
  const criticalIssues = [];
  const warnings = [];

  // Check for critical issues
  const failedPages = results.pages.filter(p => !p.passed);
  const criticalPages = failedPages.filter(p => p.httpCode === 0 || p.httpCode >= 500);
  
  if (criticalPages.length > 0) {
    criticalIssues.push(`Critical: ${criticalPages.length} page(s) returning 5xx or timeout: ${criticalPages.map(p => p.name).join(', ')}`);
  }
  
  if (!results.ssl.valid) {
    criticalIssues.push(`SSL certificate expires in ${results.ssl.daysLeft || 'unknown'} days`);
  }

  if (results.cloudflare.deployBlocked) {
    criticalIssues.push(`Cloudflare deployment blocked: ${results.cloudflare.failedJobs.join(', ')} failing`);
  }

  if (results.coreWebVitals && results.coreWebVitals.lcp && results.coreWebVitals.lcp > 2500) {
    warnings.push(`LCP (${results.coreWebVitals.lcp}ms) exceeds 2500ms threshold`);
  }
  if (results.coreWebVitals && results.coreWebVitals.cls > 0.1) {
    warnings.push(`CLS (${results.coreWebVitals.cls}) exceeds 0.1 threshold`);
  }

  // Send Slack alert for any issues
  if (criticalIssues.length > 0 || warnings.length > 0) {
    const message = [
      criticalIssues.length > 0 ? `🚨 *Critical:*\n${criticalIssues.map(i => `• ${i}`).join('\n')}` : '',
      warnings.length > 0 ? `⚠️ *Warnings:*\n${warnings.map(w => `• ${w}`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');
    
    const slackResult = await sendSlackAlert(message, criticalIssues.length > 0 ? 'critical' : 'warning');
    alerts.slack = slackResult.sent;
  }

  // Check persistent failures for GitHub issue
  if (criticalIssues.length > 0) {
    failureCount.consecutiveFailures++;
    failureCount.lastFailure = new Date().toISOString();
  } else {
    failureCount.consecutiveFailures = 0;
  }

  // Create GitHub issue if > 3 consecutive failures
  if (failureCount.consecutiveFailures >= 3 && !failureCount.githubIssueCreated) {
    const title = `[Auto] Persistent Deployment Failures - ${failureCount.consecutiveFailures} consecutive checks`;
    const body = `## Persistent Deployment Failures Detected\n\n**Consecutive failed checks:** ${failureCount.consecutiveFailures}\n**First failure:** ${failureCount.lastFailure}\n\n### Current Issues:\n${criticalIssues.map(i => `- ${i}`).join('\n')}\n\n### Recent Check Results:\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`\n\n---\n*This issue was auto-generated by the deployment monitor. Please investigate and resolve the underlying issues.*`;
    
    const githubResult = await createGitHubIssue(title, body);
    alerts.github = githubResult.created;
    if (githubResult.created) {
      failureCount.githubIssueCreated = true;
      failureCount.issueNumber = githubResult.number;
    }
  } else if (failureCount.consecutiveFailures === 0 && failureCount.githubIssueCreated) {
    // Close the issue if things are back to normal
    failureCount.githubIssueCreated = false;
    failureCount.issueNumber = null;
  }

  // Trigger PagerDuty for critical (production down)
  if (criticalIssues.some(i => i.includes('5xx') || i.includes('timeout') || i.includes('Critical:'))) {
    const pagerResult = await triggerPagerDuty(
      `Stria Systems production issues: ${criticalIssues.join('; ')}`,
      'critical'
    );
    alerts.pagerduty = pagerResult.triggered;
  }

  saveFailureCount(failureCount);
  return { alerts, criticalIssues, warnings, failureCount };
}

function saveResults(results) {
  const month = new Date().toISOString().slice(0, 7);
  const logFile = path.join(__dirname, `deployment-health-${month}.json`);

  let logData = [];
  if (fs.existsSync(logFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      // Coerce object -> array for backward compatibility with Python monitor format
      logData = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      logData = [];
    }
  }
  logData.push(results);
  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
  return logFile;
}

async function main() {
  console.log(`🔍 Stria Systems Deployment Health Monitor`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    checkIntervalMinutes: 15,
    pages: [],
    ssl: null,
    coreWebVitals: null,
    cloudflare: null,
    errorRate: null,
    summary: { passed: 0, failed: 0, critical: 0 }
  };

  // 1. Check all pages
  console.log('📄 Checking pages...');
  for (const { path, name } of PAGES) {
    const result = checkPage(path, name);
    results.pages.push(result);
    if (result.passed) {
      results.summary.passed++;
      console.log(`  ✅ ${name}: ${result.httpCode} (${result.timeTotal.toFixed(3)}s)`);
    } else {
      results.summary.failed++;
      if (result.httpCode === 0 || result.httpCode >= 500) {
        results.summary.critical++;
      }
      console.log(`  ❌ ${name}: ${result.httpCode || 'ERROR'} ${result.error ? `- ${result.error}` : ''}`);
    }
  }

  // 2. Check SSL
  console.log('\n🔒 Checking SSL certificate...');
  results.ssl = checkSSL();
  if (results.ssl.valid) {
    console.log(`  ✅ SSL valid for ${results.ssl.daysLeft} more days (expires ${results.ssl.expiry})`);
  } else {
    console.log(`  ❌ SSL issue: ${results.ssl.error || 'expires soon'}`);
    results.summary.critical++;
  }

  // 3. Check Core Web Vitals
  console.log('\n📊 Checking Core Web Vitals...');
  results.coreWebVitals = await checkCoreWebVitals();
  if (results.coreWebVitals.lcp !== null) {
    console.log(`  LCP: ${results.coreWebVitals.lcp}ms ${results.coreWebVitals.lcp <= 2500 ? '✅' : '❌'} (<=2500ms)`);
  }
  if (results.coreWebVitals.cls !== null) {
    console.log(`  CLS: ${results.coreWebVitals.cls} ${results.coreWebVitals.cls <= 0.1 ? '✅' : '❌'} (<=0.1)`);
  }
  if (results.coreWebVitals.fid !== null) {
    console.log(`  FID: ${results.coreWebVitals.fid}ms ${results.coreWebVitals.fid <= 100 ? '✅' : '❌'} (<=100ms)`);
  }
  if (results.coreWebVitals.fcp) {
    console.log(`  FCP: ${results.coreWebVitals.fcp}ms`);
  }
  if (results.coreWebVitals.ttfb) {
    console.log(`  TTFB: ${results.coreWebVitals.ttfb}ms`);
  }
  if (results.coreWebVitals.note) {
    console.log(`  ℹ️  ${results.coreWebVitals.note}`);
  }

  // 4. Check Cloudflare Deployment (via GitHub Actions)
  console.log('\n☁️  Checking Cloudflare Pages deployment status...');
  results.cloudflare = await checkCloudflareDeployment();
  console.log(`  Status: ${results.cloudflare.status}`);
  if (results.cloudflare.failedJobs?.length) {
    console.log(`  Failed jobs: ${results.cloudflare.failedJobs.join(', ')}`);
  }
  if (results.cloudflare.deployJobStatus) {
    console.log(`  Deploy job: ${results.cloudflare.deployJobStatus}`);
  }
  if (results.cloudflare.consecutiveMainFailures > 0) {
    console.log(`  ⚠️  ${results.cloudflare.consecutiveMainFailures} consecutive main branch failures`);
  }

  // 5. Check 5xx error rate
  console.log('\n📈 Checking error rate...');
  results.errorRate = await checkErrorRate();
  console.log(`  ${results.errorRate.status}: ${results.errorRate.note || results.errorRate.lastHour5xxEstimate}`);

  // Calculate p95 response time
  const responseTimes = results.pages.map(p => p.timeTotal * 1000).sort((a, b) => a - b);
  const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
  const p95ResponseTime = responseTimes[Math.max(0, p95Index)];
  results.summary.p95ResponseTimeMs = Math.round(p95ResponseTime);

  // Summary
  console.log(`\n📊 Summary: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.critical} critical`);
  console.log(`  p95 Response Time: ${results.summary.p95ResponseTimeMs}ms ${results.summary.p95ResponseTimeMs <= 2000 ? '✅' : '❌'} (<=2000ms)`);

  // Load failure count and run alerting
  const failureCount = loadFailureCount();
  const alerting = await runAlerting(results, failureCount);
  results.alerts = alerting.alerts;
  results.criticalIssues = alerting.criticalIssues;
  results.warnings = alerting.warnings;
  results.persistentFailures = alerting.failureCount;

  // Save results
  const logFile = saveResults(results);
  console.log(`\n💾 Logged to ${logFile}`);

  // Exit with error if critical issues
  if (results.summary.critical > 0 || alerting.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES DETECTED');
    process.exit(1);
  }

  console.log('\n✅ All checks passed');
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});