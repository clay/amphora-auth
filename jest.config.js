'use strict';

module.exports = {
  // the tests read `this.description` inside describe(), which only the jasmine runner provides (Jest 27+ defaults to circus)
  testRunner: 'jest-jasmine2',
  verbose: true,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    '!coverage/**',
    '!**/node_modules/**',
    '!*.config.js',
    '!test/fixtures/**',
    '!test/utils/**',
    '!routes/**',
    '!strategies/index.js',
    '**/*.js'
  ],
  coverageDirectory: 'coverage'
};
