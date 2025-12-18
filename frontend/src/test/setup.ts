import '@testing-library/jest-dom'
import { expect, vi } from 'vitest'

// Global setup for tests
;(globalThis as any).TextEncoder = TextEncoder;
;(globalThis as any).TextDecoder = TextDecoder;