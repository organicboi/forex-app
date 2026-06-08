import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/https:\/\/([^.]+)/)?.[1] ?? ''
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!

function getStorageClient() {
  return new S3Client({
    forcePathStyle: true,
    region: process.env.SUPABASE_S3_REGION!,
    endpoint: `https://${PROJECT_REF}.storage.supabase.co/storage/v1/s3`,
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
    },
  })
}

export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const client = getStorageClient()
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(client, command, { expiresIn: 300 })
}

export async function deleteR2Object(key: string): Promise<void> {
  const client = getStorageClient()
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export function getPublicUrl(key: string): string {
  return `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}/${key}`
}

export function getKeyFromUrl(fileUrl: string): string {
  const prefix = `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/${BUCKET}/`
  return fileUrl.startsWith(prefix) ? fileUrl.slice(prefix.length) : fileUrl
}
