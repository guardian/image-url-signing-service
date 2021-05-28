module.exports = {
    preset: 'ts-jest/presets/js-with-ts',
    roots: ['<rootDir>/src'],
    transformIgnorePatterns: ['/node_modules/(?!(@guardian)/)'],
};
