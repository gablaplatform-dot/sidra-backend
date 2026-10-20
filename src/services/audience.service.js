import { prisma } from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { COUNTRIES } from "../constants/countries.js";

const KINDS = ["country", "culture"];
const MAX_PER_PROVIDER = 40;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s'’.&()/-]{1,59}$/u;

const err = (message, code, statusCode = 400) => new AppError({ message, statusCode, code });
const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

const dto = (a, extra = {}) => ({
  id: a.id,
  kind: a.kind,
  name: a.name,
  code: a.code ?? null,
  moderationStatus: a.moderationStatus,
  ...extra
});

// Where-fragment for "serves this country / this culture". A provider matches a kind when it picked the chosen
// audience, or when it did not restrict that kind at all (no approved audience of that kind = serves everyone).
export const audienceProviderWhere = ({ countryId, cultureId } = {}) => {
  const clause = (kind, id) => ({
    OR: [
      { audiences: { none: { audience: { kind, moderationStatus: "approved" } } } },
      { audiences: { some: { audienceId: id } } }
    ]
  });
  const parts = [];
  if (countryId) parts.push(clause("country", countryId));
  if (cultureId) parts.push(clause("culture", cultureId));
  return parts.length ? { AND: parts } : null;
};

export class AudienceService {
  // Makes sure every country exists. Safe to run on every start.
  async ensureCountries() {
    const existing = await prisma.audience.count({ where: { kind: "country" } });
    if (existing >= COUNTRIES.length) return { created: 0 };
    const known = new Set((await prisma.audience.findMany({ where: { kind: "country" }, select: { name: true } })).map((a) => a.name));
    let created = 0;
    for (const [index, [code, name]] of COUNTRIES.entries()) {
      if (known.has(name)) continue;
      await prisma.audience.create({ data: { kind: "country", name, code, moderationStatus: "approved", sortOrder: index < 12 ? index : 100 + index } });
      created += 1;
    }
    return { created };
  }

