import { describe, expect, it } from "vitest";
import type { PatientSummary } from "@/lib/patients";
import {
  containsKnownVariable,
  type OrgVarSource,
  type PatientVarSource,
  patientVarsFromSummary,
  resolveTemplateVariables,
  variableLabel,
} from "./template-variables";

// A fixed "now" so age and {{date.today}} are deterministic.
const NOW = new Date(2026, 5, 21); // 21 Jun 2026 (local)

const SUNITA: PatientVarSource = {
  name: "Sunita Devi",
  birthdate: "1990-01-15",
  gender: "FEMALE",
  identifier: "MRN-0042",
  phone: "+91 98765 43210",
};

const CLINIC: OrgVarSource = {
  name: "Bizen Rural Health Centre",
  address: "12 Station Road, Jaipur",
  phone: "+91 141 222 3344",
  email: "care@bizen.example",
  website: "https://bizen.example",
  tagline: "Care close to home",
  registrationNo: "RJ-CLINIC-9981",
  taxId: "08ABCDE1234F1Z5",
};

const resolve = (content: string, patient: PatientVarSource | null) =>
  resolveTemplateVariables(content, { patient, now: NOW });

const resolveOrg = (content: string, org: OrgVarSource | null) =>
  resolveTemplateVariables(content, { patient: null, org, now: NOW });

describe("resolveTemplateVariables — known values", () => {
  it("fills patient name, age, sex, dob and id", () => {
    expect(resolve("Name: {{patient.name}}", SUNITA)).toBe("Name: Sunita Devi");
    expect(resolve("Age: {{patient.age}}", SUNITA)).toBe("Age: 36");
    expect(resolve("Sex: {{patient.sex}}", SUNITA)).toBe("Sex: Female");
    expect(resolve("DOB: {{patient.dob}}", SUNITA)).toBe("DOB: 15 Jan 1990");
    expect(resolve("ID: {{patient.id}}", SUNITA)).toBe("ID: MRN-0042");
    expect(resolve("Phone: {{patient.phone}}", SUNITA)).toBe(
      "Phone: +91 98765 43210",
    );
  });

  it("resolves date.today even with no patient", () => {
    expect(resolve("Date: {{date.today}}", null)).toBe("Date: 21 Jun 2026");
  });

  it("fills several markers on one line", () => {
    expect(
      resolve("{{patient.name}} — {{patient.age}}/{{patient.sex}}", SUNITA),
    ).toBe("Sunita Devi — 36/Female");
  });

  it("tolerates inner whitespace in the marker", () => {
    expect(resolve("Name: {{ patient.name }}", SUNITA)).toBe(
      "Name: Sunita Devi",
    );
  });
});

describe("resolveTemplateVariables — no patient linked yet", () => {
  it("leaves patient.* markers in place so they can be filled later", () => {
    expect(resolve("Name: {{patient.name}}", null)).toBe(
      "Name: {{patient.name}}",
    );
    expect(resolve("{{patient.age}}/{{patient.sex}}", null)).toBe(
      "{{patient.age}}/{{patient.sex}}",
    );
  });
});

describe("resolveTemplateVariables — linked patient, missing field is dropped", () => {
  it("removes a variable (and its leading space) when the field is empty", () => {
    const noDob: PatientVarSource = { ...SUNITA, birthdate: null };
    expect(resolve("Age:{{patient.age}}", noDob)).toBe("Age:");
    expect(resolve("Age: {{patient.age}}", noDob)).toBe("Age:");
  });

  it("drops UNKNOWN gender", () => {
    expect(
      resolve("Sex: {{patient.sex}}", { ...SUNITA, gender: "UNKNOWN" }),
    ).toBe("Sex:");
  });

  it("drops the name when the patient has no usable name", () => {
    expect(resolve("Name: {{patient.name}}", { ...SUNITA, name: null })).toBe(
      "Name:",
    );
  });

  it("drops the phone when the patient has none", () => {
    expect(
      resolve("Phone: {{patient.phone}}", { ...SUNITA, phone: null }),
    ).toBe("Phone:");
  });
});

