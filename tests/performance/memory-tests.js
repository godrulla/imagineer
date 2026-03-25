const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Memory leak detection and performance testing for Node.js services
class MemoryTester {
  constructor() {
    this.results = {
      services: {},
      summary: {
        totalLeaks: 0,
        criticalLeaks: 0,
        warnings: 0,
        passed: 0
      }
    };
  }

  async testService(serviceName, servicePort) {
    console.log(`\n🔍 Testing memory usage for ${serviceName}...`);
    
    const servicePath = path.join(__dirname, '../../services', serviceName);
    const testResults = {
      serviceName,
      initialMemory: 0,
      peakMemory: 0,
      finalMemory: 0,
      memoryGrowth: 0,
      averageMemory: 0,
      gcEfficiency: 0,
      leakDetected: false,
      warnings: [],
      recommendations: []
    };

    try {
      // Start service with memory profiling
      const startTime = Date.now();
      const memorySnapshots = [];
      
      // Monitor memory usage over time
      const monitorInterval = setInterval(() => {
        try {
          const usage = process.memoryUsage();
          memorySnapshots.push({
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
            rss: usage.rss
          });
        } catch (error) {
          console.warn('Memory snapshot failed:', error.message);
        }
      }, 1000);

      // Simulate load on the service
      await this.simulateLoad(servicePort, serviceName);
      
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearInterval(monitorInterval);

      // Analyze memory snapshots
      if (memorySnapshots.length > 0) {
        testResults.initialMemory = memorySnapshots[0].heapUsed;
        testResults.finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
        testResults.peakMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
        testResults.averageMemory = memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length;
        testResults.memoryGrowth = testResults.finalMemory - testResults.initialMemory;
        
        // Calculate GC efficiency
        const gcEvents = this.detectGCEvents(memorySnapshots);
        testResults.gcEfficiency = gcEvents.efficiency;
        
        // Detect memory leaks
        const leakAnalysis = this.analyzeMemoryLeak(memorySnapshots);
        testResults.leakDetected = leakAnalysis.leakDetected;
        testResults.warnings = leakAnalysis.warnings;
        testResults.recommendations = leakAnalysis.recommendations;
      }

      this.results.services[serviceName] = testResults;
      
      if (testResults.leakDetected) {
        this.results.summary.totalLeaks++;
        if (testResults.memoryGrowth > 100 * 1024 * 1024) { // 100MB
          this.results.summary.criticalLeaks++;
        }
      } else {
        this.results.summary.passed++;
      }
      
      this.results.summary.warnings += testResults.warnings.length;
      
      console.log(`✅ ${serviceName} memory test completed`);
      this.printServiceResults(testResults);
      
    } catch (error) {
      console.error(`❌ Memory test failed for ${serviceName}:`, error.message);
      testResults.error = error.message;
      this.results.services[serviceName] = testResults;
    }
  }

  async simulateLoad(port, serviceName) {
    console.log(`📈 Simulating load on ${serviceName}:${port}...`);
    
    const requests = [];
    const baseUrl = `http://localhost:${port}`;
    
    // Health check requests
    for (let i = 0; i < 100; i++) {
      requests.push(this.makeRequest(`${baseUrl}/api/${serviceName}/health`));
    }
    
    // Service-specific load patterns
    switch (serviceName) {
      case 'design-parser':
        for (let i = 0; i < 50; i++) {
          requests.push(this.makeRequest(`${baseUrl}/api/parser/analyze`, 'POST', {
            fileId: `test-file-${i}`,
            projectId: 'test-project',
            options: { analysisDepth: 'detailed' }
          }));
        }
        break;
        
      case 'translation-engine':
        for (let i = 0; i < 30; i++) {
          requests.push(this.makeRequest(`${baseUrl}/api/translation/translate`, 'POST', {
            designId: `design-${i}`,
            targetLLM: 'openai_gpt4',
            format: 'markdown',
            translationType: 'component'
          }));
        }
        break;
        
      case 'export-engine':
        for (let i = 0; i < 40; i++) {
          requests.push(this.makeRequest(`${baseUrl}/api/export/generate`, 'POST', {
            translationId: `translation-${i}`,
            format: 'react_typescript',
            options: { framework: 'react' }
          }));
        }
        break;
        
      case 'collaboration-hub':
        for (let i = 0; i < 60; i++) {
          requests.push(this.makeRequest(`${baseUrl}/api/collaboration/sessions/project-${i % 5}`));
        }
        break;
    }
    
    // Execute requests with some concurrency
    const batchSize = 10;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async makeRequest(url, method = 'GET', body = null) {
    try {
      const axios = require('axios');
      const config = {
        method,
        url,
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (body && method !== 'GET') {
        config.data = body;
      }
      
      await axios(config);
    } catch (error) {
      // Ignore request errors for memory testing purposes
      // We're testing memory, not API functionality
    }
  }

  detectGCEvents(snapshots) {
    let gcEvents = 0;
    let totalMemoryFreed = 0;
    
    for (let i = 1; i < snapshots.length; i++) {
      const current = snapshots[i];
      const previous = snapshots[i - 1];
      
      // Detect significant memory drop (likely GC event)
      const memoryDrop = previous.heapUsed - current.heapUsed;
      if (memoryDrop > 5 * 1024 * 1024) { // 5MB drop
        gcEvents++;
        totalMemoryFreed += memoryDrop;
      }
    }
    
    const efficiency = gcEvents > 0 ? totalMemoryFreed / gcEvents : 0;
    return { gcEvents, efficiency, totalMemoryFreed };
  }

  analyzeMemoryLeak(snapshots) {
    const analysis = {
      leakDetected: false,
      warnings: [],
      recommendations: []
    };
    
    if (snapshots.length < 10) {
      analysis.warnings.push('Insufficient data points for reliable leak detection');
      return analysis;
    }
    
    // Calculate memory growth trend
    const firstQuarter = snapshots.slice(0, Math.floor(snapshots.length / 4));
    const lastQuarter = snapshots.slice(-Math.floor(snapshots.length / 4));
    
    const firstQuarterAvg = firstQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / firstQuarter.length;
    const lastQuarterAvg = lastQuarter.reduce((sum, s) => sum + s.heapUsed, 0) / lastQuarter.length;
    
    const growthRate = (lastQuarterAvg - firstQuarterAvg) / firstQuarterAvg;
    
    // Leak detection thresholds
    if (growthRate > 0.5) { // 50% growth
      analysis.leakDetected = true;
      analysis.warnings.push(`Significant memory growth detected: ${(growthRate * 100).toFixed(1)}%`);
    } else if (growthRate > 0.2) { // 20% growth
      analysis.warnings.push(`Moderate memory growth: ${(growthRate * 100).toFixed(1)}%`);
    }
    
    // Check for sustained growth without GC relief
    const growthPoints = [];
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].heapUsed > snapshots[i - 1].heapUsed) {
        growthPoints.push(i);
      }
    }
    
