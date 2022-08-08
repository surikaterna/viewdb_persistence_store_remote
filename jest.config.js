/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.[t|j]s$': '@swc/jest'
  },
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s'
  ],
  moduleFileExtensions: ['ts', 'js'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testTimeout: 2000
};
