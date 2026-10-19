import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  CheckAdminAccessResponse,
  CreateAdminCategoryBody,
  CreateAdminCategoryResponse,
  CreateAdminPropertyBody,
  CreateAdminPropertyResponse,
  CreateAdminProductBody,
  CreateAdminProductResponse,
  GetAdminOverviewResponse,
  GetAdminSettingsResponse,
  ImportAdminProductsBody,
  ImportAdminProductsResponse,
  ListAdminCategoriesResponse,
  ListAdminEnquiriesQueryParams,
  ListAdminEnquiriesResponse,
  ListAdminProductsQueryParams,
  ListAdminProductsResponse,
  ListAdminPropertiesQueryParams,
  ListAdminPropertiesResponse,
  UpdateAdminCategoryBody,
  UpdateAdminCategoryParams,
  UpdateAdminCategoryResponse,
  UpdateAdminEnquiryBody,
  UpdateAdminEnquiryParams,
  UpdateAdminEnquiryResponse,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
  UpdateAdminPropertyBody,
  UpdateAdminPropertyParams,
  UpdateAdminPropertyResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
} from "@workspace/api-zod";
import {
  analyticsEventsTable,
  categoriesTable,
  db,
  enquiriesTable,
  enquiryItemsTable,
  productsTable,
  propertiesTable,
  privacySettingsTable,
} from "@workspace/db";
import { getConfiguredAdminIds, requireAdmin } from "../middlewares/requireAdmin";
import { getPrivacySettings, purgeExpiredEnquiries } from "../lib/privacy";

const router: IRouter = Router();

function adminProduct(
  product: typeof productsTable.$inferSelect,
  categoryName: string,
) {
  return {
    ...product,
    sourceListingUrl: null,
    sourceVerifiedAt: null,
    categoryName,
    specifications: product.specifications ?? {},
    imageUrls: product.imageUrls ?? [],
  };
}

function productInputForDatabase(
  input: ReturnType<typeof CreateAdminProductBody.parse>,
) {
  return {
    ...input,
    sourceListingUrl: null,
    sourceVerifiedAt:
      input.sourceVerifiedAt?.toISOString().slice(0, 10) ?? null,
  };
}

function propertyInputForDatabase(
  input: ReturnType<typeof CreateAdminPropertyBody.parse>,
) {
  const { sourceVerifiedAt, ...rest } = input;
  return {
    ...rest,
    sourceListingUrl: null,
    sourceVerifiedAt: sourceVerifiedAt?.toISOString().slice(0, 10) ?? null,
  };
}

function validSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validHttpUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validImageUrl(value: string): boolean {
  return (
    value.startsWith("/api/storage/public-objects/") ||
    validHttpUrl(value)
  );
}

async function categoryExists(categoryId: number): Promise<boolean> {
  const [category] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId))
    .limit(1);
  return Boolean(category);
}

async function productWithCategory(id: number) {
  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id))
    .limit(1);
  return row ? adminProduct(row.product, row.categoryName) : undefined;
}

async function adminEnquiry(
  enquiry: typeof enquiriesTable.$inferSelect,
) {
  const items = await db
    .select()
    .from(enquiryItemsTable)
    .where(eq(enquiryItemsTable.enquiryId, enquiry.id))
    .orderBy(asc(enquiryItemsTable.id));
  return {
    ...enquiry,
    items: items.map((item) => ({
      productId: item.productId ?? 0,
      title: item.title,
      quantity: item.quantity,
      priceUgx: item.priceUgx,
    })),
  };
}

async function adminEnquiries(
  enquiries: (typeof enquiriesTable.$inferSelect)[],
) {
  if (enquiries.length === 0) return [];
  const ids = enquiries.map((item) => item.id);
  const items = await db
    .select()
    .from(enquiryItemsTable)
    .where(inArray(enquiryItemsTable.enquiryId, ids))
    .orderBy(asc(enquiryItemsTable.id));
  const itemsByEnquiry = new Map<number, typeof items>();
  for (const item of items) {
    const current = itemsByEnquiry.get(item.enquiryId) ?? [];
    current.push(item);
    itemsByEnquiry.set(item.enquiryId, current);
  }

  return enquiries.map((enquiry) => ({
    ...enquiry,
    items: (itemsByEnquiry.get(enquiry.id) ?? []).map((item) => ({
      productId: item.productId ?? 0,
      title: item.title,
      quantity: item.quantity,
      priceUgx: item.priceUgx,
    })),
  }));
}

