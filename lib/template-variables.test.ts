import { describe, expect, it } from "vitest";
import type { Gender, PatientDetail } from "@/lib/patients";
import { resolveTemplateVariables, variableLabel } from "./template-variables";

// A fixed "now" so age and {{date.today}} are deterministic.
const NOW = new Date(2026, 5, 21); // 21 Jun 2026 (local)

function aPatient(
  over: Partial<PatientDetail["demographics"]> = {},
): PatientDetail {
  return {
    id: "pat_1",
    demographics: {
      gender: "FEMALE" as Gender,
      birthdate: "1990-01-15",
      birthdateEstimated: false,
      birthtime: null,
      dead: false,
      ...over,
    },
    name: {
      prefix: null,
      givenName: "Sunita",
      middleName: null,
      familyNamePrefix: null,
      familyName: "Devi",
      familyName2: null,
      familyNameSuffix: null,
      degree: null,
    },
    address: {
      address1: null,
      address2: null,
      address3: null,
      cityVillage: null,
      countyDistrict: null,
      stateProvince: null,
      country: null,
      postalCode: null,
      latitude: null,
      longitude: null,
    },
    allergyStatus: "UNKNOWN",
    identifiers: [
      {
        id: "id_1",
        typeId: "t1",
        typeName: "MRN",
        identifier: "MRN-0042",
        preferred: true,
      },
    ],
    deathDate: null,
    deathdateEstimated: false,
    causeOfDeath: null,
    voided: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const resolve = (content: string, patient: PatientDetail | null) =>
  resolveTemplateVariables(content, { patient, now: NOW });

describe("resolveTemplateVariables — known values", () => {
  it("fills patient name, age, sex, dob and id", () => {
    const patient = aPatient();
    expect(resolve("Name: {{patient.name}}", patient)).toBe(
      "Name: Sunita Devi",
    );
    expect(resolve("Age: {{patient.age}}", patient)).toBe("Age: 36");
    expect(resolve("Sex: {{patient.sex}}", patient)).toBe("Sex: Female");
    expect(resolve("DOB: {{patient.dob}}", patient)).toBe("DOB: 15 Jan 1990");
    expect(resolve("ID: {{patient.id}}", patient)).toBe("ID: MRN-0042");
  });

  it("resolves date.today regardless of patient", () => {
    expect(resolve("Date: {{date.today}}", null)).toBe("Date: 21 Jun 2026");
  });

  it("fills several markers on one line", () => {
    expect(
      resolve("{{patient.name}} — {{patient.age}}/{{patient.sex}}", aPatient()),
    ).toBe("Sunita Devi — 36/Female");
  });

  it("tolerates inner whitespace in the marker", () => {
    expect(resolve("Name: {{ patient.name }}", aPatient())).toBe(
      "Name: Sunita Devi",
    );
  });
});

describe("resolveTemplateVariables — missing data is dropped", () => {
  it("removes a variable (and its leading space) when the value is unknown", () => {
    const noDob = aPatient({ birthdate: null });
    expect(resolve("Age:{{patient.age}}", noDob)).toBe("Age:");
    expect(resolve("Age: {{patient.age}}", noDob)).toBe("Age:");
  });

  it("drops UNKNOWN gender", () => {
    expect(
      resolve("Sex: {{patient.sex}}", aPatient({ gender: "UNKNOWN" })),
    ).toBe("Sex:");
  });

  it("drops all patient variables when there is no patient", () => {
    expect(resolve("Name: {{patient.name}}, age {{patient.age}}", null)).toBe(
      "Name:, age",
    );
  });

  it("drops the name when the patient has no usable name parts", () => {
    const patient = aPatient();
    patient.name = { ...patient.name, givenName: null, familyName: null };
    expect(resolve("Name: {{patient.name}}", patient)).toBe("Name:");
  });
});

describe("resolveTemplateVariables — unknown keys", () => {
  it("leaves an unrecognised variable untouched so a typo stays visible", () => {
    expect(resolve("X: {{patient.phone}}", aPatient())).toBe(
      "X: {{patient.phone}}",
    );
  });
});

describe("variableLabel", () => {
  it("maps a known key to its label and echoes unknown keys", () => {
    expect(variableLabel("patient.name")).toBe("Patient name");
    expect(variableLabel(" patient.age ")).toBe("Patient age");
    expect(variableLabel("patient.phone")).toBe("patient.phone");
  });
});
