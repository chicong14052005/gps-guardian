import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_URL = 'http://localhost:3002/api';

interface User {
    id: number;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('gps_auth_token'));
    const [isLoading, setIsLoading] = useState(true);

    // Check token on mount
    useEffect(() => {
        const validateToken = async (): Promise<void> => {
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                } else {
                    // Token invalid
                    localStorage.removeItem('gps_auth_token');
                    setToken(null);
                }
            } catch (error) {
                console.error('Token validation error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        validateToken();
    }, [token]);

    const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('gps_auth_token', data.token);
                setToken(data.token);
                setUser(data.user);
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Đăng nhập thất bại' };
            }
        } catch (error) {
            return { success: false, error: 'Không thể kết nối tới server' };
        }
    }, []);

    const register = useCallback(async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('gps_auth_token', data.token);
                setToken(data.token);
                setUser(data.user);
                return { success: true };
            } else {
                return { success: false, error: data.error || 'Đăng ký thất bại' };
            }
        } catch (error) {
            return { success: false, error: 'Không thể kết nối tới server' };
        }
    }, []);

    const logout = useCallback((): void => {
        localStorage.removeItem('gps_auth_token');
        setToken(null);
        setUser(null);
    }, []);

    const value: AuthContextType = {
        user,
        token,
        isLoading,
        login,
        register,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// API helper function with auth
export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = localStorage.getItem('gps_auth_token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        (headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });
}
