'use client'

import { useState, useTransition } from 'react'
import { switchOrg } from '@/app/actions/orgs'
import type { OrgMembership } from '@/lib/auth/org'

export default function OrgSwitcher({
  current,
  all,
}: {
  current: OrgMembership
  all: OrgMembership[]
}) {
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const others = all.filter((m) => m.orgId !== current.orgId)

  if (others.length === 0) {
    return (
      <span className="font-semibold text-gray-900 tracking-tight text-sm">
        {current.orgName}
      </span>
    )
  }

  function handleSelect(orgId: string) {
    setOpen(false)
    startTransition(async () => {
      await switchOrg(orgId)
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 font-semibold text-gray-900 tracking-tight text-sm hover:text-gray-600 transition-colors duration-150 cursor-pointer"
      >
        {current.orgName}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-52">
            {all.map((m) => (
              <button
                key={m.orgId}
                type="button"
                onClick={() => handleSelect(m.orgId)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-100 cursor-pointer flex items-center justify-between gap-3 ${
                  m.orgId === current.orgId
                    ? 'font-medium text-gray-900 bg-gray-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{m.orgName}</span>
                {m.orgId === current.orgId && (
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
