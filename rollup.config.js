import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pluginJson from '@rollup/plugin-json';

export default {
	input: 'dist/index.js',
	plugins: [
        pluginJson(),
		nodeResolve({ jsnext: true }),
		commonjs()
	],
	output: {
		format: 'cjs',
		file: 'tmp/lambda/index.js'
	},
	external: ['aws-sdk']
};