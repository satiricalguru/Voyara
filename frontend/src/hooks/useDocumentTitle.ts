import { useEffect } from 'react';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — Voyara` : 'Voyara — Whole-Trip AI Travel Architect';
  }, [title]);
}
