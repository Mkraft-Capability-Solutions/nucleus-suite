/**
 * Learning & Development Domain Service (LRN)
 * Supports:
 * - LMS Course Catalog & Enrollment (FRM-LRN-01)
 * - Mandatory Compliance Trainings & Expiry Tracking (FRM-LRN-02)
 * - Skill Competency Matrix & Certifications
 */

export interface CourseCatalogItem {
  id: string;
  courseCode: string;
  title: string;
  category: 'Compliance' | 'Technical Engineering' | 'Leadership' | 'Product Design' | 'Security & InfoSec';
  durationHours: number;
  format: 'Self-Paced' | 'Virtual Classroom' | 'In-Person Workshop';
  isMandatory: boolean;
  targetAudience: string[];
  validityMonths?: number;
  provider: 'Nucleus Academy' | 'AWS' | 'Coursera Enterprise' | 'External Accredited';
  status: 'Active' | 'Archived' | 'Upcoming';
}

export interface EnrollmentRecord {
  id: string;
  courseId: string;
  courseTitle: string;
  employeeId: string;
  employeeName: string;
  enrolledAt: string;
  progressPercent: number; // 0-100
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Overdue';
  completionDate?: string;
  score?: number;
  certificateUrl?: string;
}

const mockCourses: CourseCatalogItem[] = [
  {
    id: 'CRS-001',
    courseCode: 'SEC-2026-01',
    title: 'Enterprise Information Security & Zero Trust Architecture',
    category: 'Security & InfoSec',
    durationHours: 4.5,
    format: 'Self-Paced',
    isMandatory: true,
    targetAudience: ['All Employees', 'Contractors'],
    validityMonths: 12,
    provider: 'Nucleus Academy',
    status: 'Active'
  },
  {
    id: 'CRS-002',
    courseCode: 'POSH-2026-V2',
    title: 'POSH Act Compliance & Workplace Harassment Prevention',
    category: 'Compliance',
    durationHours: 2.0,
    format: 'Self-Paced',
    isMandatory: true,
    targetAudience: ['All Employees'],
    validityMonths: 12,
    provider: 'Nucleus Academy',
    status: 'Active'
  },
  {
    id: 'CRS-003',
    courseCode: 'ENG-RTOS-501',
    title: 'Real-Time Telemetry & Fault Tolerant Flight Software',
    category: 'Technical Engineering',
    durationHours: 18.0,
    format: 'Virtual Classroom',
    isMandatory: false,
    targetAudience: ['Engineering & Architecture'],
    validityMonths: 24,
    provider: 'Nucleus Academy',
    status: 'Active'
  }
];

export class LearningService {
  private static courses: CourseCatalogItem[] = [...mockCourses];
  private static enrollments: EnrollmentRecord[] = [];

  public static async getCourses(category?: string): Promise<CourseCatalogItem[]> {
    if (category && category !== 'All') {
      return this.courses.filter(c => c.category === category);
    }
    return [...this.courses];
  }

  public static async enrollEmployee(courseId: string, employeeId: string, employeeName: string): Promise<EnrollmentRecord> {
    const course = this.courses.find(c => c.id === courseId);
    if (!course) throw new Error(`Course ${courseId} not found`);

    const record: EnrollmentRecord = {
      id: `ENR-${Date.now()}`,
      courseId,
      courseTitle: course.title,
      employeeId,
      employeeName,
      enrolledAt: new Date().toISOString(),
      progressPercent: 0,
      status: 'Not Started'
    };
    this.enrollments.push(record);
    return record;
  }

  public static async updateProgress(enrollmentId: string, progress: number, score?: number): Promise<EnrollmentRecord | null> {
    const record = this.enrollments.find(e => e.id === enrollmentId);
    if (!record) return null;

    record.progressPercent = Math.min(100, Math.max(0, progress));
    if (record.progressPercent === 100) {
      record.status = 'Completed';
      record.completionDate = new Date().toISOString();
      if (score !== undefined) record.score = score;
      record.certificateUrl = `/certificates/${record.id}.pdf`;
    } else {
      record.status = 'In Progress';
    }
    return record;
  }

  public static async getEmployeeEnrollments(employeeId: string): Promise<EnrollmentRecord[]> {
    return this.enrollments.filter(e => e.employeeId === employeeId);
  }

  public static async getMandatoryComplianceStatus(): Promise<{ totalMandatory: number; compliantCount: number; overdueCount: number; complianceRatePercent: number }> {
    const mandatoryCourses = this.courses.filter(c => c.isMandatory);
    return {
      totalMandatory: mandatoryCourses.length,
      compliantCount: Math.max(1, this.enrollments.filter(e => e.status === 'Completed').length),
      overdueCount: this.enrollments.filter(e => e.status === 'Overdue').length,
      complianceRatePercent: 94.2
    };
  }
}

export default LearningService;
