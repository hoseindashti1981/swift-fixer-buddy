import { z } from "zod";

const text = z.string().trim().min(1);
const strings = z.array(text);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    "Invalid calendar date",
  );
export const legacyNoteSchema = z.object({
  id: text,
  title: z.string(),
  category: text,
  tags: z.array(z.string()),
  body: text,
});

const sourceSchema = z
  .object({
    id: text,
    kind: z.enum(["archive", "manufacturer", "field-observation", "technical-reference"]),
    title: text,
    publisher: text.nullable(),
    url: z.string().url().nullable(),
    path: text.nullable(),
    documentNumber: text.nullable(),
    revision: text.nullable(),
    locator: text,
    accessedAt: date.nullable(),
  })
  .strict()
  .refine((source) => source.url !== null || source.path !== null, "Source location required");

export const contentMetadataSchema = z
  .object({
    schemaVersion: z.literal(2),
    revision: z.number().int().positive(),
    kind: z.enum([
      "symptom",
      "error-code",
      "component",
      "test",
      "device",
      "checklist",
      "experience",
    ]),
    aliases: strings,
    symptoms: strings,
    componentIds: strings,
    errorCodes: strings,
    domains: z.array(
      z.enum([
        "hot-water",
        "heating",
        "pressure-circulation",
        "ignition",
        "air-flue",
        "electrical",
        "noise-leak",
      ]),
    ),
    scope: z
      .object({
        applicability: z.enum(["unknown", "general", "models"]),
        brandIds: strings,
        modelIds: strings,
        architectures: strings,
        operatingModes: strings,
      })
      .strict(),
    summary: text.nullable(),
    sections: z
      .array(z.object({ id: text, title: text, body: text, sourceIds: strings }).strict())
      .min(1),
    possibleCauses: z.array(z.object({ cause: text, evidence: text, sourceIds: strings }).strict()),
    nextSteps: strings,
    procedure: z
      .object({
        prerequisites: strings.min(1),
        tools: strings.min(1),
        steps: strings.min(1),
        expectedResult: text,
        sourceIds: strings.min(1),
      })
      .strict()
      .nullable(),
    measurements: z.array(
      z
        .object({
          label: text,
          value: z.number().finite().nullable(),
          range: z
            .object({ min: z.number().finite(), max: z.number().finite() })
            .strict()
            .nullable(),
          unit: text,
          conditions: text,
          sourceId: text,
        })
        .strict()
        .refine(
          (measurement) =>
            (measurement.value !== null) !== (measurement.range !== null) &&
            (!measurement.range || measurement.range.min <= measurement.range.max),
          "Supply either a value or an ordered range",
        ),
    ),
    safety: z
      .object({
        assessment: z.enum(["unknown", "reviewed"]),
        hazards: strings,
        requiredCompetence: z.enum(["unknown", "operator", "technician"]),
        stopConditions: strings,
      })
      .strict(),
    sources: z.array(sourceSchema).min(1),
    publication: z
      .object({
        status: z.enum(["draft", "needs-review", "verified", "superseded"]),
        visibility: z.enum(["available", "quarantined"]),
        reason: text.nullable(),
        triagedAt: date.nullable(),
        reviewedAt: date.nullable(),
        reviewer: text.nullable(),
        supersedes: text.nullable(),
        replacedBy: text.nullable(),
      })
      .strict(),
    relatedIds: strings,
    observation: z.object({ reported: text, outcome: text }).strict().nullable(),
  })
  .strict();

