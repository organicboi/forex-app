import { redirect } from 'next/navigation'

export default function ScreensReportPage() {
  redirect('/admin/reports?tab=screens')
}
