import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import pluginJson from '@rollup/plugin-json';
import pluginTypescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	plugins: [
        pluginJson(),
        pluginTypescript(),
		nodeResolve({ jsnext: true }),
		commonjs()
	],
	output: {
		format: 'cjs',
		file: 'tmp/lambda/index.js'
	},
	external: ['aws-sdk']
};