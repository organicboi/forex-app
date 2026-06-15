import { redirect } from 'next/navigation'

export default function AdsPage() {
  redirect('/admin/display?tab=ads')
}
