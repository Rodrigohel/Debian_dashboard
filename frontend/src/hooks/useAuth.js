import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (import.meta.env.VITE_EMBEDDED !== 'true' && !getToken()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  // Com 2FA ativado pro usuário, o login não termina aqui — a API responde
  // { requiresTotp, totpToken } em vez de um token de acesso, e quem chamou
  // (LoginModal) precisa pedir o código e chamar completeTotpLogin.
  const login = useCallback(async (username, password) => {
    const result = await api.login(username, password);
    if (result.requiresTotp) return result;
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const completeTotpLogin = useCallback(async (totpToken, code) => {
    const { token, user: u } = await api.loginTotp(totpToken, code);
    setToken(token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return { user, checking, login, completeTotpLogin, logout, isAuthenticated: !!user };
}
