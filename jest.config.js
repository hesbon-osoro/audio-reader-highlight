/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Tests import the same source as the app, so keep the app's
          // module settings and just relax what Jest needs.
          module: 'commonjs',
          esModuleInterop: true,
          resolveJsonModule: true,
          allowJs: true,
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};
