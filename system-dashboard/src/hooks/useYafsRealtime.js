import { useEffect, useState } from 'react';
import { subscribeToYafsData } from '@/services/yafsApi';

export function useYafsRealtime(loader, initialValue, deps = []) {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(initialValue);
    setLoading(true);
    return subscribeToYafsData(
      loader,
      nextData => {
        setData(nextData);
        setLoading(false);
        setError(null);
      },
      nextError => {
        console.error(nextError);
        setError(nextError);
        setLoading(false);
      }
    );
  }, deps);

  return { data, loading, error };
}
