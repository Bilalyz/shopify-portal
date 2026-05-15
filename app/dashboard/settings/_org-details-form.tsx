'use client'

import { useActionState } from 'react'
import { updateOrgDetails, type OrgDetailsState } from '@/app/actions/settings'

type Props = {
  initialName: string
  initialDefaultVendor: string | null
  initialLanguage: string
}

const LANGUAGES = [
  { value: 'he', label: 'Hebrew' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
]

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function OrgDetailsForm({ initialName, initialDefaultVendor, initialLanguage }: Props) {
  const [state, dispatch, pending] = useActionState<OrgDetailsState, FormData>(
    updateOrgDetails,
    undefined
  )

  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <label htmlFor="name" className={labelClass}>Organization name</label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={initialName}
          required
          className={inputClass}
          placeholder="e.g. Mona Moda Style"
        />
      </div>

      <div>
        <label htmlFor="default_vendor" className={labelClass}>Default vendor name</label>
        <input
          id="default_vendor"
          name="default_vendor"
          type="text"
          defaultValue={initialDefaultVendor ?? ''}
          className={inputClass}
          placeholder="Auto-filled on new products"
        />
        <p className="mt-1 text-xs text-gray-400">Pre-filled in the vendor field when creating a new product</p>
      </div>

      <div>
        <label htmlFor="language" className={labelClass}>Language</label>
        <select
          id="language"
          name="language"
          defaultValue={initialLanguage}
          className={inputClass}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">Used for AI-generated content</p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Changes saved
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
