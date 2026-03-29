module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind', worklets: false }],
      'nativewind/babel',
    ],
  }
}