describe("resolveTemplateVariables — organization branding", () => {
  it("fills every org.* field regardless of patient", () => {
    expect(resolveOrg("Clinic: {{org.name}}", CLINIC)).toBe(
      "Clinic: Bizen Rural Health Centre",
    );
    expect(resolveOrg("{{org.address}}", CLINIC)).toBe(
      "12 Station Road, Jaipur",
    );
    expect(resolveOrg("Tel {{org.phone}}", CLINIC)).toBe(
      "Tel +91 141 222 3344",
    );
    expect(resolveOrg("{{org.email}}", CLINIC)).toBe("care@bizen.example");
    expect(resolveOrg("{{org.website}}", CLINIC)).toBe("https://bizen.example");
    expect(resolveOrg("{{org.tagline}}", CLINIC)).toBe("Care close to home");
    expect(resolveOrg("Reg {{org.registrationNo}}", CLINIC)).toBe(
      "Reg RJ-CLINIC-9981",
    );
    expect(resolveOrg("GSTIN {{org.taxId}}", CLINIC)).toBe(
      "GSTIN 08ABCDE1234F1Z5",
    );
  });

  it("resolves org markers even with a patient present", () => {
    expect(
      resolveTemplateVariables("{{org.name}} — {{patient.name}}", {
        patient: SUNITA,
        org: CLINIC,
        now: NOW,
      }),
    ).toBe("Bizen Rural Health Centre — Sunita Devi");
  });

  it("drops an org marker (and its leading space) when the field is empty", () => {
    expect(resolveOrg("Tel: {{org.phone}}", { ...CLINIC, phone: null })).toBe(
      "Tel:",
    );
  });

  it("leaves org.* markers in place when no org source is passed", () => {
    // The patient-change rewrite passes no org; markers already resolved at seed.
    expect(resolve("{{org.name}}", SUNITA)).toBe("{{org.name}}");
    expect(resolveOrg("{{org.name}}", null)).toBe("{{org.name}}");
  });
});

describe("resolveTemplateVariables — unknown keys", () => {
  it("leaves an unrecognised variable untouched so a typo stays visible", () => {
    expect(resolve("X: {{patient.bloodtype}}", SUNITA)).toBe(
      "X: {{patient.bloodtype}}",
    );
  });
});

describe("patientVarsFromSummary", () => {
  const summary: PatientSummary = {
    id: "pat_1",
    preferredName: "Sunita Devi",
    birthdate: "1990-01-15",
    birthdateEstimated: false,
    gender: "FEMALE",
    primaryIdentifierType: "MRN",
    primaryIdentifier: "MRN-0042",
    phoneNumber: "+91 98765 43210",
    dead: false,
  };

  it("maps a summary to the variable source", () => {
    expect(patientVarsFromSummary(summary)).toEqual(SUNITA);
  });

  it("treats the 'Unnamed patient' fallback as no name", () => {
    expect(
      patientVarsFromSummary({ ...summary, preferredName: "Unnamed patient" }),
    ).toMatchObject({ name: null });
  });

  it("returns null for no patient", () => {
    expect(patientVarsFromSummary(null)).toBeNull();
  });
});

describe("containsKnownVariable", () => {
  it("detects a known marker and ignores plain text and unknown keys", () => {
    expect(containsKnownVariable("Name: {{patient.name}}")).toBe(true);
    expect(containsKnownVariable("no markers here")).toBe(false);
    expect(containsKnownVariable("{{patient.bloodtype}}")).toBe(false);
  });
});

describe("variableLabel", () => {
  it("maps a known key to its label and echoes unknown keys", () => {
    expect(variableLabel("patient.name")).toBe("Patient name");
    expect(variableLabel(" patient.age ")).toBe("Patient age");
    expect(variableLabel("patient.phone")).toBe("Patient phone");
    expect(variableLabel("patient.bloodtype")).toBe("patient.bloodtype");
  });
});
