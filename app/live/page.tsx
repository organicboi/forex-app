import LiveDisplay from "./LiveDisplay";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { token } = await searchParams;
  return <LiveDisplay token={token ?? null} />;
}
