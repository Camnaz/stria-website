#!/usr/bin/env node
/**
 * Comprehensive Deployment Monitor - Stria Systems
 * Checks: HTTP, Response Time, Core Web Vitals, SSL, Cloudflare, 5xx errors
 * Alerts: Slack, GitHub Issues (persistent), PagerDuty (critical)
 * Run: node monitor-comprehensive.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'https://striasystems.com';
const DIST_INDEX_PATH = process.env.DIST_INDEX_PATH || `${process.cwd()}/dist/index.html`;
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
const HEALTH_DIR = process.cwd();
const MONTH_LOG_FILE = `deployment-health-${new Date().toISOString().slice(0, 7)}.json`;

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
      `openssl s_client -connect striasystems.com:443 -servername striasystems.com < /dev/null 2>/dev/null | openssl x509 -noout -enddate`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    const match = output.match(/notAfter=(.+)/);
    if (match) {
      const expiry = new Date(match[1]);
      const daysLeft = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
      return { valid: daysLeft > 30, daysLeft, expiry: expiry.toISOString() };
    }
  } catch (e) {}
  return { valid: false, error: 'SSL check failed' };
}

async function checkCloudflareDeployment() {
  // Try to get credentials from environment or gh CLI
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  let apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  if (!accountId || !apiToken) {
    try {
      const secrets = execSync('gh secret list --json name,updatedAt', { encoding: 'utf8', timeout: 5000 });
      const parsed = JSON.parse(secrets);
      const accSecret = parsed.find(s => s.name === 'CLOUDFLARE_ACCOUNT_ID');
      const tokenSecret = parsed.find(s => s.name === 'CLOUDFLARE_API_TOKEN');
      // Note: gh secret list doesn't expose values, only names. We'd need `gh secret get` but that requires repo admin.
      // For now, just note that secrets exist in GitHub but aren't in env
      if (accSecret && tokenSecret) {
        return { status: 'credentials-in-github-secrets', note: 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN env vars to enable API checks' };
      }
    } catch (e) {}
    return { status: 'config-missing', error: 'CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN not set in environment' };
  }

  try {
    const projectName = 'stria-systems';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=1`;
    
    const result = await httpGet(url, { 'Authorization': `Bearer ${apiToken}` });
    const data = JSON.parse(result);
    
    if (data.success && data.result.length > 0) {
      const latest = data.result[0];
      return {
        status: latest.status,
        environment: latest.environment,
        url: latest.url,
        createdOn: latest.created_on,
        commitHash: latest.deployment_trigger?.metadata?.commit_hash?.slice(0, 7)
      };
    }
    return { status: 'no-deployments', error: 'No deployments found' };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
  });
}

async function checkCoreWebVitals() {
  // Use Lighthouse CI to measure Core Web Vitals
  try {
    const lighthouse = require('lighthouse').default;
    const chromeLauncher = require('chrome-launcher');
    
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] });
    const port = chrome.port;
    
    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance'],
      port: port,
    };
    
    const runnerResult = await lighthouse(BASE_URL, options);
    await chrome.kill();
    
    const lhr = runnerResult.lhr;
    const lcpRaw = lhr.audits['largest-contentful-paint']?.numericValue;
    const cls = lhr.audits['cumulative-layout-shift']?.numericValue;
    const fid = lhr.audits['max-potential-fid']?.numericValue;
    const inp = lhr.audits['interaction-to-next-paint']?.numericValue;
    
    // Use FID or INP (INP is the newer metric replacing FID)
    const fidProxy = fid || inp;
    const lcp = lcpRaw ? lcpRaw / 1000 : null; // Convert to seconds
    
    // Check for NO_FCP / NO_LCP errors
    const lcpAudit = lhr.audits['largest-contentful-paint'];
    const hasLCPError = lcpAudit?.details?.type === 'opportunity' && lcpAudit?.errorMessage?.includes('NO_LCP');
    const hasFCPError = lhr.audits['first-contentful-paint']?.errorMessage?.includes('NO_FCP');
    
    return {
      lcp: lcp ? lcp.toFixed(2) : (hasLCPError || hasFCPError ? 'NO_FCP' : 'N/A'),
      cls: cls !== undefined ? cls.toFixed(3) : 'N/A',
      fid: fidProxy ? fidProxy.toFixed(0) : 'N/A',
      status: (lcp && lcp <= 2.5 && cls !== undefined && cls <= 0.1 && fidProxy && fidProxy <= 100) ? 'PASSED' : 'FAILED',
      lcpPassed: lcp && lcp <= 2.5,
      clsPassed: cls !== undefined && cls <= 0.1,
      fidPassed: fidProxy && fidProxy <= 100,
      rawScore: lhr.categories.performance?.score * 100 || 0,
      hasLCPError,
      hasFCPError,
      error: hasLCPError || hasFCPError ? 'No First Contentful Paint — React app not mounting' : undefined
    };
  } catch (e) {
    return { 
      lcp: 'ERROR', cls: 'ERROR', fid: 'ERROR', status: 'FAILED', 
      error: `Lighthouse failed: ${e.message}` 
    };
  }
}

async function check5xxErrors() {
  // Check Cloudflare Analytics for 5xx errors in last hour
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  let apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  if (!accountId || !apiToken) {
    return { status: 'config-missing', error: 'Cloudflare credentials not available', errorCount: 0 };
  }

  try {
    const since = new Date(Date.now() - 3600000).toISOString();
    const until = new Date().toISOString();
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics/loki?query=sum%20by%20(ray_name)%20(rate(%7Bjob%3D%22cloudflare_pages%22%7D%5Blogs%5D%7Bstatus_code%3D~%225..%22%7D[%5B1h%5D]))&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&limit=100`;
    
    const result = await httpGet(url, { 'Authorization': `Bearer ${apiToken}` });
    const data = JSON.parse(result);
    
    if (data.success && data.result?.data?.result?.length > 0) {
      const errorCount = data.result.data.result.reduce((sum, r) => sum + parseFloat(r.value[1]), 0);
      return { status: 'errors-found', errorCount: Math.round(errorCount), timeframe: '1h' };
    }
    return { status: 'no-errors', errorCount: 0, timeframe: '1h' };
  } catch (e) {
    return { status: 'error', error: e.message, errorCount: 0 };
  }
}

async function checkBuildArtifactMismatch() {
  try {
    // Fetch live page HTML
    const liveHtml = await httpGet(BASE_URL);
    
    // Extract live asset URLs
    const liveJsAssets = [...liveHtml.matchAll(/<script[^>]*src=["']([^"']+\.js)["']/g)].map(m => m[1]);
    const liveModulePreloadAssets = [...liveHtml.matchAll(/<link[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+\.js)["']/g)].map(m => m[1]);
    const liveCssAssets = [...liveHtml.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["']/g)].map(m => m[1]);
    
    const liveJsCount = liveJsAssets.length + liveModulePreloadAssets.length;
    const liveCssCount = liveCssAssets.length;
    
    // Read dist/index.html
    if (!fs.existsSync(DIST_INDEX_PATH)) {
      return { 
        status: 'dist-missing', 
        error: `dist/index.html not found at ${DIST_INDEX_PATH}`,
        mismatched: true 
      };
    }
    
    const distHtml = fs.readFileSync(DIST_INDEX_PATH, 'utf8');
    
    // Extract expected asset URLs from dist
    const distJsAssets = [...distHtml.matchAll(/<script[^>]*src=["']([^"']+\.js)["']/g)].map(m => m[1]);
    const distCssAssets = [...distHtml.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["']/g)].map(m => m[1]);
    
    const distJsCount = distJsAssets.length;
    const distCssCount = distCssAssets.length;
    
    // Compare counts and naming patterns
    const jsCountMismatch = distJsCount !== liveJsCount;
    const cssCountMismatch = distCssCount !== liveCssCount;
    const hasCountMismatch = jsCountMismatch || cssCountMismatch;
    
    // Detect naming pattern: single bundle (index-*.js) vs split bundles (js/main-*.js, vendor-*.js, etc.)
    const distIsSingleBundle = distJsCount === 1 && distJsAssets[0]?.includes('index-');
    const liveIsSplitBundle = liveJsCount > 1 || liveModulePreloadAssets.length > 0;
    const bundlePatternMismatch = distIsSingleBundle && liveIsSplitBundle;
    
    // Extract hashes for detailed comparison
    const getHash = (url) => {
      const match = url.match(/[-_]([a-zA-Z0-9]{8,})\.(js|css)$/);
      return match ? match[1] : null;
    };
    
    const distJsHashes = distJsAssets.map(getHash).filter(Boolean);
    const liveJsHashes = [...liveJsAssets, ...liveModulePreloadAssets].map(getHash).filter(Boolean);
    const distCssHashes = distCssAssets.map(getHash).filter(Boolean);
    const liveCssHashes = liveCssAssets.map(getHash).filter(Boolean);
    
    // Check if any hashes match (indicates same build)
    const jsHashOverlap = distJsHashes.some(h => liveJsHashes.includes(h));
    const cssHashOverlap = distCssHashes.some(h => liveCssHashes.includes(h));
    const hasAnyHashOverlap = jsHashOverlap || cssHashOverlap;
    
    const mismatched = hasCountMismatch || bundlePatternMismatch || !hasAnyHashOverlap;
    
    return {
      status: mismatched ? 'mismatch' : 'match',
      mismatched,
      dist: {
        jsCount: distJsCount,
        cssCount: distCssCount,
        jsAssets: distJsAssets,
        cssAssets: distCssAssets,
        jsHashes: distJsHashes,
        cssHashes: distCssHashes,
        isSingleBundle: distIsSingleBundle
      },
      live: {
        jsCount: liveJsCount,
        cssCount: liveCssCount,
        jsAssets: liveJsAssets,
        modulePreloadAssets: liveModulePreloadAssets,
        cssAssets: liveCssAssets,
        jsHashes: liveJsHashes,
        cssHashes: liveCssHashes,
        isSplitBundle: liveIsSplitBundle
      },
      details: {
        jsCountMismatch,
        cssCountMismatch,
        bundlePatternMismatch,
        hasAnyHashOverlap,
        jsHashOverlap,
        cssHashOverlap
      }
    };
  } catch (e) {
    return { 
      status: 'error', 
      error: e.message, 
      mismatched: true 
    };
  }
}

function loadHistory() {
  const path = `${HEALTH_DIR}/${MONTH_LOG_FILE}`;
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  }
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(`${HEALTH_DIR}/${MONTH_LOG_FILE}`, JSON.stringify(history, null, 2));
}

function checkPersistentFailures(history, currentResult) {
  // Check for > 3 consecutive failures of the same type
  if (currentResult.summary.failed === 0) return { persistent: false };
  
  let consecutiveFailures = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    // Handle older history entries that might not have pages array
    if (!entry.pages || !Array.isArray(entry.pages)) {
      // For backward compatibility, check summary.failed
      if (entry.summary && entry.summary.failed > 0) {
        consecutiveFailures++;
      } else if (entry.summary && entry.summary.failed === 0) {
        break;
      }
      continue;
    }
    const sameTypeFailure = entry.pages.some(p => !p.passed && currentResult.pages.find(cp => cp.path === p.path && !cp.passed));
    if (sameTypeFailure) {
      consecutiveFailures++;
    } else if (entry.summary && entry.summary.failed === 0) {
      break;
    }
  }
  
  return { persistent: consecutiveFailures >= 3, count: consecutiveFailures };
}

async function sendSlackAlert(message, isCritical = false) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return { sent: false, error: 'SLACK_WEBHOOK_URL not configured' };
  
  try {
    const payload = JSON.stringify({
      text: message,
      username: 'Deployment Monitor',
      icon_emoji: isCritical ? ':fire:' : ':warning:',
      attachments: [{
        color: isCritical ? 'danger' : 'warning',
        ts: Math.floor(Date.now() / 1000)
      }]
    });
    
    await new Promise((resolve, reject) => {
      const req = https.request(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
      }, resolve);
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

async function createGitHubIssue(title, body) {
  try {
    const { execSync } = require('child_process');
    execSync(`gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "deployment,monitoring,automated"`, { encoding: 'utf8' });
    return { created: true };
  } catch (e) {
    return { created: false, error: e.message };
  }
}

async function triggerPagerDuty(summary, severity = 'critical') {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY || process.env.PAGERDUTY_INTEGRATION_KEY;
  if (!routingKey) return { triggered: false, error: 'PagerDuty key not configured' };
  
  try {
    const payload = JSON.stringify({
      routing_key: routingKey,
      event_action: 'trigger',
      payload: {
        summary,
        severity,
        source: 'stria-deployment-monitor',
        component: 'striasystems.com',
        group: 'deployment',
        class: 'availability',
        custom_details: { timestamp: new Date().toISOString() }
      }
    });
    
    await new Promise((resolve, reject) => {
      const req = https.request('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
      }, resolve);
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    return { triggered: true };
  } catch (e) {
    return { triggered: false, error: e.message };
  }
}

async function main() {
  console.log(`🔍 Comprehensive Deployment Monitor - ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    pages: [],
    ssl: null,
    cloudflare: null,
    coreWebVitals: null,
    errors5xx: null,
    buildArtifactMismatch: null,
    summary: { passed: 0, failed: 0, critical: 0 },
    alerts: { slack: false, github: false, pagerduty: false }
  };

  // Check all pages
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

  // Check SSL
  console.log('\n🔒 Checking SSL...');
  results.ssl = checkSSL();
  if (results.ssl.valid) {
    console.log(`  ✅ SSL valid for ${results.ssl.daysLeft} more days`);
  } else {
    console.log(`  ❌ SSL issue: ${results.ssl.error || 'expires soon'}`);
    results.summary.critical++;
  }

  // Check Cloudflare deployment
  console.log('\n☁️  Checking Cloudflare deployment...');
  results.cloudflare = await checkCloudflareDeployment();
  console.log(`  ℹ️  Status: ${results.cloudflare.status}`);
  if (results.cloudflare.status === 'error') {
    results.summary.failed++;
  } else if (results.cloudflare.status === 'config-missing' || results.cloudflare.status === 'credentials-in-github-secrets') {
    console.log(`  ⚠️  ${results.cloudflare.status}: ${results.cloudflare.error || results.cloudflare.note}`);
  } else if (results.cloudflare.status !== 'active' && results.cloudflare.status !== 'success') {
    results.summary.failed++;
  }

  // Check Core Web Vitals
  console.log('\n📊 Checking Core Web Vitals (Lighthouse)...');
  results.coreWebVitals = await checkCoreWebVitals();
  console.log(`  LCP: ${results.coreWebVitals.lcp}s (target: <2.5s) ${results.coreWebVitals.lcpPassed ? '✅' : '❌'}`);
  console.log(`  CLS: ${results.coreWebVitals.cls} (target: <0.1) ${results.coreWebVitals.clsPassed ? '✅' : '❌'}`);
  console.log(`  FID/INP: ${results.coreWebVitals.fid}ms (target: <100ms) ${results.coreWebVitals.fidPassed ? '✅' : '❌'}`);
  console.log(`  Status: ${results.coreWebVitals.status} | Performance Score: ${results.coreWebVitals.rawScore}`);
  if (results.coreWebVitals.status === 'FAILED') {
    results.summary.failed++;
    if (results.coreWebVitals.rawScore === 0) results.summary.critical++;
  }

  // Check 5xx errors
  console.log('\n📈 Checking 5xx errors (last hour)...');
  results.errors5xx = await check5xxErrors();
  console.log(`  Status: ${results.errors5xx.status} | Errors: ${results.errors5xx.errorCount || 0}`);
  if (results.errors5xx.status === 'errors-found' && results.errors5xx.errorCount > 0) {
    results.summary.failed++;
    if (results.errors5xx.errorCount > 10) results.summary.critical++;
  } else if (results.errors5xx.status === 'error') {
    results.summary.failed++;
  } else if (results.errors5xx.status === 'config-missing') {
    console.log(`  ⚠️  ${results.errors5xx.status}: ${results.errors5xx.error}`);
  }

  // Check Build Artifact Mismatch
  console.log('\n🔧 Checking build artifact mismatch...');
  results.buildArtifactMismatch = await checkBuildArtifactMismatch();
  if (results.buildArtifactMismatch.mismatched) {
    results.summary.failed++;
    results.summary.critical++; // This is a critical deployment integrity issue
    console.log(`  ❌ BUILD ARTIFACT MISMATCH DETECTED`);
    console.log(`     Dist: ${results.buildArtifactMismatch.dist.jsCount} JS, ${results.buildArtifactMismatch.dist.cssCount} CSS (${results.buildArtifactMismatch.dist.isSingleBundle ? 'single bundle' : 'split bundles'})`);
    console.log(`     Live: ${results.buildArtifactMismatch.live.jsCount} JS, ${results.buildArtifactMismatch.live.cssCount} CSS (${results.buildArtifactMismatch.live.isSplitBundle ? 'split bundles' : 'single bundle'})`);
    console.log(`     JS Hash Overlap: ${results.buildArtifactMismatch.details.jsHashOverlap ? 'YES' : 'NO'}`);
    console.log(`     CSS Hash Overlap: ${results.buildArtifactMismatch.details.cssHashOverlap ? 'YES' : 'NO'}`);
    if (results.buildArtifactMismatch.details.bundlePatternMismatch) {
      console.log(`     ⚠️  Pattern mismatch: dist has single bundle, live has split bundles (manual deploy?)`);
    }
  } else if (results.buildArtifactMismatch.status === 'dist-missing') {
    console.log(`  ⚠️  Dist file missing: ${results.buildArtifactMismatch.error}`);
  } else if (results.buildArtifactMismatch.status === 'error') {
    console.log(`  ❌ Check error: ${results.buildArtifactMismatch.error}`);
    results.summary.failed++;
  } else {
    console.log(`  ✅ Build artifacts match`);
    console.log(`     Dist: ${results.buildArtifactMismatch.dist.jsCount} JS, ${results.buildArtifactMismatch.dist.cssCount} CSS`);
    console.log(`     Live: ${results.buildArtifactMismatch.live.jsCount} JS, ${results.buildArtifactMismatch.live.cssCount} CSS`);
  }

  // Load history and check for persistent failures
  const history = loadHistory();
  const persistent = checkPersistentFailures(history, results);
  
  // Save current results to history
  history.push(results);
  saveHistory(history);

  // Summary
  console.log(`\n📊 Summary: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.critical} critical`);
  console.log(`💾 Logged to ${MONTH_LOG_FILE}`);

  // Alerting
  const hasFailure = results.summary.failed > 0 || results.summary.critical > 0;
  const isCritical = results.summary.critical > 0;

  if (hasFailure) {
    const mismatch = results.buildArtifactMismatch;
    const mismatchInfo = mismatch?.mismatched ? 
      `\n*Build Artifact Mismatch:* YES (Dist: ${mismatch.dist.jsCount}JS/${mismatch.dist.cssCount}CSS, Live: ${mismatch.live.jsCount}JS/${mismatch.live.cssCount}CSS, HashOverlap: ${mismatch.details.hasAnyHashOverlap ? 'YES' : 'NO'}${mismatch.details.bundlePatternMismatch ? ', Pattern: single→split' : ''})` :
      mismatch?.status === 'match' ? '\n*Build Artifact Mismatch:* No (matched)' : '';
    
    const message = `*Stria Systems Deployment Alert*\n` +
      `*Status:* ${isCritical ? '🚨 CRITICAL' : '⚠️ FAILURE'}\n` +
      `*Time:* ${new Date().toISOString()}\n` +
      `*Failed Checks:* ${results.summary.failed} | *Critical:* ${results.summary.critical}\n` +
      `*URL:* ${BASE_URL}\n` +
      `*Pages Failed:* ${results.pages.filter(p => !p.passed).map(p => p.name).join(', ') || 'None'}\n` +
      `*Core Web Vitals:* ${results.coreWebVitals?.status || 'N/A'}\n` +
      `*5xx Errors (1h):* ${results.errors5xx?.errorCount || 0}\n` +
      `*Persistent Failures:* ${persistent.persistent ? `YES (${persistent.count} consecutive)` : 'No'}` +
      `${mismatchInfo}`;

    // Slack notification
    console.log('\n📢 Sending Slack alert...');
    const slackResult = await sendSlackAlert(message, isCritical);
    results.alerts.slack = slackResult.sent;
    console.log(slackResult.sent ? '  ✅ Slack alert sent' : `  ❌ Slack failed: ${slackResult.error}`);

    // GitHub issue for persistent failures OR build artifact mismatch
    if (persistent.persistent || mismatch?.mismatched) {
      console.log('\n📝 Creating GitHub issue for persistent failure...');
      const ghResult = await createGitHubIssue(
        mismatch?.mismatched 
          ? `[Build Mismatch] Stria Systems deployment artifact mismatch detected`
          : `[Persistent] Stria Systems deployment failures (${persistent.count} consecutive)`,
        `**Deployment monitor detected issue**\n\n` +
        `**Timestamp:** ${new Date().toISOString()}\n` +
        `**URL:** ${BASE_URL}\n` +
        `**Failed Pages:** ${results.pages.filter(p => !p.passed).map(p => `${p.name} (${p.path})`).join(', ') || 'None'}\n` +
        `**Core Web Vitals:** ${JSON.stringify(results.coreWebVitals, null, 2)}\n` +
        `**5xx Errors (1h):** ${results.errors5xx?.errorCount || 0}\n` +
        `**SSL:** ${results.ssl.daysLeft} days left\n` +
        `**Cloudflare Status:** ${results.cloudflare.status}\n` +
        (mismatch?.mismatched ? 
          `**Build Artifact Mismatch:** YES\n` +
          `**Dist Assets:** ${mismatch.dist.jsCount} JS (${mismatch.dist.jsAssets.join(', ')}), ${mismatch.dist.cssCount} CSS (${mismatch.dist.cssAssets.join(', ')})\n` +
          `**Live Assets:** ${mismatch.live.jsCount} JS (${[...mismatch.live.jsAssets, ...mismatch.live.modulePreloadAssets].join(', ')}), ${mismatch.live.cssCount} CSS (${mismatch.live.cssAssets.join(', ')})\n` +
          `**JS Hash Overlap:** ${mismatch.details.jsHashOverlap ? 'YES' : 'NO'}\n` +
          `**CSS Hash Overlap:** ${mismatch.details.cssHashOverlap ? 'YES' : 'NO'}\n` +
          `**Pattern Mismatch:** ${mismatch.details.bundlePatternMismatch ? 'YES (single→split, possible manual deploy)' : 'NO'}\n` :
          `**Persistent Failures:** ${persistent.count} consecutive\n`
        ) +
        `---\n*Auto-generated by deployment monitor*`
      );
      results.alerts.github = ghResult.created;
      console.log(ghResult.created ? '  ✅ GitHub issue created' : `  ❌ GitHub issue failed: ${ghResult.error}`);
    }

    // PagerDuty for critical
    if (isCritical) {
      console.log('\n🚨 Triggering PagerDuty...');
      const pdResult = await triggerPagerDuty(
        `Stria Systems deployment CRITICAL: ${results.summary.critical} critical issues`,
        'critical'
      );
      results.alerts.pagerduty = pdResult.triggered;
      console.log(pdResult.triggered ? '  ✅ PagerDuty triggered' : `  ❌ PagerDuty failed: ${pdResult.error}`);
    }
  } else {
    console.log('\n✅ All checks passed - no alerts needed');
  }

  console.log('\n✅ Monitoring complete');
  
  // Exit with error code if critical issues
  if (results.summary.critical > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});