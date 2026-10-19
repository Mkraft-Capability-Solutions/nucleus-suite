/**
 * Seed live enterprise data into PostgreSQL operational tables:
 * - job_requisitions
 * - onboarding_instances
 * - performance_reviews
 * - learning_paths
 * - contractor_workforce
 * - helpdesk_tickets
 * - project_workforce
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  console.log('Checking and seeding operational tables in PostgreSQL...');
  
  // Get active tenant
  const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
  if (tenantRes.rows.length === 0) {
    throw new Error('No tenant found');
  }
  const tenantId = tenantRes.rows[0].id;
  console.log(`Using Tenant ID: ${tenantId}`);

  // 1. Job Requisitions
  const reqCheck = await pool.query('SELECT count(*) FROM job_requisitions');
  if (parseInt(reqCheck.rows[0].count, 10) === 0) {
    console.log('Seeding job_requisitions...');
    const reqs = [
      {
        reqCode: 'REQ-ENG-2026-08',
        title: 'Senior Flight Software Engineer',
        department: 'Engineering & Architecture',
        location: 'Bengaluru Campus (HQ)',
        hiringManager: 'Dr. Priya Sundaram',
        openPositions: 3,
        filledPositions: 1,
        salaryMin: 2800000,
        salaryMax: 4200000,
        currency: 'INR',
        employmentType: 'Full-time',
        experienceLevel: 'Senior',
        status: 'Open',
        targetDate: '2026-10-31',
      },
      {
        reqCode: 'REQ-DS-2026-12',
        title: 'Principal Telemetry AI Specialist',
        department: 'Analytics & AI',
        location: 'Pune Tech Park',
        hiringManager: 'Vikramaditya Rao',
        openPositions: 2,
        filledPositions: 0,
        salaryMin: 3500000,
        salaryMax: 5500000,
        currency: 'INR',
        employmentType: 'Full-time',
        experienceLevel: 'Lead',
        status: 'Open',
        targetDate: '2026-11-15',
      },
      {
        reqCode: 'REQ-OPS-2026-03',
        title: 'Enterprise Payroll Compliance Lead',
        department: 'Finance, Tax & Legal',
        location: 'Hyderabad R&D Hub',
        hiringManager: 'Meera Nambiar',
        openPositions: 1,
        filledPositions: 1,
        salaryMin: 2200000,
        salaryMax: 3000000,
        currency: 'INR',
        employmentType: 'Full-time',
        experienceLevel: 'Senior',
        status: 'Closed',
        targetDate: '2026-09-01',
      }
    ];

    for (const r of reqs) {
      await pool.query(
        `INSERT INTO job_requisitions (tenant_id, status, attributes, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [tenantId, r.status, JSON.stringify(r)]
      );
    }
    console.log(`Seeded ${reqs.length} job_requisitions.`);
  }

  // 2. Onboarding Instances
  const onbCheck = await pool.query('SELECT count(*) FROM onboarding_instances');
  if (parseInt(onbCheck.rows[0].count, 10) === 0) {
    console.log('Seeding onboarding_instances...');
    const empRes = await pool.query('SELECT id FROM employees WHERE tenant_id = $1 LIMIT 2', [tenantId]);
    const emp1 = empRes.rows[0]?.id;
    const emp2 = empRes.rows[1]?.id || emp1;

    const onbs = [
      {
        candidateName: 'Tanvi Agarwal',
        email: 'tanvi.agarwal@example.com',
        phone: '+91 99887 66554',
        designation: 'Senior Avionics UI Architect',
        department: 'Engineering & Architecture',
        location: 'Bengaluru Campus (HQ)',
        joiningDate: '2026-10-01',
        reportingManager: 'Dr. Priya Sundaram',
        buddyName: 'Rohan Mehra',
        status: 'Pre-Boarding',
        progressPercent: 65,
        employeeId: emp1,
        documentsSubmitted: [
          { documentType: 'PAN Card', fileName: 'pan_card_tanvi.pdf', isVerified: true },
          { documentType: 'Aadhaar Card', fileName: 'aadhaar_tanvi.pdf', isVerified: true },
          { documentType: 'Degree Certificate', fileName: 'degree_btech.pdf', isVerified: false },
          { documentType: 'Relieving Letter', fileName: 'prev_relieving.pdf', isVerified: false }
        ],
        itChecklist: [
          { item: 'MacBook Pro M3 Max (36GB RAM)', isProvisioned: true },
          { item: 'YubiKey Security Key', isProvisioned: true },
          { item: 'GitHub Enterprise & Cloud SSO', isProvisioned: false },
          { item: 'Workspace Access Card', isProvisioned: false }
        ],
        bgvStatus: 'Clear',
      },
      {
        candidateName: 'Rahul Varma',
        email: 'rahul.varma@example.com',
        phone: '+91 97766 55443',
        designation: 'Principal Flight Control Firmware Engineer',
        department: 'Engineering & Architecture',
        location: 'Hyderabad R&D Hub',
        joiningDate: '2026-10-15',
        reportingManager: 'Vikramaditya Rao',
        buddyName: 'Ananya Deshmukh',
        status: 'Day 1 Pending',
        progressPercent: 40,
        employeeId: emp2,
        documentsSubmitted: [
          { documentType: 'Passport Copy', fileName: 'passport_rahul.pdf', isVerified: true },
          { documentType: 'Bank Account & Cheque', fileName: 'cancelled_cheque.pdf', isVerified: true }
        ],
        itChecklist: [
          { item: 'Lenovo ThinkPad P1 Gen 7', isProvisioned: true },
          { item: 'CAN Bus Analyzer & Hardware Rig', isProvisioned: false }
        ],
        bgvStatus: 'Pending',
      }
    ];

    for (const o of onbs) {
      await pool.query(
        `INSERT INTO onboarding_instances (tenant_id, employee_id, record_status, attributes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [tenantId, o.employeeId, o.status, JSON.stringify(o)]
      );
    }
    console.log(`Seeded ${onbs.length} onboarding_instances.`);
  }

  // 3. Performance Reviews
  const prfCheck = await pool.query('SELECT count(*) FROM performance_reviews');
  if (parseInt(prfCheck.rows[0].count, 10) === 0) {
    console.log('Seeding performance_reviews...');
    const reviews = [
      {
        employeeName: 'Dr. Priya Sundaram',
        cycle: '2026-H1',
        selfScore: 4.8,
        managerScore: 4.9,
        peerScore: 4.7,
        finalCalibratedScore: 4.85,
        potentialRating: 'High',
        performanceRating: 'Outstanding',
        nineBoxPosition: 'Star',
        status: 'Signed Off',
      },
      {
        employeeName: 'Aditya Sen',
        cycle: '2026-H1',
        selfScore: 4.2,
        managerScore: 4.1,
        peerScore: 4.3,
        finalCalibratedScore: 4.2,
        potentialRating: 'Medium',
        performanceRating: 'Meets Expectations',
        nineBoxPosition: 'Core Player',
        status: 'Manager Review',
      }
    ];

    for (const rev of reviews) {
      await pool.query(
        `INSERT INTO performance_reviews (tenant_id, status, attributes, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [tenantId, rev.status, JSON.stringify(rev)]
      );
    }
    console.log(`Seeded ${reviews.length} performance_reviews.`);
  }

  // 4. Learning Paths
  const lrnCheck = await pool.query('SELECT count(*) FROM learning_paths');
  if (parseInt(lrnCheck.rows[0].count, 10) === 0) {
    console.log('Seeding learning_paths...');
    const courses = [
      {
        courseCode: 'SEC-2026-01',
        title: 'Enterprise Information Security & Zero Trust Architecture',
        category: 'Security & InfoSec',
        durationHours: 4.5,
        format: 'Self-Paced',
        isMandatory: true,
        targetAudience: ['All Employees', 'Contractors'],
        validityMonths: 12,
        provider: 'Nucleus Academy',
        status: 'Active',
      },
      {
        courseCode: 'POSH-2026-V2',
        title: 'POSH Act Compliance & Workplace Harassment Prevention',
        category: 'Compliance',
        durationHours: 2.0,
        format: 'Self-Paced',
        isMandatory: true,
        targetAudience: ['All Employees'],
        validityMonths: 12,
        provider: 'Nucleus Academy',
        status: 'Active',
      }
    ];

    for (const c of courses) {
      await pool.query(
        `INSERT INTO learning_paths (tenant_id, record_status, attributes, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [tenantId, c.status, JSON.stringify(c)]
      );
    }
    console.log(`Seeded ${courses.length} learning_paths.`);
  }

  // 5. Contractor Workforce
  const conCheck = await pool.query('SELECT count(*) FROM contractor_workforce');
  if (parseInt(conCheck.rows[0].count, 10) === 0) {
    console.log('Seeding contractor_workforce...');
    const contractors = [
      {
        contractorCode: 'CON-2026-081',
        fullName: 'Karthik Ramanathan',
        vendorName: 'TalentX Global Staffing Solutions',
        podOrDepartment: 'Flight Systems Software Pod',
        reportingManager: 'Dr. Priya Sundaram',
        hourlyRate: 2400,
        currency: 'INR',
        sowNumber: 'SOW-TX-2026-01',
        startDate: '2026-02-01',
        endDate: '2026-11-30',
        bgvStatus: 'Verified',
        complianceGatePass: true,
        status: 'Active',
      },
      {
        contractorCode: 'CON-2026-094',
        fullName: 'Sneha Patel',
        vendorName: 'Apex Precision Engineering Talent',
        podOrDepartment: 'Ground Station Telemetry Pod',
        reportingManager: 'Vikramaditya Rao',
        hourlyRate: 2800,
        currency: 'INR',
        sowNumber: 'SOW-APEX-2026-04',
        startDate: '2026-03-15',
        endDate: '2026-10-31',
        bgvStatus: 'Verified',
        complianceGatePass: true,
        status: 'Active',
      }
    ];

    for (const con of contractors) {
      await pool.query(
        `INSERT INTO contractor_workforce (tenant_id, status, attributes, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [tenantId, con.status, JSON.stringify(con)]
      );
    }
    console.log(`Seeded ${contractors.length} contractor_workforce.`);
  }

  console.log('All operational tables successfully verified and seeded in PostgreSQL.');
  await pool.end();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
