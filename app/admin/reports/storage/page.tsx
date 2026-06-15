import { redirect } from 'next/navigation'

export default function StorageReportPage() {
  redirect('/admin/reports?tab=storage')
}
