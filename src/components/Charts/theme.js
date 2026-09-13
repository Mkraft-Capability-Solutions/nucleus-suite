
import { readData } from '../../services/workspace-data.mjs';
/**
 * Nucleus HRMS — Chart Theme Tokens & Configuration
 * Derived from Nucleus Dark Dashboard Kit v1.0 (MultipliersKraft)
 */

export const NUCLEUS_COLORS = readData("components.Charts.theme", "NUCLEUS_COLORS_1");

// Fixed Categorical Series Order: Electric Cyan -> Royal Sapphire -> Electric Violet -> Amber -> Crisp Jade -> Coral -> Slate
export const NUCLEUS_SERIES_COLORS = [
    NUCLEUS_COLORS.cyan,
    NUCLEUS_COLORS.sapphire,
    NUCLEUS_COLORS.violet,
    NUCLEUS_COLORS.amber,
    NUCLEUS_COLORS.emerald,
    NUCLEUS_COLORS.coral,
    NUCLEUS_COLORS.slate,
];

export const nucleusDarkTheme = {
    color: NUCLEUS_SERIES_COLORS,
    ...readData("components.Charts.theme", "nucleusDarkTheme_fields_2"),
    textStyle: {
        ...readData("components.Charts.theme", "textStyle_fields_5"),
        color: NUCLEUS_COLORS.textPrimary,
        ...readData("components.Charts.theme", "textStyle_fields_6"),
    },
    title: {
        textStyle: {
            ...readData("components.Charts.theme", "textStyle_fields_7"),
            color: NUCLEUS_COLORS.textPrimary,
            ...readData("components.Charts.theme", "textStyle_fields_8"),
        },
        subtextStyle: {
            color: NUCLEUS_COLORS.textMuted,
            ...readData("components.Charts.theme", "subtextStyle_fields_9"),
        }
    },
    ...readData("components.Charts.theme", "nucleusDarkTheme_fields_3"),
    tooltip: {
        backgroundColor: NUCLEUS_COLORS.raised,
        borderColor: NUCLEUS_COLORS.lineStrong,
        ...readData("components.Charts.theme", "tooltip_fields_11"),
        textStyle: {
            color: NUCLEUS_COLORS.textPrimary,
            ...readData("components.Charts.theme", "textStyle_fields_14"),
        },
        ...readData("components.Charts.theme", "tooltip_fields_12"),
    },
    legend: {
        textStyle: {
            color: NUCLEUS_COLORS.textMuted,
            ...readData("components.Charts.theme", "textStyle_fields_16"),
        },
        ...readData("components.Charts.theme", "legend_fields_15"),
    },
    categoryAxis: {
        axisLine: {
            ...readData("components.Charts.theme", "axisLine_fields_19"),
            lineStyle: {
                color: NUCLEUS_COLORS.lineStrong,
                ...readData("components.Charts.theme", "lineStyle_fields_20"),
            }
        },
        ...readData("components.Charts.theme", "categoryAxis_fields_17"),
        axisLabel: {
            color: NUCLEUS_COLORS.textMuted,
            ...readData("components.Charts.theme", "axisLabel_fields_22"),
        },
        ...readData("components.Charts.theme", "categoryAxis_fields_18"),
    },
    valueAxis: {
        ...readData("components.Charts.theme", "valueAxis_fields_24"),
        axisLabel: {
            color: NUCLEUS_COLORS.textMuted,
            ...readData("components.Charts.theme", "axisLabel_fields_27"),
        },
        splitLine: {
            ...readData("components.Charts.theme", "splitLine_fields_28"),
            lineStyle: {
                color: NUCLEUS_COLORS.lineMuted,
                ...readData("components.Charts.theme", "lineStyle_fields_29"),
            }
        }
    },
    ...readData("components.Charts.theme", "nucleusDarkTheme_fields_4"),
    radar: {
        axisLine: {
            lineStyle: {
                color: NUCLEUS_COLORS.lineStrong,
            }
        },
        splitLine: {
            lineStyle: {
                color: NUCLEUS_COLORS.lineMuted,
            }
        },
        ...readData("components.Charts.theme", "radar_fields_31"),
        axisName: {
            color: NUCLEUS_COLORS.textMuted,
            ...readData("components.Charts.theme", "axisName_fields_33"),
        }
    }
};

export const nucleusLightTheme = readData("components.Charts.theme", "nucleusLightTheme_34");
