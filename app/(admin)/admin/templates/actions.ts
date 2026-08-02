"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  activateSystemTemplate,
  deactivateSystemTemplate,
  publishSystemTemplate,
  updateSystemTemplate,
} from "@/lib/system-templates";
import {
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
} from "@/lib/template-categories";
import {
  TEMPLATE_SPECIALTIES,
  type TemplateSpecialty,
} from "@/lib/template-specialties";
import type { SystemTemplateFormState } from "./_components/system-template-form-state";

const LIST_PATH = "/admin/templates";

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString().trim();
}

function fail(
  error: string | null,
  fieldErrors: Record<string, string> = {},
): SystemTemplateFormState {
  return { error, fieldErrors, savedAt: null };
}

function fromApiError(err: unknown, fallback: string): SystemTemplateFormState {
  if (err instanceof ApiError) {
    if (err.code === "TEMPLATE_NAME_TAKEN") {
      return fail(null, { name: err.message });
    }
    if (err.fields.length > 0) {
      const fieldErrors: Record<string, string> = {};
      for (const f of err.fields) fieldErrors[f.path] = f.message;
      return fail(null, fieldErrors);
    }
    return fail(err.message);
  }
  return fail(fallback);
}

function readInput(formData: FormData):
  | {
      ok: true;
      name: string;
      description: string | null;
      category: TemplateCategory;
      specialty: TemplateSpecialty | null;
      content: string;
      exampleOutput: string | null;
    }
  | { ok: false; state: SystemTemplateFormState } {
  const name = str(formData, "name");
  const description = str(formData, "description");
  const category = str(formData, "category");
  const specialty = str(formData, "specialty");
  const content = (formData.get("content") ?? "")
    .toString()
    .replace(/\r\n?/g, "\n");
  const exampleOutput = (formData.get("exampleOutput") ?? "")
    .toString()
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!name) {
    return {
      ok: false,
      state: fail(null, { name: "Enter a name for the template." }),
    };
  }
  if (!TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
    return {
      ok: false,
      state: fail(null, { category: "Choose a category for the template." }),
    };
  }
  if (
    specialty &&
    !TEMPLATE_SPECIALTIES.includes(specialty as TemplateSpecialty)
  ) {
    return {
      ok: false,
      state: fail(null, { specialty: "Choose a specialty from the list." }),
    };
  }
  return {
    ok: true,
    name,
    description: description || null,
    category: category as TemplateCategory,
    specialty: specialty ? (specialty as TemplateSpecialty) : null,
    content,
    exampleOutput: exampleOutput || null,
  };
}

/** Publish a new authored system template — visible to every tenant immediately. */
export async function publishSystemTemplateAction(
  _prev: SystemTemplateFormState,
  formData: FormData,
): Promise<SystemTemplateFormState> {
  await requireRole("super_admin");

  const input = readInput(formData);
  if (!input.ok) return input.state;

  let id: string;
  try {
    const created = await publishSystemTemplate({
      name: input.name,
      description: input.description,
      category: input.category,
      specialty: input.specialty,
      content: input.content,
      exampleOutput: input.exampleOutput,
    });
    id = created.id;
  } catch (err) {
    return fromApiError(err, "Could not publish the template.");
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${id}`);
}

/** Edit an authored system template; managed rows are rejected by the API. */
export async function updateSystemTemplateAction(
  id: string,
  _prev: SystemTemplateFormState,
  formData: FormData,
): Promise<SystemTemplateFormState> {
  await requireRole("super_admin");

  const input = readInput(formData);
  if (!input.ok) return input.state;

  try {
    await updateSystemTemplate(id, {
      name: input.name,
      description: input.description,
      category: input.category,
      specialty: input.specialty,
      content: input.content,
      exampleOutput: input.exampleOutput,
    });
  } catch (err) {
    return fromApiError(err, "Could not save your changes.");
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { error: null, fieldErrors: {}, savedAt: Date.now() };
}

export async function deactivateSystemTemplateAction(
  id: string,
): Promise<void> {
  await requireRole("super_admin");
  try {
    await deactivateSystemTemplate(id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not unpublish the template.");
  }
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
}

export async function activateSystemTemplateAction(id: string): Promise<void> {
  await requireRole("super_admin");
  try {
    await activateSystemTemplate(id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not republish the template.");
  }
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
}
