import { describe, it, expect } from 'vitest'
import { PairingParser, parseLine } from '../src/main/services/receiver-protocol'

describe('parseLine', () => {
  it('detects a paired tracker from an "Added device" line', () => {
    const e = parseLine('<inf> esb_event: Added device on id 0 with address 95CB23A0FDF7')
    expect(e.type).toBe('paired')
    if (e.type === 'paired') {
      expect(e.id).toBe('0')
      expect(e.address).toBe('95CB23A0FDF7')
    }
  })

  it('treats unrelated lines as log output', () => {
    expect(parseLine('booting…').type).toBe('log')
  })
})

describe('PairingParser', () => {
  it('buffers across chunks and emits one event per completed line', () => {
    const p = new PairingParser()
    // Nothing until a newline arrives.
    expect(p.push('Added device on id 1 with ')).toEqual([])
    const events = p.push('address ABCDEF012345\r\nnoise\n')
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'paired', id: '1', address: 'ABCDEF012345' })
    expect(events[1].type).toBe('log')
  })

  it('handles several lines in a single chunk', () => {
    const p = new PairingParser()
    const events = p.push(
      'Added device on id 0 with address AAAA\nAdded device on id 1 with address BBBB\n'
    )
    const paired = events.filter((e) => e.type === 'paired')
    expect(paired).toHaveLength(2)
  })
})