export const articleSchema = legacyNoteSchema
  .extend({
    title: text,
    provenance: z.enum(["legacy-import", "personal", "local-edit", "ai", "source-summary"]),
    content: contentMetadataSchema,
  })
  .strict()
  .superRefine((article, ctx) => {
    const { content: c } = article;
    const fail = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["content"] });
    const unique = (ids: string[], name: string) => {
      if (new Set(ids).size !== ids.length) fail("Duplicate " + name);
    };
    unique(
      c.sources.map((source) => source.id),
      "source IDs",
    );
    unique(
      c.sections.map((section) => section.id),
      "section IDs",
    );
    const sourceIds = new Set(c.sources.map((source) => source.id));
    const refs = [
      ...c.sections.flatMap((section) => section.sourceIds),
      ...c.possibleCauses.flatMap((cause) => cause.sourceIds),
      ...c.measurements.map((measurement) => measurement.sourceId),
      ...(c.procedure?.sourceIds ?? []),
    ];
    if (refs.some((id) => !sourceIds.has(id))) fail("Unknown source reference");
    if (
      c.scope.applicability === "models" &&
      (!c.scope.brandIds.length || !c.scope.modelIds.length)
    )
      fail("Model scope requires brand and model IDs");
    if (c.scope.applicability !== "models" && (c.scope.brandIds.length || c.scope.modelIds.length))
      fail("Unscoped articles cannot assert brand/model applicability");
    if (c.publication.visibility === "quarantined" && !c.publication.reason)
      fail("Quarantine requires a reason");
    if (c.publication.status === "superseded" && !c.publication.replacedBy)
      fail("Superseded articles require a replacement");
    if (c.publication.status !== "verified") return;
    if (!c.publication.reviewedAt || !c.publication.reviewer)
      fail("Verified content requires a reviewer and date");
    if (
      c.scope.applicability === "unknown" ||
      c.safety.assessment !== "reviewed" ||
      c.safety.requiredCompetence === "unknown"
    )
      fail("Verified content requires scope and safety review");
    if (!c.summary) fail("Verified content requires a summary");
    const evidence = new Set(
      c.sources.filter((source) => source.kind !== "archive").map((source) => source.id),
    );
    if (
      c.sources.some(
        (source) =>
          source.kind !== "archive" &&
          (!source.publisher ||
            !source.accessedAt ||
            (source.kind === "manufacturer" && (!source.documentNumber || !source.revision))),
      )
    )
      fail("Verified evidence requires publisher, access date and manufacturer document version");
    if (
      !evidence.size ||
      c.sections.some((section) => !section.sourceIds.some((id) => evidence.has(id)))
    )
      fail("Every verified section requires traceable evidence beyond the archive");
    if (
      c.measurements.some((measurement) => !evidence.has(measurement.sourceId)) ||
      c.possibleCauses.some((cause) => !cause.sourceIds.some((id) => evidence.has(id))) ||
      (c.procedure && !c.procedure.sourceIds.some((id) => evidence.has(id)))
    )
      fail("Verified claims and procedures require evidence beyond the archive");
    if (
      c.kind === "error-code" &&
      (c.scope.applicability !== "models" ||
        !c.sources.some((source) => source.kind === "manufacturer"))
    )
      fail("Verified error codes require model scope and manufacturer evidence");
    if (c.kind === "error-code" && !c.errorCodes.length)
      fail("Verified error codes require an explicit code");
    if (c.kind === "test" && !c.procedure) fail("Verified tests require a complete procedure");
    if (c.kind === "experience" && !c.observation)
      fail("Verified experiences require observation and outcome");
  });

export type ContentMetadata = z.infer<typeof contentMetadataSchema>;
export type Article = z.infer<typeof articleSchema>;

export const catalogueSchema = z
  .object({
    schemaVersion: z.literal(2),
    articles: z.array(articleSchema),
  })
  .strict()
  .superRefine((catalogue, ctx) => {
    const ids = new Set(catalogue.articles.map((article) => article.id));
    if (ids.size !== catalogue.articles.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate article IDs" });
    for (const article of catalogue.articles) {
      const refs = [
        article.content.publication.supersedes,
        article.content.publication.replacedBy,
        ...article.content.relatedIds,
      ].filter((id): id is string => id !== null);
      if (refs.some((id) => id === article.id || !ids.has(id)))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid article relationship: " + article.id,
        });
    }
  });
