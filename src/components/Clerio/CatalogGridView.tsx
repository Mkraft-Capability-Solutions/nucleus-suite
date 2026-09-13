"use client";
import { useState } from 'react';
import { readData } from '@/services/workspace-data.mjs';
import { navigationDomains } from '@/lib/workspace-navigation';
import { canViewNavigationItem } from '@/lib/navigation-access';
import { useAuth } from '@/context/AuthContext';
import styles from './CatalogGridView.module.css';

type CatalogGridViewProps = {
    onSelectFeature?: (tab: string, domain: string, feature: string) => void;
    searchQuery?: string;
};

const CatalogGridView = ({ onSelectFeature, searchQuery = '' }: CatalogGridViewProps) => {
    const [filterCategory, setFilterCategory] = useState(readData("components.Clerio.CatalogGridView", "initialState_1"));

    const { user, isModuleAllowed, isConsoleAllowed } = useAuth();
    const catalogCards = navigationDomains.flatMap(domain => domain.groups.flatMap(group => group.items
        .filter(item => canViewNavigationItem(item, isModuleAllowed, user) && (!/^s(10|[1-9])$/i.test(item.id) || isConsoleAllowed(item.id.toUpperCase(), user?.role)))
        .map(item => ({ ...item, title: item.label, desc: item.desc || group.heading, domain: domain.id, tag: domain.label, iconColor: 'var(--signal)' }))));
    const categories = ['ALL', ...navigationDomains.map(domain => domain.label)];

    const filteredCards = catalogCards.filter(card => {
        const matchesCat = filterCategory === 'ALL' || card.tag === filterCategory;
        const matchesSearch = !searchQuery ||
            card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.tag.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
    });

    return (
        <div className={styles.catalogWrapper}>
            {/* Filter Pills */}
            <div className={styles.filtersBar}>
                <div className={styles.pillsRow}>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.filterPill} ${filterCategory === cat ? styles.filterPillActive : ''}`}
                            onClick={() => setFilterCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <div className={styles.countText}>{readData("components.Clerio.CatalogGridView", "CatalogGridView_text_88")}{filteredCards.length}{readData("components.Clerio.CatalogGridView", "CatalogGridView_text_89")}</div>
            </div>

            {/* Feature Cards Grid (Exact match to screenshot) */}
            <div className={styles.cardsGrid}>
                {filteredCards.map((card) => {
                    const Icon = card.icon;

                    return (
                        <button type="button"
                            key={card.id}
                            className={styles.cardItem}
                            onClick={() => {
                                if (onSelectFeature) {
                                    onSelectFeature(card.targetTab, card.domain, card.id);
                                }
                            }}
                        >
                            <div className={styles.cardTopRow}>
                                <div className={styles.iconCircle} style={{ color: card.iconColor }}>
                                    <Icon sx={{ fontSize: 18 }} />
                                </div>
                                <span className={styles.tagBadge}>{card.tag}</span>
                            </div>

                            <h4 className={styles.cardTitle}>{card.title}</h4>
                            <p className={styles.cardDesc}>{card.desc}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CatalogGridView;