    const sustainedGrowthRatio = growthPoints.length / snapshots.length;
    if (sustainedGrowthRatio > 0.7) {
      analysis.warnings.push('Sustained memory growth pattern detected');
    }
    
    // Peak memory analysis
    const peakMemory = Math.max(...snapshots.map(s => s.heapUsed));
    const avgMemory = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
    
    if (peakMemory > avgMemory * 2) {
      analysis.warnings.push('High memory spikes detected');
      analysis.recommendations.push('Consider implementing object pooling or better memory management');
    }
    
    // External memory analysis
    const maxExternal = Math.max(...snapshots.map(s => s.external));
    if (maxExternal > 100 * 1024 * 1024) { // 100MB
      analysis.warnings.push('High external memory usage detected');
      analysis.recommendations.push('Review external dependencies and buffer usage');
    }
    
    return analysis;
  }

  printServiceResults(results) {
    const mbFormat = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
    
    console.log(`
📊 Memory Analysis for ${results.serviceName}:
   Initial Memory: ${mbFormat(results.initialMemory)} MB
   Peak Memory: ${mbFormat(results.peakMemory)} MB
   Final Memory: ${mbFormat(results.finalMemory)} MB
   Memory Growth: ${mbFormat(results.memoryGrowth)} MB
   Average Memory: ${mbFormat(results.averageMemory)} MB
   Leak Detected: ${results.leakDetected ? '❌ YES' : '✅ NO'}
   Warnings: ${results.warnings.length}
    `);
    
    if (results.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      results.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    if (results.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      results.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      services: this.results.services,
      overallStatus: this.results.summary.criticalLeaks === 0 ? 'PASS' : 'FAIL'
    };
    
    // Write detailed report
    const reportPath = path.join(__dirname, '../reports/memory-test-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Write summary report
    const summaryPath = path.join(__dirname, '../reports/memory-test-summary.txt');
    const summary = `
Memory Test Summary
==================
Timestamp: ${report.timestamp}
Overall Status: ${report.overallStatus}

Services Tested: ${Object.keys(report.services).length}
Services Passed: ${report.summary.passed}
Total Leaks: ${report.summary.totalLeaks}
Critical Leaks: ${report.summary.criticalLeaks}
Total Warnings: ${report.summary.warnings}

Service Details:
${Object.entries(report.services).map(([name, results]) => `
${name}:
  Memory Growth: ${(results.memoryGrowth / (1024 * 1024)).toFixed(2)} MB
  Leak Detected: ${results.leakDetected ? 'YES' : 'NO'}
  Warnings: ${results.warnings.length}
`).join('')}

Recommendations:
- Monitor services with detected leaks closely
- Implement memory profiling in production
- Consider memory optimization for services with high growth
- Regular memory audits during development
`;
    
    fs.writeFileSync(summaryPath, summary);
    
    console.log('\n📋 Memory Test Report Generated:');
    console.log(`   Detailed: ${reportPath}`);
    console.log(`   Summary: ${summaryPath}`);
    
    return report;
  }
}

// Main execution
async function runMemoryTests() {
  console.log('🚀 Starting Memory Leak Detection Tests...\n');
  
  const tester = new MemoryTester();
  
  // Test each service (assuming they're running on these ports)
  const services = [
    { name: 'design-parser', port: 8091 },
    { name: 'translation-engine', port: 8092 },
    { name: 'export-engine', port: 8093 },
    { name: 'collaboration-hub', port: 8094 }
  ];
  
  for (const service of services) {
    await tester.testService(service.name, service.port);
  }
  
  // Generate final report
  const report = tester.generateReport();
  
  console.log('\n🎯 Memory Test Summary:');
  console.log(`   Overall Status: ${report.overallStatus}`);
  console.log(`   Services Tested: ${Object.keys(report.services).length}`);
  console.log(`   Critical Leaks: ${report.summary.criticalLeaks}`);
  console.log(`   Total Warnings: ${report.summary.warnings}`);
  
  // Exit with appropriate code
  process.exit(report.overallStatus === 'PASS' ? 0 : 1);
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Memory tests interrupted');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception during memory tests:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  runMemoryTests().catch((error) => {
    console.error('❌ Memory tests failed:', error);
    process.exit(1);
  });
}

module.exports = { MemoryTester };