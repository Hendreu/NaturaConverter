import ConstEnumPlugin from 'rollup-plugin-const-enum'
import { defineConfig } from 'tsdown'

export default defineConfig({
  plugins: [ConstEnumPlugin()],
}) as any
