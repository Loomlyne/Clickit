import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PASSWORD_MIN,
  errorParams,
  passwordScore,
  passwordStrength,
} from '../../src/components/auth/password-rules.ts'

test('password minimum is 8 for every flow that sets a password', () => {
  assert.equal(PASSWORD_MIN, 8)
  assert.deepEqual(errorParams('passwordMin'), { min: 8 })
  assert.deepEqual(errorParams('nameMin'), { min: 2 })
  assert.equal(errorParams('emailInvalid'), undefined)
})

test('password score counts length, upper case, digit and symbol', () => {
  assert.equal(passwordScore(''), 0)
  assert.equal(passwordScore('abcdefgh'), 1)
  assert.equal(passwordScore('Abcdefgh'), 2)
  assert.equal(passwordScore('Abcdefg1'), 3)
  assert.equal(passwordScore('Abcdef1!'), 4)
  assert.equal(passwordScore('Ab1!'), 3)
})

test('strength labels follow the score', () => {
  assert.equal(passwordStrength(0), 'weak')
  assert.equal(passwordStrength(1), 'weak')
  assert.equal(passwordStrength(2), 'good')
  assert.equal(passwordStrength(3), 'good')
  assert.equal(passwordStrength(4), 'strong')
})
