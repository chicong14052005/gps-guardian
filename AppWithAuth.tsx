import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPages from './pages/AuthPages';
import App from './App';

const AppContent: React.FC = () => {
    const { user, isLoading } = useAuth();
    const [showApp, setShowApp] = useState(false);

    useEffect(() => {
        if (!isLoading && user) {
            setShowApp(true);
        }
    }, [user, isLoading]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!user || !showApp) {
        return <AuthPages onAuthSuccess={() => setShowApp(true)} />;
    }

    return <App />;
};

const AppWithAuth: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default AppWithAuth;
