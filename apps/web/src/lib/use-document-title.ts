import { useEffect } from "react";

const productTitle = "Datum — You set the goal. Datum gets the campaign live.";

export function useDocumentTitle(page: string | null): void {
  useEffect(() => {
    document.title = page === null ? productTitle : `${page} · Datum`;
  }, [page]);
}
