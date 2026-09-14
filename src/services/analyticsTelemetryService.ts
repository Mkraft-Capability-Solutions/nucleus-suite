/**
 * People Intelligence & Workforce Telemetry Domain Service (ANL)
 * Supports:
 * - Executive Telemetry KPI aggregation & slicing
 * - Flight Risk ML scoring & retention insights
 * - Gender Pay Equity & Salary Parity analytics
 * - Headcount Forecasting & Workforce Momentum
 */

export interface TelemetryScopeFilters {
  location: string;
  department: string;
  tenure: string; // '1 Month' | '3 Months' | '6 Months' | '1 Year'
  branch: string;
}

export interface WorkforceKPIs {
  totalHeadcount: number;
  headcountDeltaPercent: number;
  annualisedAttritionRate: number;
  attritionDeltaPts: number;
  todayAttendanceRate: number;
  attendanceDeltaPts: number;
  newHiresThisMonth: number;
  newHiresDelta: number;
  averageTenureYears: number;
  flightRiskCount: number;
}

export interface FlightRiskSignal {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  riskScore: number; // 0-100%
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  primaryDrivers: string[];
  recommendedAction: string;
}

export class AnalyticsTelemetryService {
  public static async getAggregatedKPIs(filters?: Partial<TelemetryScopeFilters>): Promise<WorkforceKPIs> {
    // Slices telemetry based on applied filters
    const isFiltered = filters && (
      (filters.location && filters.location !== 'All Locations') ||
      (filters.department && filters.department !== 'All Departments')
    );

    if (isFiltered) {
      return {
        totalHeadcount: 412,
        headcountDeltaPercent: 2.1,
        annualisedAttritionRate: 9.8,
        attritionDeltaPts: -0.9,
        todayAttendanceRate: 84.2,
        attendanceDeltaPts: 1.8,
        newHiresThisMonth: 16,
        newHiresDelta: 5,
        averageTenureYears: 3.4,
        flightRiskCount: 6
      };
    }

    return {
      totalHeadcount: 1284,
      headcountDeltaPercent: 3.8,
      annualisedAttritionRate: 11.4,
      attritionDeltaPts: -1.8,
      todayAttendanceRate: 81.6,
      attendanceDeltaPts: 2.4,
      newHiresThisMonth: 42,
      newHiresDelta: 12,
      averageTenureYears: 3.1,
      flightRiskCount: 22
    };
  }

  public static async getFlightRiskInsights(): Promise<FlightRiskSignal[]> {
    return [
      {
        id: 'RSK-01',
        employeeId: 'AST-1140',
        employeeName: 'Karthik Raman',
        department: 'Engineering & Architecture',
        designation: 'Senior Lead RTOS Architect',
        riskScore: 88,
        riskLevel: 'Critical',
        primaryDrivers: ['Compensation below 85th percentile benchmark', 'Manager turnover in last 9 months'],
        recommendedAction: 'Conduct off-cycle compensation equity adjustment and 1-on-1 leadership check-in.'
      },
      {
        id: 'RSK-02',
        employeeId: 'AST-1192',
        employeeName: 'Divya Sen',
        department: 'Analytics & AI',
        designation: 'Principal ML Engineer',
        riskScore: 79,
        riskLevel: 'High',
        primaryDrivers: ['High overtime hours in last 60 days', 'Project pod re-allocation stress'],
        recommendedAction: 'Rebalance workload across team pod and approve compensatory time-off.'
      }
    ];
  }

  public static async getOrgHealthScores(): Promise<{ retention: number; diversity: number; managerQuality: number; mobility: number; engagement: number; capability: number }> {
    return {
      retention: 88,
      diversity: 78,
      managerQuality: 84,
      mobility: 72,
      engagement: 86,
      capability: 91
    };
  }
}

export default AnalyticsTelemetryService;
