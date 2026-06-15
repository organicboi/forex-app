import { redirect } from 'next/navigation'

export default function RateHistoryPage() {
  redirect('/admin/reports?tab=history')
}