router.get("/admin/authorize", async (req, res): Promise<void> => {
  if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    res.status(503).json({ error: "Staff sign-in is not configured." });
    return;
  }
  if (getConfiguredAdminIds().size === 0) {
    res.status(503).json({ error: "No approved staff accounts are configured." });
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }

  res.json(
    CheckAdminAccessResponse.parse({
      allowed: getConfiguredAdminIds().has(userId),
    }),
  );
});

router.use("/admin", requireAdmin);

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [
    [{ productCount }],
    [{ publishedCount }],
    [{ enquiryCount }],
    [{ openEnquiryCount }],
    [{ productViews }],
    [{ searches }],
    recent,
    topRows,
  ] = await Promise.all([
    db.select({ productCount: count() }).from(productsTable),
    db
      .select({ publishedCount: count() })
      .from(productsTable)
      .where(eq(productsTable.status, "published")),
    db.select({ enquiryCount: count() }).from(enquiriesTable),
    db
      .select({ openEnquiryCount: count() })
      .from(enquiriesTable)
      .where(inArray(enquiriesTable.status, ["new", "in_progress"])),
    db
      .select({ productViews: count() })
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.event, "product_view")),
    db
      .select({ searches: count() })
      .from(analyticsEventsTable)
      .where(eq(analyticsEventsTable.event, "search")),
    db
      .select()
      .from(enquiriesTable)
      .orderBy(desc(enquiriesTable.createdAt))
      .limit(5),
    db
      .select({ product: productsTable, categoryName: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(productsTable.status, "published"))
      .orderBy(desc(productsTable.viewCount), desc(productsTable.createdAt))
      .limit(5),
  ]);

  res.json(
    GetAdminOverviewResponse.parse({
      productCount,
      publishedCount,
      enquiryCount,
      openEnquiryCount,
      productViews,
      searches,
      recentEnquiries: await adminEnquiries(recent),
      topProducts: topRows.map(({ product, categoryName }) =>
        adminProduct(product, categoryName),
      ),
    }),
  );
});

