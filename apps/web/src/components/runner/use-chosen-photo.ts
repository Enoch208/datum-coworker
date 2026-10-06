import { useCallback, useEffect, useState } from "react";

export interface ChosenPhoto {
  readonly file: File;
  readonly previewUrl: string;
}

export function useChosenPhoto() {
  const [chosen, setChosen] = useState<ChosenPhoto | null>(null);

  useEffect(() => {
    if (chosen === null) return;
    return () => {
      URL.revokeObjectURL(chosen.previewUrl);
    };
  }, [chosen]);

  const choose = useCallback((file: File | null) => {
    setChosen(file === null ? null : { file, previewUrl: URL.createObjectURL(file) });
  }, []);

  return { chosen, choose };
}
