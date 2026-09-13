"use client";
import { readData } from '../../services/workspace-data.mjs';

import {useTranslation} from '@/context/I18nContext';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import PublicHeader from '@/components/Website/PublicHeader';
import websiteStyles from '@/components/Website/Website.module.css';
import BrandLogo from '@/components/BrandLogo';
import React, { useState } from 'react';
import styles from './LoginView.module.css';

import { useAuth } from '@/context/AuthContext';

const LoginView = () => {
    const {t: translateText}=useTranslation();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);
        setError('');

        const success = await login(email, password);
        if (!success) {
            setError(readData("components.Clerio.LoginView", "loginError"));
            setIsLoading(false);
        }
        // If success, AuthContext updates user, triggering re-render in parent
    };

    return (
        <div className={`${styles.loginWrapper} ${websiteStyles.site}`}>
            <PublicHeader />
            <main id="main-content" className={styles.loginLayout}>
                <section className={styles.introduction} aria-labelledby="login-introduction-title">
                    <span className={styles.eyebrow}>{translateText('login','eyebrow')}</span>
                    <h1 id="login-introduction-title">{translateText('login','title')}</h1>
                    <p>{translateText('login','description')}</p>
                    <ul>{['pointOne','pointTwo','pointThree'].map(key=><li key={key}><CheckCircleOutline fontSize="small" />{translateText('login',key)}</li>)}</ul>
                </section>
                <section className={styles.loginCard} aria-labelledby="login-form-title">
                <div className={styles.brand}>
                    <BrandLogo size={64} />
                    <h2 id="login-form-title" className={styles.title}>{readData("components.Clerio.LoginView", "LoginView_text_3")}</h2>
                    <div className={styles.subtitle}>{readData("components.Clerio.LoginView", "LoginView_text_4")}</div>
                </div>

                {/* Error Message */}
                {error && <div role="alert" className={styles.error}>{error}</div>}

                <form className={styles.inputGroup} onSubmit={handleLogin}>
                    <input
                        type="email"
                        aria-label={readData("components.Clerio.LoginView", "LoginView_placeholder_5")}
                        autoComplete="username"
                        maxLength={254}
                        disabled={isLoading}
                        placeholder={readData("components.Clerio.LoginView", "LoginView_placeholder_5")}
                        className={styles.inputField}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        aria-label={readData("components.Clerio.LoginView", "LoginView_placeholder_6")}
                        autoComplete="current-password"
                        maxLength={128}
                        disabled={isLoading}
                        placeholder={readData("components.Clerio.LoginView", "LoginView_placeholder_6")}
                        className={styles.inputField}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" disabled={isLoading} aria-busy={isLoading} className={styles.loginBtn}>
                        {isLoading ? readData("components.Clerio.LoginView", "display_1") : readData("components.Clerio.LoginView", "display_2")}
                    </button>
                </form>

                <p role="note">{readData("components.Clerio.LoginView", "demoNotice")}</p>
                </section>
            </main>

        </div>
    );
};

export default LoginView;
