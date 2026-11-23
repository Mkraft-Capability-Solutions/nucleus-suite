"use client";
import { readData } from '../../services/workspace-data.mjs';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { nucleusDarkTheme, nucleusLightTheme } from './theme';

/**
 * Tooltips float above the chart (rendered on <body>) instead of over the plotted data, so the series under the
 * cursor stays visible. Horizontally they follow the cursor, clamped to the chart's width.
 */
const TOOLTIP_OUTSIDE_PLOT = {
    confine: false,
    appendToBody: true,
    position: (point, _params, _dom, _rect, size) => {
        const [width, height] = size.contentSize;
        const x = Math.min(Math.max(point[0] - width / 2, 0), Math.max(size.viewSize[0] - width, 0));
        return [x, -height - 10];
    },
};
import { useHRMS } from '@/context/HRMSContext';

// Register themes once
let themesRegistered = false;
function ensureThemesRegistered() {
    if (themesRegistered) return;
    try {
        echarts.registerTheme('nucleus-dark', nucleusDarkTheme);
        echarts.registerTheme('nucleus-light', nucleusLightTheme);
        themesRegistered = true;
    } catch (e) {
        console.warn('ECharts theme registration:', e);
    }
}

/**
 * NucleusChart: Crisp, responsive ECharts component with hardware-accelerated animations
 * and automatic theme synchronization.
 */
export default function NucleusChart({
    option,
    style = { height: 280, width: '100%' },
    className = '',
    onEvents = {},
    renderer = readData("components.Charts.NucleusChart", "defaultValue_1"), // 'svg' for vector crispness or 'canvas'
    animationDelay = readData("components.Charts.NucleusChart", "defaultValue_2")
}) {
    const chartRef = useRef(null);
    const instanceRef = useRef(null);
    const { theme } = useHRMS();

    useEffect(() => {
        ensureThemesRegistered();

        if (!chartRef.current) return;

        // Dispose previous instance if theme changed
        if (instanceRef.current) {
            instanceRef.current.dispose();
        }

        const activeTheme = theme === 'dark' ? 'nucleus-dark' : 'nucleus-light';
        const chart = echarts.init(chartRef.current, activeTheme, {
            renderer,
        });
        instanceRef.current = chart;

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
        });
        resizeObserver.observe(chartRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.dispose();
            instanceRef.current = null;
        };
    }, [theme, renderer]);

    // Update event handlers without disposing the chart on every parent render.
    useEffect(() => {
        const chart = instanceRef.current;
        if (!chart || !onEvents) return;
        const entries = Object.entries(onEvents).filter(([, handler]) => typeof handler === 'function');
        entries.forEach(([name, handler]) => chart.on(name, handler));
        return () => { entries.forEach(([name, handler]) => chart.off(name, handler)); };
    }, [onEvents, theme, renderer]);

    // Update option whenever it changes
    useEffect(() => {
        if (!instanceRef.current || !option) return;

        // Ensure tooltips are safely confined inside chart container by default
        let resolvedTooltip = readData("components.Charts.NucleusChart", "resolvedTooltip_1");
        if (option.tooltip) {
            if (Array.isArray(option.tooltip)) {
                resolvedTooltip = option.tooltip.map(t => ({ ...readData("components.Charts.NucleusChart", "content_fields_2"), ...TOOLTIP_OUTSIDE_PLOT, ...t }));
            } else {
                resolvedTooltip = { ...readData("components.Charts.NucleusChart", "content_fields_3"), ...TOOLTIP_OUTSIDE_PLOT, ...option.tooltip };
            }
        }

        // Base animation configuration from Nucleus Design Kit
        const animatedOption = {
            ...readData("components.Charts.NucleusChart", "animatedOption_fields_4"),
            animationDelay: animationDelay,
            ...option,
            tooltip: resolvedTooltip,
        };

        instanceRef.current.setOption(animatedOption, readData("components.Charts.NucleusChart", "content_5"));
    }, [option, animationDelay]);

    return (
        <div
            ref={chartRef}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                minHeight: style.height || 220,
                ...style,
            }}
        />
    );
}
