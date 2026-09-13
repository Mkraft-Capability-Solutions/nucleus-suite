"use client";

import React from 'react';
import { useHRMS } from '@/context/HRMSContext';
import MisReportingHub from './MisReportingHub';

/**
 * People Intelligence now uses the governed MIS workspace. Its report, source,
 * validation, risk-review and export views all share the same report data.
 */
export default function AnalyticsView({ onNavigate }) {
    const { misMasterData, setMisMasterData, showToast } = useHRMS();
    return <MisReportingHub misMasterData={misMasterData} setMisMasterData={setMisMasterData} showToast={showToast} onNavigate={onNavigate} />;
}
