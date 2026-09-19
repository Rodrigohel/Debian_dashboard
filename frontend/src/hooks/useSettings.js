import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const FALLBACK = { companyName: 'Minha Empresa', siteName: 'Monitoramento de Rede', logoUrl: '' };

export function useSettings() {
  const [settings, setSettings] = useState(FALLBACK);

  const reload = useCallback(async () => {
    try {
      const data = await api.publicSettings();
      setSettings(data);
    } catch {
      // mantém o fallback se a API ainda não respondeu
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { settings, reloadSettings: reload };
}
