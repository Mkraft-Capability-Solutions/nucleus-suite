import { afterAll, describe, expect, it } from "vitest";

import { picklistLabel } from "@/lib/picklists";
import {
  ACCEPTANCE_DEPARTMENT,
  DESIGNATIONS,
  LIVE,
  PLANT_LOCATION,
  accessFor,
  createScenarioEmployee,
  db,
  removeScenarioRows,
  tenantId,
  type ScenarioEmployee,
} from "@/server/acceptance/fixture";
import { listAnnouncementRegister } from "@/server/engagement/announcement-register";
import {
  audienceScopeFor,
  occasionKey,
  parseAudienceScopeConfig,
} from "@/server/engagement/occasion-announcements";
import { executeRecognitionCommand, loadRecognitionRegister } from "@/server/engagement/recognition-register";
import { awardReferral, listAnnouncements, referCandidate } from "@/server/engagement/service";
import { dispatchTask } from "@/server/jobs/handlers";
import { getLetterRecord, issueLetter, saveLetterTemplate } from "@/server/letters/service";
import {
  approveRequisition,
  createCandidate,
  createOffer,
  createRequisition,
  submitApplication,
  transitionOffer,
} from "@/server/talent/service";

/**
 * Client acceptance scenarios T-33 … T-36 (engagement: recognition, referral awards,
 * occasion announcements, letters). Each `it` is one workbook row from
 * `tmp/_audit/demo/10-acceptance-tests.md`, run against the live demo tenant through
 * the service functions the API routes call, never through HTTP.
 *
 * Opt in with MKRAFT_LIVE_VERIFY=1 after `scripts/seed-acceptance-demo.ts` has run.
 */

const TODAY = new Date().toISOString().slice(0, 10);
/** Far enough ahead that a requisition's "required by is not in the past" gate stays satisfied. */
const FUTURE_DATE = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
const SUFFIX = crypto.randomUUID().slice(0, 6).toUpperCase();

/** Rows each scenario creates outside the `T-nn-` employee prefix, removed in `afterAll`. */
const created = {
  t33: { programmeId: null as string | null, announcementIds: [] as string[], employees: [] as ScenarioEmployee[] },
  t34: {
    positionCode: `T-34-POS-${SUFFIX}`,
    requisitionId: null as string | null,
    candidateId: null as string | null,
    applicationId: null as string | null,
    offerId: null as string | null,
    referralId: null as string | null,
    schemeSetByThisRun: false,
  },
  t35: { occasionKeys: [] as string[] },
  t36: { templateCodes: [] as string[] },
};

