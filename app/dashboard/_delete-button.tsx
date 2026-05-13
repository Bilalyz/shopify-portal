'use client'

import { useTransition } from 'react'
import { deleteProduct } from '@/app/actions/products'

export default function DeleteButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('Delete this product? This cannot be undone.')) return
    startTransition(async () => {
      await deleteProduct(productId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-rose-600 border border-rose-200 px-2.5 py-1 rounded-md hover:bg-rose-50 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? '…' : 'Delete'}
    </button>
  )
}
