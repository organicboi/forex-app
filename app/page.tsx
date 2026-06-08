import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from './LoginForm'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function Page({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') redirect('/admin/rates')
    if (profile?.role === 'branch_user') redirect('/branch/rates')
  }

  const { error } = await searchParams

  return <LoginForm errorParam={error} />
}
