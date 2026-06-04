import type { FieldDelta, Hlc, Mutation, PushRequest } from "@listo/shared";
import { isEntityKind } from "./entities.js";

const MAX_MUTATIONS = 1_000;
const MAX_FIELDS = 64;

function isHlc(v: unknown): v is Hlc {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.wall === "number" && typeof o.counter === "number" && typeof o.node === "string";
}

function validateFieldDelta(v: unknown): FieldDelta | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.field !== "string" || !isHlc(o.hlc)) return null;
  return { field: o.field, value: "value" in o ? o.value : null, hlc: o.hlc };
}

function validateMutation(v: unknown): Mutation | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.mutationId !== "string" || o.mutationId.length === 0) return null;
  if (!isEntityKind(o.entity)) return null;
  if (typeof o.entityId !== "string" || o.entityId.length === 0) return null;
  if (!Array.isArray(o.fields) || o.fields.length > MAX_FIELDS) return null;

  const fields: FieldDelta[] = [];
  for (const f of o.fields) {
    const fd = validateFieldDelta(f);
    if (!fd) return null;
    fields.push(fd);
  }

  const mut: Mutation = { mutationId: o.mutationId, entity: o.entity, entityId: o.entityId, fields };
  if (o.deleted !== undefined && o.deleted !== null) {
    const del = o.deleted as Record<string, unknown>;
    if (!isHlc(del.hlc)) return null;
    mut.deleted = { hlc: del.hlc };
  }
  if (o.knownDeletedHlc !== undefined && o.knownDeletedHlc !== null) {
    if (!isHlc(o.knownDeletedHlc)) return null;
    mut.knownDeletedHlc = o.knownDeletedHlc;
  }
  return mut;
}

export function validatePushRequest(v: unknown): PushRequest | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.clientId !== "string" || o.clientId.length === 0) return null;
  if (!Array.isArray(o.mutations) || o.mutations.length > MAX_MUTATIONS) return null;

  const mutations: Mutation[] = [];
  for (const m of o.mutations) {
    const mut = validateMutation(m);
    if (!mut) return null;
    mutations.push(mut);
  }
  return { clientId: o.clientId, mutations };
}
