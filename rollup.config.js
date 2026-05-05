import commonjs from '@rollup/plugin-commonjs'
import {nodeResolve} from '@rollup/plugin-node-resolve'

export default {
    input: 'out/index.js',
    output: {
        file: 'dist/index.js',
        format: 'es'
    },
    context: 'globalThis',
    plugins: [commonjs(), nodeResolve()]
}
