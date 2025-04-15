module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testTimeout: 20000,
    // Add coverage reporting
    collectCoverage: true,
    collectCoverageFrom: [
      'routes/**/*.js',
      'utils/**/*.js',
      'models/**/*.js',
      'middleware/**/*.js',
      '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'clover']
  };