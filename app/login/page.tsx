'use client'

import { useActionState, useState } from 'react'
import { signIn, signUp } from '@/app/actions/auth'

const initialState = undefined

export default function LoginPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [signInState, signInAction, signInPending] = useActionState(signIn, initialState)
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, initialState)

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 9.5l2.5 1.5L12 6l7.5 5 2.5-1.5L12 2zm0 5L5 12l7 10 7-10-7-5z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Mona Moda Style</h1>
        <p className="text-sm text-gray-500 mt-1">Inventory Management</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab('signin')}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
              tab === 'signin'
                ? 'text-gray-900 border-b-2 border-gray-900 -mb-px bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
              tab === 'signup'
                ? 'text-gray-900 border-b-2 border-gray-900 -mb-px bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Sign in form */}
        {tab === 'signin' && (
          <form action={signInAction} className="p-6 space-y-4">
            <div>
              <label htmlFor="signin-email" className={labelClass}>Email address</label>
              <input
                id="signin-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="signin-password" className={labelClass}>Password</label>
              <input
                id="signin-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            {signInState?.error && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {signInState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={signInPending}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {signInPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {/* Sign up form */}
        {tab === 'signup' && (
          <form action={signUpAction} className="p-6 space-y-4">
            <div>
              <label htmlFor="signup-email" className={labelClass}>Email address</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="signup-password" className={labelClass}>Password</label>
              <input
                id="signup-password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={inputClass}
              />
            </div>
            {signUpState?.error && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {signUpState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={signUpPending}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {signUpPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        &copy; {new Date().getFullYear()} Mona Moda Style
      </p>
    </div>
  )
}