describe.skipIf(!LIVE)("engagement acceptance (T-33 … T-36, live, opt-in)", () => {
  afterAll(async () => {
    const tenant = await tenantId();
    const client = db();

    // T-33: recognition events reference the scenario employee, so they go before it.
    for (const employee of created.t33.employees) {
      await client`delete from recognition_events where tenant_id = ${tenant} and (recipient_employee_id = ${employee.id} or nominator_employee_id = ${employee.id})`;
    }
    if (created.t33.announcementIds.length > 0) {
      await client`delete from feed_posts where tenant_id = ${tenant} and id = any(${created.t33.announcementIds}::uuid[])`;
    }
    if (created.t33.programmeId) {
      await client`delete from recognition_programs where tenant_id = ${tenant} and id = ${created.t33.programmeId}`;
    }
    await removeScenarioRows("T-33");

    // T-34: the award chain, then the hire the offer converted, then the opening.
    const t34 = created.t34;
    if (t34.referralId) {
      // The award points at the payroll input it created, and the FK RESTRICTs, so the
      // award goes first — the other order fails on the constraint every time.
      await client`delete from referral_awards where tenant_id = ${tenant} and referral_id = ${t34.referralId}`;
      await client`delete from payroll_inputs where tenant_id = ${tenant} and attributes->>'referral_id' = ${t34.referralId}`;
      await client`delete from referrals where tenant_id = ${tenant} and id = ${t34.referralId}`;
    }
    if (t34.candidateId) {
      const links = (await client`select employee_id, person_id from candidate_employee_links where tenant_id = ${tenant} and candidate_id = ${t34.candidateId}`) as Array<{ employee_id: string; person_id: string }>;
      await client`delete from candidate_employee_links where tenant_id = ${tenant} and candidate_id = ${t34.candidateId}`;
      for (const link of links) {
        await client`delete from employees where tenant_id = ${tenant} and id = ${link.employee_id}`;
        await client`delete from people where tenant_id = ${tenant} and id = ${link.person_id}`;
      }
    }
    if (t34.offerId) await client`delete from offers where tenant_id = ${tenant} and id = ${t34.offerId}`;
    if (t34.applicationId) {
      await client`delete from application_stage_history where tenant_id = ${tenant} and application_id = ${t34.applicationId}`;
      await client`delete from applications where tenant_id = ${tenant} and id = ${t34.applicationId}`;
    }
    if (t34.candidateId) await client`delete from candidates where tenant_id = ${tenant} and id = ${t34.candidateId}`;
    if (t34.requisitionId) await client`delete from requisitions where tenant_id = ${tenant} and id = ${t34.requisitionId}`;
    await client`delete from positions where tenant_id = ${tenant} and attributes->>'code' = ${t34.positionCode}`;
    if (t34.schemeSetByThisRun) {
      await client`update tenant_settings set settings = settings - 'referral_award_scheme' where tenant_id = ${tenant}`;
    }
    await removeScenarioRows("T-34");

    // T-35: only the announcements this run's employees raised.
    if (created.t35.occasionKeys.length > 0) {
      await client`delete from feed_posts where tenant_id = ${tenant} and attributes->>'auto_occasion_key' = any(${created.t35.occasionKeys}::text[])`;
    }
    await removeScenarioRows("T-35");

    // T-36: issued letters hang off their templates, so they go first.
    if (created.t36.templateCodes.length > 0) {
      await client`
        delete from generated_letters where tenant_id = ${tenant} and letter_template_id in (
          select id from letter_templates where tenant_id = ${tenant} and attributes->>'template_code' = any(${created.t36.templateCodes}::text[])
        )
      `;
      await client`delete from letter_templates where tenant_id = ${tenant} and attributes->>'template_code' = any(${created.t36.templateCodes}::text[])`;
    }
    await removeScenarioRows("T-36");
  }, 120_000);

  it("T-33: a star employee's selection publishes the announcement and stamps the certificate in one step", { timeout: 120_000 }, async () => {
    const tenant = await tenantId();
    const client = db();
    const supervisor = await accessFor("supervisor");
    const hr = await accessFor("hrManager");

    // The register invents no programme; the scenario brings its own, with no ceiling
    // and no window, so nothing is refused on the strength of configuration nobody set.
    const programmeId = crypto.randomUUID();
    await client`
      insert into recognition_programs (id, tenant_id, attributes)
      values (${programmeId}, ${tenant}, ${JSON.stringify({ code: `T-33-PROG-${SUFFIX}`, name: "Acceptance star programme", currency: "INR" })}::jsonb)
    `;
    created.t33.programmeId = programmeId;

    const nominee = await createScenarioEmployee({ test: "T-33", firstName: "Star", lastName: "Nominee" });
    created.t33.employees.push(nominee);

    const periodStart = "2026-08-01";
    const periodEnd = "2026-08-31";
    const awardCategory = "star_performer";
    const citation =
      "Kept the A-shift line above target for the whole of August while training two new operators on the safety procedure.";

    const nominated = await executeRecognitionCommand(
      supervisor,
      { action: "nominate", recipientEmployeeId: nominee.id, programmeId, awardCategory, citation, periodStart, periodEnd },
      crypto.randomUUID(),
    );
    expect(nominated.state).toBe("nominated");
    expect(nominated.announcementId).toBeNull();

    // One command: the committee approval. RL-492 raises the announcement with it.
    const approved = await executeRecognitionCommand(
      hr,
      { action: "approve", recognitionEventId: nominated.id },
      crypto.randomUUID(),
    );
    expect(approved.state).toBe("published");
    expect(approved.announcementId).not.toBeNull();
    created.t33.announcementIds.push(approved.announcementId!);
    expect(approved.certificate).not.toBeNull();
    expect(approved.certificate?.period).toEqual({ start: periodStart, end: periodEnd });
    expect(approved.certificate?.criteria.code).toBe(awardCategory);
    expect(approved.certificate?.reference).toMatch(/^CERT-REC-[0-9A-F]{8}$/);

    // The announcement carries the period and the award category.
    const criteriaLabel = picklistLabel("PL_AWARD_CATEGORY", awardCategory);
    const register = await listAnnouncementRegister(hr, { view: "register", state: "all", page: 1, pageSize: 100 });
    const announcement = register.items.find((item) => item.id === approved.announcementId);
    expect(announcement).toBeDefined();
    expect(announcement?.kind).toBe("star");
    expect(announcement?.autoGenerated).toBe(false);
    expect(announcement?.title).toContain(`${periodStart} to ${periodEnd}`);
    expect(announcement?.body).toContain(`Award period: ${periodStart} to ${periodEnd}`);
    expect(announcement?.body).toContain(`Nomination criteria: ${criteriaLabel}`);
    const feed = (await listAnnouncements(hr, null)) as Array<{ id: string }>;
    expect(feed.some((row) => row.id === approved.announcementId)).toBe(true);

    // The event's stamped certificate: period, criteria and credential reference.
    const events = await loadRecognitionRegister(hr, { employeeId: nominee.id });
    const event = events.items.find((item) => item.id === nominated.id);
    expect(event?.state).toBe("published");
    expect(event?.announcement?.id).toBe(approved.announcementId);
    expect(event?.certificate).not.toBeNull();
    expect(event?.certificate?.period).toEqual({ start: periodStart, end: periodEnd });
    expect(event?.certificate?.criteria).toEqual({ code: awardCategory, label: criteriaLabel });
    expect(event?.certificate?.reference).toBe(approved.certificate?.reference);
    expect(event?.certificate?.lines).toContain(`Award period: ${periodStart} to ${periodEnd}`);
    expect(event?.certificate?.lines).toContain(`Nomination criteria: ${criteriaLabel}`);
    const stored = (await client`select attributes->'certificate' as certificate from recognition_events where tenant_id = ${tenant} and id = ${nominated.id}`) as Array<{ certificate: Record<string, unknown> | null }>;
    expect(stored[0]?.certificate).toMatchObject({
      reference: approved.certificate?.reference,
      period: { start: periodStart, end: periodEnd },
      criteria: { code: awardCategory },
    });
  });

  it("T-34: a referral award reaches payroll as an input linked to the position code", { timeout: 120_000 }, async () => {
    const tenant = await tenantId();
    const client = db();
    const hr = await accessFor("hrManager");
    const referrer = await accessFor("supervisor");
    const referrerEmployeeId = referrer.context.employeeId;
    expect(referrerEmployeeId, "the seeded supervisor must be linked to an employee to refer anybody").toBeTruthy();

    // The workbook states no award amount, so the seed leaves the scheme unset. A
    // scheme already present would be a leftover, not the seed's contract.
    const before = (await client`select settings from tenant_settings where tenant_id = ${tenant} limit 1`) as Array<{ settings: Record<string, unknown> | null }>;
    expect(before[0]?.settings?.referral_award_scheme, "tenant_settings.settings.referral_award_scheme must be unset before T-34").toBeUndefined();

    // The requisition is raised against the sanction the seed approved for the
    // acceptance department, whichever designation that line names.
    const sanction = (await client`
      select l.designation from vp_manpower_lines l
      join departments d on d.id = l.department_id and d.tenant_id = l.tenant_id
      where l.tenant_id = ${tenant} and l.status = 'approved' and d.attributes->>'name' = ${ACCEPTANCE_DEPARTMENT}
      order by l.plan_year desc limit 1
    `) as Array<{ designation: string }>;
    expect(sanction[0]?.designation, `no approved manpower line exists for department "${ACCEPTANCE_DEPARTMENT}"`).toBeTruthy();
    const designation = sanction[0]!.designation;

    const requisition = await createRequisition(
      hr,
      {
        title: "Acceptance referral opening",
        departmentName: ACCEPTANCE_DEPARTMENT,
        positionCode: created.t34.positionCode,
        requisitionType: "addition",
        positions: 1,
        designation,
        locationCode: PLANT_LOCATION,
        workerClass: "workman_permanent",
        hiringManagerEmployeeId: referrerEmployeeId!,
        requiredBy: FUTURE_DATE,
        employmentType: "permanent",
        ctcMinMinor: 3_00_000_00,
        ctcMaxMinor: 4_50_000_00,
        justification: "Acceptance scenario T-34: one opening for a referred hire against sanctioned strength.",
        qualificationRequired: "ITI or 10th with mill-floor experience",
        experienceMinYears: 1,
        experienceMaxYears: 5,
        skills: ["ring frame operation"],
      },
      crypto.randomUUID(),
    );
    created.t34.requisitionId = requisition.id;
    const approval = await approveRequisition(hr, requisition.id, { override: false, recruiterEmployeeId: referrerEmployeeId! }, crypto.randomUUID());
    expect(approval.status).toBe("approved");

    const candidate = await createCandidate(hr, {
      name: "Referred Candidate",
      email: `t34-${SUFFIX.toLowerCase()}@acceptance.test`,
      phone: `+9198${String(Date.now()).slice(-8)}`,
      source: "employee_referral",
      referrerEmployeeId: referrerEmployeeId!,
      totalExperienceYears: 3,
    });
    created.t34.candidateId = candidate.id;

    const referral = await referCandidate(referrer, { requisitionId: requisition.id, candidateId: candidate.id, relationship: "former_colleague" });
    created.t34.referralId = referral.id;
    expect(referral.status).toBe("referred");

    // Convert the hire through the offer: accept links the candidate to a new employee.
    const application = await submitApplication(hr, { requisitionId: requisition.id, candidateId: candidate.id, extractionId: crypto.randomUUID(), consent: true }, crypto.randomUUID());
    created.t34.applicationId = application.id;
    const offer = await createOffer(
      hr,
      {
        applicationId: application.id,
        positionCode: created.t34.positionCode,
        designationCode: designation,
        band: "E3",
        locationCode: PLANT_LOCATION,
        workerClass: "workman_permanent",
        employmentType: "permanent",
        offeredCtcMinor: 4_200_000,
        basicMinor: 3_000_000,
        currency: "INR",
        joiningBonusMinor: 0,
        clawbackMonths: 0,
        // A future joining date, so T-35's joiner sweep does not pick this hire up.
        joiningDate: FUTURE_DATE,
        letterTemplateId: "T-34-OFFER",
      },
      crypto.randomUUID(),
    );
    created.t34.offerId = offer.id;
    await transitionOffer(hr, offer.id, { action: "send", releaseChannel: "email" }, crypto.randomUUID());
    const accepted = await transitionOffer(hr, offer.id, { action: "accept" }, crypto.randomUUID());
    expect(accepted.status).toBe("accepted");
    expect((accepted as { employeeId?: string }).employeeId).toBeTruthy();
    const links = (await client`select employee_id from candidate_employee_links where tenant_id = ${tenant} and candidate_id = ${candidate.id}`) as Array<{ employee_id: string }>;
    expect(links).toHaveLength(1);

    // The joining leg with no scheme configured: refused by name, nothing invented.
    await expect(awardReferral(hr, referral.id, { milestone: "joining", tenureDays: 0 }, crypto.randomUUID()))
      .rejects.toMatchObject({ status: 422, code: "REFERRAL_SCHEME_INCOMPLETE" });
    const noInputs = (await client`select count(*)::int as total from payroll_inputs where tenant_id = ${tenant} and attributes->>'referral_id' = ${referral.id}`) as Array<{ total: number }>;
    expect(noInputs[0]?.total).toBe(0);

    // A demo scheme, labelled as such: the figures are this scenario's, not the client's.
    await client`
      update tenant_settings
      set settings = coalesce(settings, '{}'::jsonb) || ${JSON.stringify({
        referral_award_scheme: {
          code: "T-34-DEMO-SCHEME-NOT-CLIENT-POLICY",
          currency: "INR",
          joiningAmountMinor: 100_000,
          confirmationAmountMinor: 200_000,
          confirmationTenureDays: 90,
        },
      })}::jsonb
      where tenant_id = ${tenant}
    `;
    created.t34.schemeSetByThisRun = true;

    const joining = await awardReferral(hr, referral.id, { milestone: "joining", tenureDays: 0 }, crypto.randomUUID());
    expect(joining.status).toBe("payable");
    expect(joining.milestone).toBe("joining");
    expect(joining.amountMinor).toBe(100_000);
    expect(joining.positionCode).toBe(created.t34.positionCode);
    expect(joining.payrollInputId).toBeTruthy();
    const inputs = (await client`
      select id, employee_id, attributes from payroll_inputs
      where tenant_id = ${tenant} and attributes->>'referral_id' = ${referral.id}
    `) as Array<{ id: string; employee_id: string; attributes: Record<string, unknown> }>;
    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.id).toBe(joining.payrollInputId);
    expect(inputs[0]?.employee_id).toBe(referrerEmployeeId);
    expect(inputs[0]?.attributes).toMatchObject({
      component: "referral_award",
      milestone: "joining",
      position_code: created.t34.positionCode,
      amount_minor: 100_000,
    });
    const award = (await client`select payroll_input_id, attributes from referral_awards where tenant_id = ${tenant} and referral_id = ${referral.id}`) as Array<{ payroll_input_id: string | null; attributes: Record<string, unknown> }>;
    expect(award[0]?.payroll_input_id).toBe(joining.payrollInputId);
    expect(award[0]?.attributes).toMatchObject({ milestone: "joining", position_code: created.t34.positionCode, status: "payable" });

    // The same leg twice is refused per leg (409).
    await expect(awardReferral(hr, referral.id, { milestone: "joining", tenureDays: 0 }, crypto.randomUUID()))
      .rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });

    // The confirmation leg is a distinct leg: gated on the scheme's tenure, then its own input.
    await expect(awardReferral(hr, referral.id, { milestone: "confirmation", tenureDays: 40 }, crypto.randomUUID()))
      .rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
    const confirmation = await awardReferral(hr, referral.id, { milestone: "confirmation", tenureDays: 95 }, crypto.randomUUID());
    expect(confirmation.status).toBe("payable");
    expect(confirmation.milestone).toBe("confirmation");
    expect(confirmation.amountMinor).toBe(200_000);
    expect(confirmation.payrollInputId).not.toBe(joining.payrollInputId);
    const legs = (await client`
      select attributes->>'milestone' as milestone from payroll_inputs
      where tenant_id = ${tenant} and attributes->>'referral_id' = ${referral.id} order by 1
    `) as Array<{ milestone: string }>;
    expect(legs.map((row) => row.milestone)).toEqual(["confirmation", "joining"]);
    const status = (await client`select attributes->>'status' as status from referrals where tenant_id = ${tenant} and id = ${referral.id}`) as Array<{ status: string }>;
    expect(status[0]?.status).toBe("awarded");
    await expect(awardReferral(hr, referral.id, { milestone: "confirmation", tenureDays: 95 }, crypto.randomUUID()))
      .rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" });
  });

  it("T-35: birthday and new-joiner announcements raise themselves, scoped and idempotent", { timeout: 120_000 }, async () => {
    const tenant = await tenantId();
    const client = db();
    const hr = await accessFor("hrManager");

    const birthdayEmployee = await createScenarioEmployee({
      test: "T-35",
      firstName: "Birthday",
      lastName: "Colleague",
      location: PLANT_LOCATION,
      dateOfBirth: `1990-${TODAY.slice(5)}`,
    });
    const joiner = await createScenarioEmployee({
      test: "T-35",
      firstName: "New",
      lastName: "Joiner",
      location: PLANT_LOCATION,
      joiningDate: TODAY,
      dateOfBirth: "1992-01-01",
    });
    const birthdayKey = occasionKey("birthday", birthdayEmployee.id, TODAY);
    const joinerKey = occasionKey("joiner", joiner.id, TODAY);
    created.t35.occasionKeys.push(birthdayKey, joinerKey, occasionKey("birthday", joiner.id, TODAY), occasionKey("joiner", birthdayEmployee.id, TODAY));

    const first = (await dispatchTask(hr, "engagement.announce_occasions", { asOf: TODAY })) as { birthdays: number; joiners: number; skipped: string[] };
    expect(first.birthdays).toBeGreaterThanOrEqual(1);
    expect(first.joiners).toBeGreaterThanOrEqual(1);
    expect(first.skipped.filter((reason) => reason.includes(birthdayEmployee.code) || reason.includes(joiner.code))).toEqual([]);

    // The audience each occasion reaches is the configured scope (workbook defaults:
    // birthday → location, joiner → all), resolved against the employee's own record.
    const settingsRows = (await client`select settings from tenant_settings where tenant_id = ${tenant} limit 1`) as Array<{ settings: Record<string, unknown> | null }>;
    const scopes = parseAudienceScopeConfig(settingsRows[0]?.settings?.announcement_audience_scope);
    const expectedAudience = (kind: "birthday" | "joiner", employee: { department: string; location: string; designation: string }) => {
      const scope = audienceScopeFor(kind, scopes);
      if (scope === "all") return "all";
      return `${scope}:${employee[scope]}`;
    };
    const record = { department: ACCEPTANCE_DEPARTMENT, location: PLANT_LOCATION, designation: DESIGNATIONS.operator.title };

    const posts = (await client`
      select id, attributes from feed_posts
      where tenant_id = ${tenant} and attributes->>'auto_occasion_key' = any(${[birthdayKey, joinerKey]}::text[])
    `) as Array<{ id: string; attributes: Record<string, unknown> }>;
    expect(posts).toHaveLength(2);
    const birthdayPost = posts.find((row) => row.attributes.auto_occasion_key === birthdayKey);
    const joinerPost = posts.find((row) => row.attributes.auto_occasion_key === joinerKey);
    expect(birthdayPost?.attributes).toMatchObject({
      is_auto_generated: true,
      kind: "birthday",
      announcement_type: "celebration",
      audience: expectedAudience("birthday", record),
    });
    expect(String(birthdayPost?.attributes.title)).toContain("Birthday Colleague");
    expect(joinerPost?.attributes).toMatchObject({
      is_auto_generated: true,
      kind: "joiner",
      announcement_type: "celebration",
      audience: expectedAudience("joiner", record),
    });
    expect(String(joinerPost?.attributes.title)).toContain("New Joiner");

    // The register reads the same flag: raised by the system, not typed.
    const register = await listAnnouncementRegister(hr, { view: "register", state: "all", page: 1, pageSize: 100 });
    for (const key of [birthdayKey, joinerKey]) {
      const row = register.items.find((item) => item.occasionKey === key);
      expect(row, `announcement for ${key} in the register`).toBeDefined();
      expect(row?.autoGenerated).toBe(true);
    }

    // A second run the same day writes nothing: the occasion keys are already there.
    const second = (await dispatchTask(hr, "engagement.announce_occasions", { asOf: TODAY })) as { birthdays: number; joiners: number };
    expect(second).toMatchObject({ birthdays: 0, joiners: 0 });
    const after = (await client`
      select count(*)::int as total from feed_posts
      where tenant_id = ${tenant} and attributes->>'auto_occasion_key' = any(${[birthdayKey, joinerKey]}::text[])
    `) as Array<{ total: number }>;
    expect(after[0]?.total).toBe(2);
  });

  it("T-36: a letter issues from a template and reproduces exactly as sent", { timeout: 120_000 }, async () => {
    const tenant = await tenantId();
    const client = db();
    const hr = await accessFor("hrManager");

    // A template naming a field the employee record cannot supply fails on save.
    const badCode = `T-36-BAD-${SUFFIX}`;
    created.t36.templateCodes.push(badCode);
    await expect(
      saveLetterTemplate(
        hr,
        {
          templateCode: badCode,
          templateName: "Appointment (bad merge field)",
          letterType: "appointment",
          version: "v1",
          subject: "Appointment letter for {{name}}",
          body: "Dear {{name}}, you are appointed as {{designation}} in grade {{employee_grade}} with effect from {{doj}}.",
          approvalRequired: false,
          reason: "T-36: a template with a non-existent merge field",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "POLICY_VIOLATION",
      details: [{ field: "employee_grade", issue: expect.stringContaining("employee_grade") }],
    });
    const badRows = (await client`select id from letter_templates where tenant_id = ${tenant} and attributes->>'template_code' = ${badCode}`) as Array<{ id: string }>;
    expect(badRows).toHaveLength(0);

    // A valid appointment template: record fields plus one manual field.
    const code = `T-36-APPT-${SUFFIX}`;
    created.t36.templateCodes.push(code);
    const originalSubject = "Appointment letter for {{name}}";
    const body = [
      "Dear {{name}},",
      "We are pleased to appoint you as {{designation}} at {{location}} with effect from {{doj}}.",
      "You will report to {{reporting_to}}. Your probation period is {{probation_months}} months.",
    ].join("\n");
    const template = await saveLetterTemplate(
      hr,
      {
        templateCode: code,
        templateName: "Appointment letter (acceptance)",
        letterType: "appointment",
        version: "v1",
        subject: originalSubject,
        body,
        approvalRequired: false,
        reason: "T-36: appointment template",
      },
      crypto.randomUUID(),
    );
    expect(template.created).toBe(true);
    expect(template.mergeFields).toEqual(["name", "designation", "location", "doj", "reporting_to", "probation_months"]);

    const employee = await createScenarioEmployee({ test: "T-36", firstName: "Meera", lastName: "Acceptance", joiningDate: "2026-07-01" });

    const issued = await issueLetter(
      hr,
      {
        letterType: "appointment",
        templateId: template.id,
        employeeId: employee.id,
        effectiveDate: TODAY,
        approver: "HR Manager",
        deliveryChannels: ["email"],
        acknowledgementRequired: true,
        manualFields: { probation_months: "6" },
        reason: "T-36: appointment letter issued",
      },
      crypto.randomUUID(),
    );
    expect(issued.reference).toMatch(/^LTR-\d{4}-[0-9A-F]{6}$/);

    const opened = await getLetterRecord(hr, issued.id, "issue");
    expect(opened.record.status).toBe("issued");
    expect(opened.record.version).toBe("v1");
    expect(opened.snapshot?.available).toBe(true);
    expect(opened.snapshot?.source).toBe("template_at_issue");
    expect(opened.snapshot?.subject).toBe("Appointment letter for Meera Acceptance");
    expect(opened.snapshot?.body).toContain("Dear Meera Acceptance,");
    expect(opened.snapshot?.body).toContain(`as ${DESIGNATIONS.operator.title} at ${PLANT_LOCATION} with effect from 2026-07-01`);
    expect(opened.snapshot?.body).toContain("probation period is 6 months");
    expect(opened.snapshot?.body).not.toContain("{{");
    expect(opened.snapshot?.mergeValues).toMatchObject({ name: "Meera Acceptance", doj: "2026-07-01", probation_months: "6" });
    expect(opened.snapshot?.mergeValues.reporting_to).toBeTruthy();
    const sentSubject = opened.snapshot!.subject;
    const sentBody = opened.snapshot!.body;

    // The template moves on; the letter already out does not.
    const revised = await saveLetterTemplate(
      hr,
      {
        templateCode: code,
        templateName: "Appointment letter (acceptance)",
        letterType: "appointment",
        version: "v2",
        subject: "REVISED appointment letter for {{name}}",
        body: `${body}\nThis line was added after the first letter was issued.`,
        approvalRequired: false,
        reason: "T-36: subject changed after issue",
      },
      crypto.randomUUID(),
    );
    expect(revised.created).toBe(false);
    expect(revised.id).toBe(template.id);
    const templateNow = await getLetterRecord(hr, template.id, "template");
    expect((templateNow.record as { subject?: string }).subject).toBe("REVISED appointment letter for {{name}}");

    const reopened = await getLetterRecord(hr, issued.id, "issue");
    expect(reopened.record.version).toBe("v1");
    expect(reopened.snapshot?.subject).toBe(sentSubject);
    expect(reopened.snapshot?.body).toBe(sentBody);
    expect(reopened.snapshot?.subject).not.toContain("REVISED");
    expect(reopened.snapshot?.body).not.toContain("added after");

    // An issue with a manual field left unfilled is refused: no letter with a hole in it.
    await expect(
      issueLetter(
        hr,
        {
          letterType: "appointment",
          templateId: template.id,
          employeeId: employee.id,
          effectiveDate: TODAY,
          approver: "HR Manager",
          deliveryChannels: ["email"],
          acknowledgementRequired: true,
          reason: "T-36: attempt without the manual field",
        },
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "POLICY_VIOLATION",
      details: [{ field: "probation_months", issue: expect.stringContaining("manualFields") }],
    });
    const issues = (await client`select count(*)::int as total from generated_letters where tenant_id = ${tenant} and employee_id = ${employee.id}`) as Array<{ total: number }>;
    expect(issues[0]?.total).toBe(1);
  });
});
