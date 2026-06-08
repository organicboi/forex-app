import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUploadUrl, getPublicUrl } from '@/lib/r2'
import crypto from 'crypto'
import path from 'path'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
}

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB hard cap

async function getAuthedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, customer_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return { user_id: profile.id, customer_id: profile.customer_id }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { filename, content_type, file_size_bytes } = body ?? {}

  if (!filename || !content_type || !file_size_bytes) {
    return Response.json({ error: 'Missing filename, content_type, or file_size_bytes' }, { status: 400 })
  }

  const fileType = ALLOWED_TYPES[content_type as string]
  if (!fileType) {
    return Response.json({ error: 'File type not allowed. Use JPEG, PNG, WebP, GIF, MP4, or WebM.' }, { status: 400 })
  }

  if (file_size_bytes > MAX_FILE_BYTES) {
    return Response.json({ error: 'File exceeds 100 MB limit' }, { status: 413 })
  }

  const supabase = createAdminClient()

  // Storage quota check
  const { data: storageRow } = await supabase
    .from('v_customer_storage')
    .select('used_mb, limit_mb')
    .eq('customer_id', auth.customer_id)
    .single()

  if (storageRow) {
    const fileMb = Number(file_size_bytes) / 1048576
    const usedMb = Number(storageRow.used_mb)
    const limitMb = Number(storageRow.limit_mb)
    if (usedMb + fileMb > limitMb) {
      return Response.json(
        { error: `Storage limit reached. Used ${usedMb.toFixed(1)} MB of ${limitMb} MB.` },
        { status: 413 }
      )
    }
  }

  const ext = path.extname(filename).toLowerCase() || `.${content_type.split('/')[1]}`
  const key = `${auth.customer_id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

  const uploadUrl = await getUploadUrl(key, content_type)
  const publicUrl = getPublicUrl(key)

  return Response.json({ upload_url: uploadUrl, key, public_url: publicUrl })
}
