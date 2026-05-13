'use client'

import { useActionState } from 'react'
import { signIn, signUp } from '@/app/actions/auth'

const initialState = undefined

export default function LoginPage() {
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState
  )
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState
  )

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Sign in</h1>

      <form action={signInAction}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="signin-email">Email</label>
          <br />
          <input
            id="signin-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="signin-password">Password</label>
          <br />
          <input
            id="signin-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>
        {signInState?.error && (
          <p style={{ color: 'red', marginBottom: 8 }}>{signInState.error}</p>
        )}
        <button type="submit" disabled={signInPending} style={{ padding: '8px 16px' }}>
          {signInPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <hr style={{ margin: '32px 0' }} />

      <h2>Create account</h2>

      <form action={signUpAction}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="signup-email">Email</label>
          <br />
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="signup-password">Password</label>
          <br />
          <input
            id="signup-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            style={{ width: '100%', padding: 8, marginTop: 4 }}
          />
        </div>
        {signUpState?.error && (
          <p style={{ color: 'red', marginBottom: 8 }}>{signUpState.error}</p>
        )}
        <button type="submit" disabled={signUpPending} style={{ padding: '8px 16px' }}>
          {signUpPending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  )
}
