module.exports = {
  displayName: 'Tests Typescript Application - Event',
  moduleDirectories: ['node_modules', 'src'],
  testMatch: ['**/tests/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[tj]s?(x)'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  testPathIgnorePatterns: ['<rootDir>/build/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
