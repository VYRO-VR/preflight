import { describe, it, expect } from 'vitest'
import {
  PairingParser,
  matchSlotToTracker,
  parseLine,
  parseSlotList
} from '../src/main/services/receiver-protocol'
import type { TrackerInfo } from '../src/shared/types'

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

describe('parseSlotList', () => {
  it('numbers addresses by line order — the line index is the slot id', () => {
    const slots = parseSlotList('95CB23A0FDF7\nABCDEF012345\n0011223344AA\n')
    expect(slots).toEqual([
      { slot: 0, address: '95CB23A0FDF7' },
      { slot: 1, address: 'ABCDEF012345' },
      { slot: 2, address: '0011223344AA' }
    ])
  })

  it('skips noise without consuming a slot number', () => {
    const slots = parseSlotList(
      ['list', '', '95CB23A0FDF7', '<inf> esb: something happened', 'ABCDEF012345', ''].join('\r\n')
    )
    expect(slots.map((s) => s.slot)).toEqual([0, 1])
    expect(slots[1].address).toBe('ABCDEF012345')
  })

  it('normalises addresses to upper case', () => {
    expect(parseSlotList('95cb23a0fdf7\n')[0].address).toBe('95CB23A0FDF7')
  })

  it('returns nothing for a receiver with no paired trackers', () => {
    expect(parseSlotList('list\n')).toEqual([])
  })
})

describe('matchSlotToTracker', () => {
  const tracker = (id: string, name: string): TrackerInfo => ({ id, name, status: 'ok' })

  it('matches a slot address hiding inside a SlimeVR tracker name', () => {
    const match = matchSlotToTracker({ slot: 2, address: '95CB23A0FDF7' }, [
      tracker('1:0', 'Tracker 95:CB:23:A0:FD:F7'),
      tracker('2:0', 'Tracker 00:11:22:33:44:AA')
    ])
    expect(match).toMatchObject({ slot: 2, trackerId: '1:0', confident: true })
  })

  it('is not confident when nothing matches', () => {
    const match = matchSlotToTracker({ slot: 0, address: '95CB23A0FDF7' }, [
      tracker('1:0', 'Left Ankle')
    ])
    expect(match.trackerId).toBeUndefined()
    expect(match.confident).toBe(false)
  })

  it('is not confident when several trackers match', () => {
    const match = matchSlotToTracker({ slot: 0, address: 'AAAAAAAAAAAA' }, [
      tracker('1:0', 'Tracker AAAAAAAAAAAA'),
      tracker('1:1', 'Tracker AAAAAAAAAAAA ext')
    ])
    expect(match.confident).toBe(false)
  })
})
