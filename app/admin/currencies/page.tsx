import { redirect } from 'next/navigation'

export default function CurrenciesPage() {
  redirect('/admin/rates?tab=currencies')
}
