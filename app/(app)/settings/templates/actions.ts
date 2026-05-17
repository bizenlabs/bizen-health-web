"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  cloneTemplate,
  createTemplate,
  restoreTemplate,
  restoreTemplateVersion,
  retireTemplate,
  setDefaultTemplate,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  updateTemplate,
} from "@/lib/templates";
import type { TemplateFormState } from "./_components/template-editor-state";

const LIST_PATH = "/settings/templates";

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString().trim();
}

function fail(error: string): TemplateFormState {
  return { error, savedAt: null };
}

/** Read the editable fields off a submitted form, validating as we go. */
function readInput(formData: FormData):
  | {
      ok: true;
      name: string;
      description: string | null;
      category: TemplateCategory;
      content: string;
    }
  | { ok: false; error: string } {
  const name = str(formData, "name");
  const description = str(formData, "description");
  const category = str(formData, "category");
  const content = (formData.get("content") ?? "").toString();

  if (!name) return { ok: false, error: "Enter a name for the template." };
  if (!TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
    return { ok: false, error: "Choose a category for the template." };
  }
  return {
    ok: true,
    name,
    description: description || null,
    category: category as TemplateCategory,
    content,
  };
}

export async function createTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireRole("tenant_admin", "super_admin");

  const input = readInput(formData);
  if (!input.ok) return fail(input.error);

  let id: string;
  try {
    const created = await createTemplate({
      name: input.name,
      description: input.description,
      category: input.category,
      content: input.content,
    });
    id = created.id;
  } catch (err) {
    if (err instanceof ApiError) return fail(err.message);
    return fail("Could not create the template.");
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${id}`);
}

export async function updateTemplateAction(
  id: string,
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  await requireRole("tenant_admin", "super_admin");

  const input = readInput(formData);
  if (!input.ok) return fail(input.error);

  try {
    await updateTemplate(id, {
      name: input.name,
      description: input.description,
      category: input.category,
      content: input.content,
    });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.message);
    return fail("Could not save your changes.");
  }

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { error: null, savedAt: Date.now() };
}

export async function retireTemplateAction(id: string): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await retireTemplate(id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not retire the template.");
  }
  revalidatePath(LIST_PATH);
}

export async function restoreTemplateAction(id: string): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await restoreTemplate(id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not restore the template.");
  }
  revalidatePath(LIST_PATH);
}

export async function setDefaultTemplateAction(id: string): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await setDefaultTemplate(id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not set the default template.");
  }
  revalidatePath(LIST_PATH);
}

/** Clone a template, then jump straight into the copy's editor. */
export async function cloneTemplateAction(id: string): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  let copyId: string;
  try {
    const copy = await cloneTemplate(id);
    copyId = copy.id;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not clone the template.");
  }
  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}/${copyId}`);
}

export async function restoreTemplateVersionAction(
  id: string,
  versionNumber: number,
): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await restoreTemplateVersion(id, versionNumber);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Could not restore that version.");
  }
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
}
