import { redirect } from 'next/navigation'

export default function TickerPage() {
  redirect('/admin/display?tab=ticker')
}
