#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive Test Coverage Report Generator
 * Aggregates coverage from all services and client, generates unified reports
 */
class CoverageReporter {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.coverageDir = path.join(this.rootDir, 'coverage');
    this.services = [
      'design-parser',
      'translation-engine', 
      'export-engine',
      'collaboration-hub'
    ];
    this.coverageData = {
      services: {},
      client: {},
      overall: {},
      timestamp: new Date().toISOString()
    };
  }

  async generateReport() {
    console.log('🔍 Generating comprehensive test coverage report...\n');

    try {
      // Ensure coverage directory exists
      if (!fs.existsSync(this.coverageDir)) {
        fs.mkdirSync(this.coverageDir, { recursive: true });
      }

      // Run tests and collect coverage for each service
      await this.collectServicesCoverage();
      
      // Run tests and collect coverage for client
      await this.collectClientCoverage();
      
      // Merge all coverage data
      await this.mergeCoverageData();
      
      // Generate reports
      await this.generateReports();
      
      // Generate badges
      await this.generateBadges();
      
      // Validate coverage thresholds
      this.validateThresholds();
      
      console.log('\n✅ Coverage report generation completed!');
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Coverage report generation failed:', error.message);
      process.exit(1);
    }
  }

  async collectServicesCoverage() {
    console.log('📊 Collecting service coverage data...');
    
    for (const service of this.services) {
      const servicePath = path.join(this.rootDir, 'services', service);
      const serviceCoveragePath = path.join(servicePath, 'coverage');
      
      try {
        console.log(`  Testing ${service}...`);
        
        // Run tests with coverage
        execSync('npm run test:coverage', {
          cwd: servicePath,
          stdio: 'pipe',
          timeout: 120000 // 2 minutes timeout
        });
        
        // Read coverage data
        const coverageFilePath = path.join(serviceCoveragePath, 'coverage-summary.json');
        if (fs.existsSync(coverageFilePath)) {
          const coverageData = JSON.parse(fs.readFileSync(coverageFilePath, 'utf8'));
          this.coverageData.services[service] = {
            ...coverageData.total,
            path: servicePath,
            coverageFiles: {
              lcov: path.join(serviceCoveragePath, 'lcov.info'),
              json: path.join(serviceCoveragePath, 'coverage-final.json'),
              html: path.join(serviceCoveragePath, 'lcov-report')
            }
          };
          
          console.log(`    ✅ ${service}: ${coverageData.total.lines.pct}% lines, ${coverageData.total.functions.pct}% functions`);
        } else {
          console.warn(`    ⚠️  No coverage data found for ${service}`);
          this.coverageData.services[service] = this.getEmptyCoverage();
        }
        
      } catch (error) {
        console.error(`    ❌ Failed to collect coverage for ${service}:`, error.message);
        this.coverageData.services[service] = this.getEmptyCoverage();
      }
    }
  }

  async collectClientCoverage() {
    console.log('📊 Collecting client coverage data...');
    
    const clientPath = path.join(this.rootDir, 'client');
    const clientCoveragePath = path.join(clientPath, 'coverage');
    
    try {
      console.log('  Testing client...');
      
      // Run client tests with coverage
      execSync('npm run test:coverage', {
        cwd: clientPath,
        stdio: 'pipe',
        timeout: 180000 // 3 minutes timeout
      });
      
      // Read coverage data
      const coverageFilePath = path.join(clientCoveragePath, 'coverage-summary.json');
      if (fs.existsSync(coverageFilePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coverageFilePath, 'utf8'));
        this.coverageData.client = {
          ...coverageData.total,
          path: clientPath,
          coverageFiles: {
            lcov: path.join(clientCoveragePath, 'lcov.info'),
            json: path.join(clientCoveragePath, 'coverage-final.json'),
            html: path.join(clientCoveragePath, 'lcov-report')
          }
        };
        
        console.log(`    ✅ client: ${coverageData.total.lines.pct}% lines, ${coverageData.total.functions.pct}% functions`);
      } else {
        console.warn('    ⚠️  No coverage data found for client');
        this.coverageData.client = this.getEmptyCoverage();
      }
      
    } catch (error) {
      console.error('    ❌ Failed to collect coverage for client:', error.message);
      this.coverageData.client = this.getEmptyCoverage();
    }
  }

  async mergeCoverageData() {
    console.log('🔗 Merging coverage data...');
    
    try {
      // Collect all lcov files
      const lcovFiles = [];
      
      // Add service lcov files
      for (const [serviceName, serviceData] of Object.entries(this.coverageData.services)) {
        if (serviceData.coverageFiles?.lcov && fs.existsSync(serviceData.coverageFiles.lcov)) {
          lcovFiles.push(serviceData.coverageFiles.lcov);
        }
      }
      
      // Add client lcov file
      if (this.coverageData.client.coverageFiles?.lcov && fs.existsSync(this.coverageData.client.coverageFiles.lcov)) {
        lcovFiles.push(this.coverageData.client.coverageFiles.lcov);
      }
      
      if (lcovFiles.length > 0) {
        // Merge lcov files
        const mergedLcovPath = path.join(this.coverageDir, 'merged.lcov');
        const lcovContent = lcovFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
        fs.writeFileSync(mergedLcovPath, lcovContent);
        
        // Generate merged HTML report
        try {
          execSync(`npx genhtml ${mergedLcovPath} -o ${path.join(this.coverageDir, 'html-report')}`, {
            stdio: 'pipe'
          });
          console.log('  ✅ Merged HTML report generated');
        } catch (error) {
          console.warn('  ⚠️  Failed to generate merged HTML report:', error.message);
        }
      }
      
      // Calculate overall coverage
      this.calculateOverallCoverage();
      
    } catch (error) {
      console.error('❌ Failed to merge coverage data:', error.message);
    }
  }

  calculateOverallCoverage() {
    const components = [
      ...Object.values(this.coverageData.services),
      this.coverageData.client
    ].filter(component => component.lines && component.lines.total > 0);
    
    if (components.length === 0) {
      this.coverageData.overall = this.getEmptyCoverage();
      return;
    }
    
    // Calculate weighted averages
    const totals = components.reduce((acc, component) => {
      acc.lines.total += component.lines.total || 0;
      acc.lines.covered += component.lines.covered || 0;
      acc.functions.total += component.functions.total || 0;
      acc.functions.covered += component.functions.covered || 0;
      acc.statements.total += component.statements.total || 0;
      acc.statements.covered += component.statements.covered || 0;
      acc.branches.total += component.branches.total || 0;
      acc.branches.covered += component.branches.covered || 0;
      return acc;
    }, {
      lines: { total: 0, covered: 0 },
      functions: { total: 0, covered: 0 },
      statements: { total: 0, covered: 0 },
      branches: { total: 0, covered: 0 }
    });
    
    this.coverageData.overall = {
      lines: {
        total: totals.lines.total,
        covered: totals.lines.covered,
        skipped: 0,
        pct: totals.lines.total > 0 ? Math.round((totals.lines.covered / totals.lines.total) * 100 * 100) / 100 : 0
      },
      functions: {
        total: totals.functions.total,
        covered: totals.functions.covered,
        skipped: 0,
        pct: totals.functions.total > 0 ? Math.round((totals.functions.covered / totals.functions.total) * 100 * 100) / 100 : 0
      },
      statements: {
        total: totals.statements.total,
        covered: totals.statements.covered,
        skipped: 0,
        pct: totals.statements.total > 0 ? Math.round((totals.statements.covered / totals.statements.total) * 100 * 100) / 100 : 0
      },
      branches: {
        total: totals.branches.total,
        covered: totals.branches.covered,
        skipped: 0,
        pct: totals.branches.total > 0 ? Math.round((totals.branches.covered / totals.branches.total) * 100 * 100) / 100 : 0
      }
    };
  }

  async generateReports() {
    console.log('📝 Generating coverage reports...');
    
    // Generate JSON report
    const jsonReportPath = path.join(this.coverageDir, 'coverage-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(this.coverageData, null, 2));
    console.log(`  ✅ JSON report: ${jsonReportPath}`);
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport();
    const markdownReportPath = path.join(this.coverageDir, 'coverage-report.md');
    fs.writeFileSync(markdownReportPath, markdownReport);
    console.log(`  ✅ Markdown report: ${markdownReportPath}`);
    
    // Generate summary report for CI
    const summaryReport = this.generateSummaryReport();
    const summaryReportPath = path.join(this.coverageDir, 'coverage-summary.txt');
    fs.writeFileSync(summaryReportPath, summaryReport);
    console.log(`  ✅ Summary report: ${summaryReportPath}`);
    
    // Generate Cobertura XML for CI tools
    try {
      if (fs.existsSync(path.join(this.coverageDir, 'merged.lcov'))) {
        execSync(`npx lcov-to-cobertura-xml -i ${path.join(this.coverageDir, 'merged.lcov')} -o ${path.join(this.coverageDir, 'cobertura-coverage.xml')}`, {
          stdio: 'pipe'
        });
        console.log('  ✅ Cobertura XML report generated');
      }
    } catch (error) {
      console.warn('  ⚠️  Failed to generate Cobertura XML:', error.message);
    }
  }

  generateMarkdownReport() {
    const formatPct = (pct) => `${pct}%`;
    const getStatusEmoji = (pct) => pct >= 80 ? '✅' : pct >= 60 ? '⚠️' : '❌';
    
    return `# Imagineer Test Coverage Report

Generated: ${new Date().toLocaleString()}

## Overall Coverage ${getStatusEmoji(this.coverageData.overall.lines?.pct || 0)}

| Metric | Coverage | Status |
|--------|----------|--------|
| Lines | ${formatPct(this.coverageData.overall.lines?.pct || 0)} (${this.coverageData.overall.lines?.covered || 0}/${this.coverageData.overall.lines?.total || 0}) | ${getStatusEmoji(this.coverageData.overall.lines?.pct || 0)} |
| Functions | ${formatPct(this.coverageData.overall.functions?.pct || 0)} (${this.coverageData.overall.functions?.covered || 0}/${this.coverageData.overall.functions?.total || 0}) | ${getStatusEmoji(this.coverageData.overall.functions?.pct || 0)} |
| Statements | ${formatPct(this.coverageData.overall.statements?.pct || 0)} (${this.coverageData.overall.statements?.covered || 0}/${this.coverageData.overall.statements?.total || 0}) | ${getStatusEmoji(this.coverageData.overall.statements?.pct || 0)} |
| Branches | ${formatPct(this.coverageData.overall.branches?.pct || 0)} (${this.coverageData.overall.branches?.covered || 0}/${this.coverageData.overall.branches?.total || 0}) | ${getStatusEmoji(this.coverageData.overall.branches?.pct || 0)} |

## Service Coverage

| Service | Lines | Functions | Statements | Branches | Status |
|---------|-------|-----------|------------|----------|--------|
${Object.entries(this.coverageData.services).map(([name, data]) => 
  `| ${name} | ${formatPct(data.lines?.pct || 0)} | ${formatPct(data.functions?.pct || 0)} | ${formatPct(data.statements?.pct || 0)} | ${formatPct(data.branches?.pct || 0)} | ${getStatusEmoji(data.lines?.pct || 0)} |`
).join('\n')}

## Client Coverage

| Component | Lines | Functions | Statements | Branches | Status |
|-----------|-------|-----------|------------|----------|--------|
| Client | ${formatPct(this.coverageData.client.lines?.pct || 0)} | ${formatPct(this.coverageData.client.functions?.pct || 0)} | ${formatPct(this.coverageData.client.statements?.pct || 0)} | ${formatPct(this.coverageData.client.branches?.pct || 0)} | ${getStatusEmoji(this.coverageData.client.lines?.pct || 0)} |

## Coverage Thresholds

- ✅ **Good**: ≥80%
- ⚠️ **Warning**: 60-79%
- ❌ **Poor**: <60%

## Reports

- [Merged HTML Report](./html-report/index.html)
- [JSON Report](./coverage-report.json)
- [Cobertura XML](./cobertura-coverage.xml)

---
*Generated by Imagineer Coverage Reporter*
`;
  }

  generateSummaryReport() {
    return `COVERAGE SUMMARY
================
Overall Lines: ${this.coverageData.overall.lines?.pct || 0}%
Overall Functions: ${this.coverageData.overall.functions?.pct || 0}%
Overall Statements: ${this.coverageData.overall.statements?.pct || 0}%
Overall Branches: ${this.coverageData.overall.branches?.pct || 0}%

Services:
${Object.entries(this.coverageData.services).map(([name, data]) => 
  `  ${name}: ${data.lines?.pct || 0}% lines`
).join('\n')}

Client: ${this.coverageData.client.lines?.pct || 0}% lines

Threshold Status: ${this.coverageData.overall.lines?.pct >= 80 ? 'PASS' : 'FAIL'}
`;
  }

  async generateBadges() {
    console.log('🏷️  Generating coverage badges...');
    
    try {
      const badgesDir = path.join(this.coverageDir, 'badges');
      if (!fs.existsSync(badgesDir)) {
        fs.mkdirSync(badgesDir, { recursive: true });
      }
      
      const overallPct = this.coverageData.overall.lines?.pct || 0;
      const color = overallPct >= 80 ? 'brightgreen' : overallPct >= 60 ? 'yellow' : 'red';
      
      // Generate badge URL
      const badgeUrl = `https://img.shields.io/badge/coverage-${overallPct}%25-${color}`;
      
      // Save badge info
      const badgeInfo = {
        overall: {
          percentage: overallPct,
          color,
          url: badgeUrl
        },
        services: {},
        client: {
          percentage: this.coverageData.client.lines?.pct || 0,
          color: this.getBadgeColor(this.coverageData.client.lines?.pct || 0)
        }
      };
      
      Object.entries(this.coverageData.services).forEach(([name, data]) => {
        badgeInfo.services[name] = {
          percentage: data.lines?.pct || 0,
          color: this.getBadgeColor(data.lines?.pct || 0)
        };
      });
      
      fs.writeFileSync(path.join(badgesDir, 'badges.json'), JSON.stringify(badgeInfo, null, 2));
      console.log('  ✅ Coverage badges generated');
      
    } catch (error) {
      console.warn('  ⚠️  Failed to generate badges:', error.message);
    }
  }

  getBadgeColor(percentage) {
    return percentage >= 80 ? 'brightgreen' : percentage >= 60 ? 'yellow' : 'red';
  }

  validateThresholds() {
    const thresholds = {
      lines: 80,
      functions: 80,
      statements: 80,
      branches: 70
    };
    
    const failures = [];
    
    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const actual = this.coverageData.overall[metric]?.pct || 0;
      if (actual < threshold) {
        failures.push(`${metric}: ${actual}% (required: ${threshold}%)`);
      }
    });
    
    if (failures.length > 0) {
      console.warn('\n⚠️  Coverage threshold violations:');
      failures.forEach(failure => console.warn(`  - ${failure}`));
      
      if (process.env.CI === 'true') {
        console.error('\n❌ Coverage thresholds not met in CI environment');
        process.exit(1);
      }
    } else {
      console.log('\n✅ All coverage thresholds met!');
    }
  }

  printSummary() {
    console.log('\n📊 Coverage Summary:');
    console.log(`  Overall Lines: ${this.coverageData.overall.lines?.pct || 0}%`);
    console.log(`  Overall Functions: ${this.coverageData.overall.functions?.pct || 0}%`);
    console.log(`  Overall Statements: ${this.coverageData.overall.statements?.pct || 0}%`);
    console.log(`  Overall Branches: ${this.coverageData.overall.branches?.pct || 0}%`);
    
    console.log('\n🏗️  Service Coverage:');
    Object.entries(this.coverageData.services).forEach(([name, data]) => {
      console.log(`  ${name}: ${data.lines?.pct || 0}% lines`);
    });
    
    console.log(`\n💻 Client Coverage: ${this.coverageData.client.lines?.pct || 0}% lines`);
    
    console.log(`\n📁 Reports saved to: ${this.coverageDir}`);
  }

  getEmptyCoverage() {
    return {
      lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
      functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
      statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 0 }
    };
  }
}

// Run the coverage reporter
if (require.main === module) {
  const reporter = new CoverageReporter();
  reporter.generateReport().catch((error) => {
    console.error('Coverage report generation failed:', error);
    process.exit(1);
  });
}

module.exports = { CoverageReporter };