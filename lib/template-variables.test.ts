import { describe, expect, it } from "vitest";
import type { PatientSummary } from "@/lib/patients";
import {
  containsKnownVariable,
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

const resolve = (content: string, patient: PatientVarSource | null) =>
  resolveTemplateVariables(content, { patient, now: NOW });

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