router.get("/admin/products", async (req, res): Promise<void> => {
  const parsed = ListAdminProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.status) {
    filters.push(eq(productsTable.status, parsed.data.status));
  }
  if (parsed.data.q) {
    const term = `%${parsed.data.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      or(
        ilike(productsTable.title, term),
        ilike(productsTable.brand, term),
        ilike(productsTable.model, term),
        ilike(productsTable.sku, term),
      )!,
    );
  }
  const rows = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(productsTable.updatedAt));

  res.json(
    ListAdminProductsResponse.parse(
      rows.map(({ product, categoryName }) =>
        adminProduct(product, categoryName),
      ),
    ),
  );
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const parsed = CreateAdminProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  if (
    !validSlug(input.slug) ||
    !input.imageUrls.every(validImageUrl) ||
    (input.status === "published" && input.imageUrls.length === 0)
  ) {
    res.status(400).json({
      error: "Use a safe URL and a lowercase, hyphenated product slug. Published products require at least one product photo.",
    });
    return;
  }
  if (!(await categoryExists(input.categoryId))) {
    res.status(400).json({ error: "Select an existing category." });
    return;
  }

  try {
    const [created] = await db
      .insert(productsTable)
      .values(productInputForDatabase(input))
      .returning({ id: productsTable.id });
    const product = await productWithCategory(created.id);
    res.status(201).json(CreateAdminProductResponse.parse(product));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That product slug is already in use." });
      return;
    }
    throw error;
  }
});

router.post("/admin/products/import", async (req, res): Promise<void> => {
  const parsed = ImportAdminProductsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const products = parsed.data.products;
  if (products.some((product) => product.status === "published")) {
    res.status(400).json({
      error: "CSV imports cannot publish products. Review imported drafts and publish them individually.",
    });
    return;
  }
  if (
    products.some(
      (product) =>
        !validSlug(product.slug) ||
        !product.imageUrls.every(validImageUrl),
    )
  ) {
    res.status(400).json({ error: "The import contains an invalid slug or URL." });
    return;
  }
  const categoryIds = [...new Set(products.map((product) => product.categoryId))];
  const categories = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(inArray(categoriesTable.id, categoryIds));
  if (categories.length !== categoryIds.length) {
    res.status(400).json({ error: "The import references an unknown category." });
    return;
  }
  const slugs = products.map((product) => product.slug);
  if (new Set(slugs).size !== slugs.length) {
    res.status(400).json({ error: "The import has duplicate product slugs." });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(productsTable)
        .values(products.map(productInputForDatabase));
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "A product slug in the import already exists. No rows were imported.",
      });
      return;
    }
    throw error;
  }
  res.json(
    ImportAdminProductsResponse.parse({ imported: products.length }),
  );
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminProductParams.safeParse(req.params);
  const parsed = UpdateAdminProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [current] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Product not found." });
    return;
  }

  const nextCategoryId = parsed.data.categoryId ?? current.categoryId;
  const nextSlug = parsed.data.slug ?? current.slug;
  const nextImages = parsed.data.imageUrls ?? current.imageUrls;
  if (
    (parsed.data.slug !== undefined && !validSlug(nextSlug)) ||
    !nextImages.every(validImageUrl) ||
    (parsed.data.status === "published" && nextImages.length === 0)
  ) {
    res.status(400).json({ error: "Use a safe URL and a lowercase, hyphenated product slug. Published products require at least one product photo." });
    return;
  }
  if (!(await categoryExists(nextCategoryId))) {
    res.status(400).json({ error: "Select an existing category." });
    return;
  }
  if (
    parsed.data.status === "published" &&
    !(parsed.data.title ?? current.title).trim()
  ) {
    res.status(400).json({ error: "A published product needs a title." });
    return;
  }

  try {
    const updates = { ...parsed.data };
    delete updates.sourceListingUrl;
    const { sourceVerifiedAt, ...productUpdates } = updates;
    await db
      .update(productsTable)
      .set({
        ...productUpdates,
        ...(sourceVerifiedAt !== undefined
          ? {
              sourceVerifiedAt:
                sourceVerifiedAt?.toISOString().slice(0, 10) ?? null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, params.data.id));
    const product = await productWithCategory(params.data.id);
    res.json(UpdateAdminProductResponse.parse(product));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That product slug is already in use." });
      return;
    }
    throw error;
  }
});

router.get("/admin/properties", async (req, res): Promise<void> => {
  const parsed = ListAdminPropertiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.status) {
    filters.push(eq(propertiesTable.status, parsed.data.status));
  }
  if (parsed.data.q) {
    const term = `%${parsed.data.q.replace(/[\\%_]/g, "\\$&" )}%`;
    filters.push(
      or(
        ilike(propertiesTable.title, term),
        ilike(propertiesTable.location, term),
        ilike(propertiesTable.landArea, term),
      )!,
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(propertiesTable)
    .where(where);
  const properties = await db
    .select()
    .from(propertiesTable)
    .where(where)
    .orderBy(desc(propertiesTable.updatedAt), desc(propertiesTable.id))
    .limit(parsed.data.pageSize)
    .offset((parsed.data.page - 1) * parsed.data.pageSize);
  res.json(ListAdminPropertiesResponse.parse({
    items: properties.map((property) => ({
      ...property,
      sourceListingUrl: null,
      sourceVerifiedAt: null,
    })),
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total,
  }));
});

router.post("/admin/properties", async (req, res): Promise<void> => {
  const parsed = CreateAdminPropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  if (
    !validSlug(input.slug) ||
    !input.imageUrls.every(validImageUrl) ||
    (input.status === "published" && input.imageUrls.length === 0)
  ) {
    res.status(400).json({ error: "Use a valid slug and image URL. Published listings require at least one property photo." });
    return;
  }
  try {
    const [created] = await db
      .insert(propertiesTable)
      .values(propertyInputForDatabase(input))
      .returning();
    res.status(201).json(CreateAdminPropertyResponse.parse({
      ...created,
      sourceListingUrl: null,
      sourceVerifiedAt: null,
    }));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That property slug is already in use." });
      return;
    }
    throw error;
  }
});

router.patch("/admin/properties/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminPropertyParams.safeParse(req.params);
  const parsed = UpdateAdminPropertyBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [current] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, params.data.id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Property listing not found." });
    return;
  }
  const nextSlug = parsed.data.slug ?? current.slug;
  const nextImages = parsed.data.imageUrls ?? current.imageUrls;
  if (
    (parsed.data.slug !== undefined && !validSlug(nextSlug)) ||
    !nextImages.every(validImageUrl) ||
    (parsed.data.status === "published" && nextImages.length === 0)
  ) {
    res.status(400).json({ error: "Use a valid slug and image URL. Published listings require at least one property photo." });
    return;
  }
  try {
    const updates = { ...parsed.data };
    delete updates.sourceListingUrl;
    const { sourceVerifiedAt, ...propertyUpdates } = updates;
    await db
      .update(propertiesTable)
      .set({
        ...propertyUpdates,
        ...(sourceVerifiedAt !== undefined
          ? { sourceVerifiedAt: sourceVerifiedAt?.toISOString().slice(0, 10) ?? null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(propertiesTable.id, params.data.id));
    const [updated] = await db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.id, params.data.id))
      .limit(1);
    res.json(UpdateAdminPropertyResponse.parse({
      ...updated,
      sourceListingUrl: null,
      sourceVerifiedAt: null,
    }));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That property slug is already in use." });
      return;
    }
    throw error;
  }
});

router.get("/admin/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  const countsByCategory = await db
    .select({ categoryId: productsTable.categoryId, value: count() })
    .from(productsTable)
    .groupBy(productsTable.categoryId);
  const productCounts = new Map(
    countsByCategory.map(({ categoryId, value }) => [categoryId, value]),
  );
  res.json(
    ListAdminCategoriesResponse.parse(
      categories.map((category) => ({
        ...category,
        productCount: productCounts.get(category.id) ?? 0,
      })),
    ),
  );
});

router.post("/admin/categories", async (req, res): Promise<void> => {
  const parsed = CreateAdminCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validSlug(parsed.data.slug)) {
    res.status(400).json({ error: "Use a lowercase, hyphenated category slug." });
    return;
  }
  try {
    const [category] = await db
      .insert(categoriesTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(
      CreateAdminCategoryResponse.parse({ ...category, productCount: 0 }),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That category slug is already in use." });
      return;
    }
    throw error;
  }
});

router.patch("/admin/categories/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminCategoryParams.safeParse(req.params);
  const parsed = UpdateAdminCategoryBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.slug && !validSlug(parsed.data.slug)) {
    res.status(400).json({ error: "Use a lowercase, hyphenated category slug." });
    return;
  }
  try {
    const [category] = await db
      .update(categoriesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(categoriesTable.id, params.data.id))
      .returning();
    if (!category) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    const [{ value: productCount }] = await db
      .select({ value: count() })
      .from(productsTable)
      .where(eq(productsTable.categoryId, category.id));
    res.json(
      UpdateAdminCategoryResponse.parse({ ...category, productCount }),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That category slug is already in use." });
      return;
    }
    throw error;
  }
});

router.get("/admin/enquiries", async (req, res): Promise<void> => {
  const parsed = ListAdminEnquiriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.status) {
    filters.push(eq(enquiriesTable.status, parsed.data.status));
  }
  if (parsed.data.q) {
    const term = `%${parsed.data.q.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(
      or(
        ilike(enquiriesTable.reference, term),
        ilike(enquiriesTable.name, term),
        ilike(enquiriesTable.contactValue, term),
      )!,
    );
  }
  if (parsed.data.from) {
    filters.push(gte(enquiriesTable.createdAt, new Date(`${parsed.data.from}T00:00:00.000Z`)));
  }
  if (parsed.data.to) {
    filters.push(lte(enquiriesTable.createdAt, new Date(`${parsed.data.to}T23:59:59.999Z`)));
  }
  const rows = await db
    .select()
    .from(enquiriesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(enquiriesTable.createdAt));
  res.json(ListAdminEnquiriesResponse.parse(await adminEnquiries(rows)));
});