  // What customers and the registration form may choose from: approved entries only.
  async listPublic() {
    const [rows, counts] = await Promise.all([
      prisma.audience.findMany({ where: { moderationStatus: "approved" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.providerAudience.groupBy({ by: ["audienceId"], where: { provider: { isApproved: true, moderationStatus: "approved" } }, _count: { _all: true } })
    ]);
    const byId = new Map(counts.map((c) => [c.audienceId, c._count._all]));
    const withCount = (a) => dto(a, { providerCount: byId.get(a.id) ?? 0 });
    return { countries: rows.filter((a) => a.kind === "country").map(withCount), cultures: rows.filter((a) => a.kind === "culture").map(withCount) };
  }

  async listAdmin() {
    const [rows, counts, makers] = await Promise.all([
      prisma.audience.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
      prisma.providerAudience.groupBy({ by: ["audienceId"], _count: { _all: true } }),
      prisma.provider.findMany({ where: { createdAudiences: { some: {} } }, select: { id: true, businessName: true } })
    ]);
    const byId = new Map(counts.map((c) => [c.audienceId, c._count._all]));
    const maker = new Map(makers.map((p) => [p.id, p.businessName]));
    return { items: rows.map((a) => dto(a, { providerCount: byId.get(a.id) ?? 0, createdBy: a.createdByProviderId ? maker.get(a.createdByProviderId) ?? "A provider" : null, createdAt: a.createdAt })) };
  }

  _normalise({ kind, name }) {
    const cleanKind = String(kind ?? "").toLowerCase();
    if (!KINDS.includes(cleanKind)) throw err("Choose country or culture.", "INVALID_AUDIENCE_KIND");
    const cleanName = clean(name);
    if (!NAME_RE.test(cleanName)) throw err("Use 2 to 60 letters, numbers or simple punctuation for the name.", "INVALID_AUDIENCE_NAME");
    return { kind: cleanKind, name: cleanName };
  }

  async _findSame({ kind, name }) {
    const rows = await prisma.audience.findMany({ where: { kind } });
    const lower = name.toLowerCase();
    return rows.find((a) => a.name.toLowerCase() === lower) ?? null;
  }

  async createByAdmin({ kind, name, code }) {
    const input = this._normalise({ kind, name });
    const same = await this._findSame(input);
    if (same) throw err(`${same.name} is already in the list.`, "AUDIENCE_EXISTS", 409);
    const created = await prisma.audience.create({ data: { ...input, code: input.kind === "country" ? clean(code).toUpperCase().slice(0, 3) || null : null, moderationStatus: "approved" } });
    return dto(created);
  }

  // A provider suggesting its own. If the same name already exists, that one is returned instead of a duplicate.
  async createFromProvider({ actorUserId, kind, name }) {
    const provider = await prisma.provider.findUnique({ where: { userId: actorUserId } });
    if (!provider) throw err("Provider not found", "PROVIDER_NOT_FOUND", 404);
    return this.suggest(provider.id, { kind, name });
  }

  async suggest(providerId, { kind, name }) {
    const input = this._normalise({ kind, name });
    const same = await this._findSame(input);
    if (same) return dto(same, { existing: true });
    const created = await prisma.audience.create({ data: { ...input, moderationStatus: "pending", createdByProviderId: providerId } });
    return dto(created, { existing: false });
  }

  async update(id, { name, code, moderationStatus }) {
    const current = await prisma.audience.findUnique({ where: { id } });
    if (!current) throw err("Not found", "AUDIENCE_NOT_FOUND", 404);
    const data = {};
    if (name !== undefined) {
      const { name: cleaned } = this._normalise({ kind: current.kind, name });
      const same = await this._findSame({ kind: current.kind, name: cleaned });
      if (same && same.id !== id) throw err(`${same.name} is already in the list.`, "AUDIENCE_EXISTS", 409);
      data.name = cleaned;
    }
    if (code !== undefined && current.kind === "country") data.code = clean(code).toUpperCase().slice(0, 3) || null;
    if (moderationStatus !== undefined) data.moderationStatus = moderationStatus;
    return dto(await prisma.audience.update({ where: { id }, data }));
  }

  async remove(id) {
    const used = await prisma.providerAudience.count({ where: { audienceId: id } });
    await prisma.audience.delete({ where: { id } }).catch((e) => {
      if (e?.code === "P2025") throw err("Not found", "AUDIENCE_NOT_FOUND", 404);
      throw e;
    });
    return { deleted: true, providersAffected: used };
  }

  // Replaces what a provider serves. Approved entries are open to everyone; a pending one only to the provider that suggested it.
  async setProviderAudiences(providerId, ids, suggestions = []) {
    // Suggestions the provider typed in: created as pending (or matched to an existing entry of the same name).
    const suggested = [];
    for (const item of (Array.isArray(suggestions) ? suggestions : []).slice(0, 5)) {
      const made = await this.suggest(providerId, item);
      // An existing entry that is still pending belongs to someone else: skip it rather than attach it.
      if (made.moderationStatus === "approved" || !made.existing) suggested.push(made.id);
    }
    const wanted = [...new Set([...(Array.isArray(ids) ? ids : []).map(String), ...suggested])];
    if (wanted.length > MAX_PER_PROVIDER) throw err(`Choose up to ${MAX_PER_PROVIDER}.`, "TOO_MANY_AUDIENCES");
    const rows = wanted.length ? await prisma.audience.findMany({ where: { id: { in: wanted } } }) : [];
    const allowed = rows.filter((a) => a.moderationStatus === "approved" || a.createdByProviderId === providerId);
    if (allowed.length !== wanted.length) throw err("One of those isn't available.", "AUDIENCE_NOT_AVAILABLE");
    await prisma.$transaction([
      prisma.providerAudience.deleteMany({ where: { providerId } }),
      ...(allowed.length ? [prisma.providerAudience.createMany({ data: allowed.map((a) => ({ providerId, audienceId: a.id })) })] : [])
    ]);
    return this.forProvider(providerId, { includePending: true });
  }

  async forProvider(providerId, { includePending = false } = {}) {
    const rows = await prisma.providerAudience.findMany({
      where: { providerId, ...(includePending ? {} : { audience: { moderationStatus: "approved" } }) },
      include: { audience: true }
    });
    return rows
      .map((r) => r.audience)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((a) => dto(a));
  }

  // Of these providers, which ones explicitly picked one of the chosen audiences (for "matched first" ordering).
  async matchedProviderIds(providerIds, audienceIds) {
    const ids = audienceIds.filter(Boolean);
    if (!providerIds.length || !ids.length) return new Set();
    const rows = await prisma.providerAudience.findMany({ where: { providerId: { in: providerIds }, audienceId: { in: ids } }, select: { providerId: true } });
    return new Set(rows.map((r) => r.providerId));
  }
}
