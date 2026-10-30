import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTypeahead, findTypeaheadMatch, getNextIndex } from '#remixcn/lib/composite.ts'

const none = [false, false, false, false]

describe('getNextIndex', () => {
  it('moves along the orientation and ignores the other axis', () => {
    assert.equal(getNextIndex('ArrowDown', 0, none, { orientation: 'vertical' }), 1)
    assert.equal(getNextIndex('ArrowUp', 2, none, { orientation: 'vertical' }), 1)
    assert.equal(getNextIndex('ArrowRight', 0, none, { orientation: 'vertical' }), undefined)
    assert.equal(getNextIndex('ArrowRight', 0, none, { orientation: 'horizontal' }), 1)
    assert.equal(getNextIndex('ArrowDown', 0, none, { orientation: 'horizontal' }), undefined)
    assert.equal(getNextIndex('ArrowDown', 0, none, { orientation: 'both' }), 1)
    assert.equal(getNextIndex('ArrowLeft', 1, none, { orientation: 'both' }), 0)
  })

  it('reverses the horizontal arrows in right-to-left text', () => {
    assert.equal(getNextIndex('ArrowLeft', 0, none, { orientation: 'horizontal', dir: 'rtl' }), 1)
    assert.equal(getNextIndex('ArrowRight', 1, none, { orientation: 'horizontal', dir: 'rtl' }), 0)
    assert.equal(getNextIndex('ArrowDown', 0, none, { orientation: 'vertical', dir: 'rtl' }), 1)
  })

  it('skips disabled items, also for Home and End', () => {
    let disabled = [true, false, true, false, true]

    assert.equal(getNextIndex('ArrowDown', 1, disabled), 3)
    assert.equal(getNextIndex('ArrowUp', 3, disabled), 1)
    assert.equal(getNextIndex('Home', 3, disabled), 1)
    assert.equal(getNextIndex('End', 1, disabled), 3)
  })

  it('wraps by default and stays at the edge without loop', () => {
    assert.equal(getNextIndex('ArrowDown', 3, none), 0)
    assert.equal(getNextIndex('ArrowUp', 0, none), 3)
    assert.equal(getNextIndex('ArrowDown', 3, none, { loop: false }), 3)
    assert.equal(getNextIndex('ArrowUp', 0, none, { loop: false }), 0)
  })

  it('starts at the first or last enabled item when none is active', () => {
    assert.equal(getNextIndex('ArrowDown', -1, [true, false, false]), 1)
    assert.equal(getNextIndex('ArrowUp', -1, [false, false, true]), 1)
  })

  it('returns undefined for other keys and when every item is disabled', () => {
    assert.equal(getNextIndex('a', 0, none), undefined)
    assert.equal(getNextIndex('ArrowDown', 0, [true, true]), undefined)
    assert.equal(getNextIndex('Home', 0, []), undefined)
  })
})

describe('findTypeaheadMatch', () => {
  let labels = ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Bilberry']

  it('finds the next item starting with the typed text, ignoring case', () => {
    assert.equal(findTypeaheadMatch(labels, 'b', 0), 1)
    assert.equal(findTypeaheadMatch(labels, 'BL', 0), 2)
    assert.equal(findTypeaheadMatch(labels, 'ch', 4), 3)
  })

  it('cycles through items that start with a repeated letter', () => {
    assert.equal(findTypeaheadMatch(labels, 'b', 1), 2)
    assert.equal(findTypeaheadMatch(labels, 'bb', 1), 2)
    assert.equal(findTypeaheadMatch(labels, 'b', 4), 1)
  })

  it('keeps the current item while it still matches longer text', () => {
    assert.equal(findTypeaheadMatch(labels, 'bl', 2), 2)
  })

  it('skips disabled items and reports no match with -1', () => {
    assert.equal(findTypeaheadMatch(labels, 'b', 0, [false, true, false, false, false]), 2)
    assert.equal(findTypeaheadMatch(labels, 'z', 0), -1)
    assert.equal(findTypeaheadMatch(labels, '', 0), -1)
  })
})

describe('createTypeahead', () => {
  let key = (key: string, init: Partial<KeyboardEvent> = {}) => ({ key, ...init }) as KeyboardEvent

  it('collects typed characters into a query that a pause clears', (t) => {
    let timers = t.useFakeTimers()
    let typeahead = createTypeahead()

    assert.equal(typeahead.type(key('b')), 'b')
    assert.equal(typeahead.type(key('l')), 'bl')
    assert.equal(typeahead.typing(), true)
    timers.advance(500)
    assert.equal(typeahead.typing(), false)
    assert.equal(typeahead.type(key('c')), 'c')
    typeahead.reset()
    assert.equal(typeahead.type(key('d')), 'd')
  })

  it('leaves keys that type no text, and a space that would start the query', () => {
    let typeahead = createTypeahead()

    assert.equal(typeahead.type(key('ArrowDown')), undefined)
    assert.equal(typeahead.type(key('a', { ctrlKey: true })), undefined)
    assert.equal(typeahead.type(key(' ')), undefined)
    assert.equal(typeahead.type(key('n')), 'n')
    assert.equal(typeahead.type(key(' ')), 'n ')
    typeahead.reset()
  })
})
