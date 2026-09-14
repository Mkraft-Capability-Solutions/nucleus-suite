'use client';
import React, { useState, useRef, useEffect } from 'react';
import LanguageIcon from '@mui/icons-material/Language';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from '@/context/I18nContext';
import styles from './LanguageSelector.module.css';

export default function LanguageSelector() {
  const { locale, setLocale, supportedLanguages } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeLang = supportedLanguages.find((l) => l.code === locale) || supportedLanguages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const internationalLangs = supportedLanguages.filter((l) => l.category === 'international');
  const indianLangs = supportedLanguages.filter((l) => l.category === 'indian');

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button
        type="button"
        className={styles.triggerButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Current language: ${activeLang.nativeName}. Click to change language.`}
        title={`Change Language (${activeLang.nativeName})`}
      >
        <LanguageIcon sx={{ fontSize: 16 }} className={styles.icon} />
        <span className={styles.langBadge}>{activeLang.code.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="menu" tabIndex={-1}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>Select Language / भाषा चुनें</span>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>International Languages</div>
            {internationalLangs.map((lang) => {
              const isSelected = lang.code === locale;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitem"
                  className={`${styles.menuItem} ${isSelected ? styles.menuItemActive : ''}`}
                  onClick={() => {
                    setLocale(lang.code);
                    setIsOpen(false);
                  }}
                >
                  <span className={styles.codeTag}>{lang.code.toUpperCase()}</span>
                  <div className={styles.labelCol}>
                    <span className={styles.nativeLabel}>{lang.nativeName}</span>
                    <span className={styles.englishLabel}>{lang.name}</span>
                  </div>
                  {isSelected && <CheckIcon sx={{ fontSize: 14 }} className={styles.checkIcon} />}
                </button>
              );
            })}
          </div>

          <div className={styles.sectionDivider} />

          <div className={styles.section}>
            <div className={styles.sectionHeader}>Indian Languages (भारतीय भाषाएं)</div>
            {indianLangs.map((lang) => {
              const isSelected = lang.code === locale;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitem"
                  className={`${styles.menuItem} ${isSelected ? styles.menuItemActive : ''}`}
                  onClick={() => {
                    setLocale(lang.code);
                    setIsOpen(false);
                  }}
                >
                  <span className={styles.codeTag}>{lang.code.toUpperCase()}</span>
                  <div className={styles.labelCol}>
                    <span className={styles.nativeLabel}>{lang.nativeName}</span>
                    <span className={styles.englishLabel}>{lang.name}</span>
                  </div>
                  {isSelected && <CheckIcon sx={{ fontSize: 14 }} className={styles.checkIcon} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
