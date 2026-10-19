import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: "'Public Sans Variable', sans-serif" },
        heading: { value: "'Public Sans Variable', sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        'surface.canvas': { value: '#f5f5ef' },
        'surface.panel': { value: '#ffffff' },
        'surface.subtle': { value: '#ecefe6' },
        'ink.primary': { value: '#173c35' },
        'ink.muted': { value: '#5c6e64' },
        'line.default': { value: '#dce1d6' },
        'brand.solid': { value: '#194e3e' },
        'brand.hover': { value: '#123c2f' },
        'accent.solid': { value: '#d6f386' },
        'status.error': { value: '#a2342e' },
        'risk.low': { value: '#25724c' },
        'risk.moderate': { value: '#8a640c' },
        'risk.high': { value: '#b45419' },
        'risk.severe': { value: '#b33636' },
        'risk.noTravel': { value: '#692c47' },
      },
    },
  },
  globalCss: {
    html: { colorScheme: 'light' },
    body: { bg: 'surface.canvas', color: 'ink.primary', minWidth: '320px' },
    '*': { borderColor: 'line.default' },
    '::selection': { bg: 'accent.solid', color: 'ink.primary' },
    'a:focus-visible, button:focus-visible': {
      outline: '3px solid #548331',
      outlineOffset: '4px',
    },
  },
})

export const system = createSystem(defaultConfig, config)
