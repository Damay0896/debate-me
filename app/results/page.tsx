import { readSearchParam } from "@/lib/debate";

import ResultsView from "./results-view";

type ResultsPageProps = {
  searchParams: Promise<{
    session?: string | string[];
  }>;
};

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = await searchParams;

  return <ResultsView initialSessionId={readSearchParam(params.session) ?? ""} />;
}
