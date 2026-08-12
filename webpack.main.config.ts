import type { Configuration } from 'webpack';

import rules from './webpack.rules.ts';

const config: Configuration = {
  entry: './src/main/main.ts',
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.ts'],
    extensionAlias: {
      '.js': ['.js', '.ts'],
    },
  },
};

export default config;