router.patch("/admin/enquiries/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminEnquiryParams.safeParse(req.params);
  const parsed = UpdateAdminEnquiryBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [enquiry] = await db
    .update(enquiriesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(enquiriesTable.id, params.data.id))
    .returning();
  if (!enquiry) {
    res.status(404).json({ error: "Enquiry not found." });
    return;
  }
  res.json(UpdateAdminEnquiryResponse.parse(await adminEnquiry(enquiry)));
});

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const settings = await getPrivacySettings();
  res.json(
    GetAdminSettingsResponse.parse({
      enquiryRetentionDays: settings.enquiryRetentionDays,
      updatedAt: settings.updatedAt,
    }),
  );
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await getPrivacySettings();
  const [settings] = await db
    .update(privacySettingsTable)
    .set({
      enquiryRetentionDays: parsed.data.enquiryRetentionDays,
      updatedAt: new Date(),
    })
    .where(eq(privacySettingsTable.id, 1))
    .returning();
  const removedCount = await purgeExpiredEnquiries();
  req.log.info(
    {
      retentionDays: settings.enquiryRetentionDays,
      removedCount,
    },
    "Updated enquiry retention settings",
  );
  res.json(
    UpdateAdminSettingsResponse.parse({
      enquiryRetentionDays: settings.enquiryRetentionDays,
      updatedAt: settings.updatedAt,
    }),
  );
});

export default router;
