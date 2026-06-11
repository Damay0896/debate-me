import { readSearchParam } from "@/lib/debate";

import ResultsExportView from "./results-export-view";

type ResultsExportPageProps = {
  searchParams: Promise<{
    session?: string | string[];
    autoprint?: string | string[];
  }>;
};

export default async function ResultsExportPage({
  searchParams,
}: ResultsExportPageProps) {
  const params = await searchParams;

  return (
    <ResultsExportView
      autoPrint={readSearchParam(params.autoprint) === "1"}
      initialSessionId={readSearchParam(params.session) ?? ""}
    />
  );
}
