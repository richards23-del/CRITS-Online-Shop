import { randomUUID } from "node:crypto";
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
  sql,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  CreateEnquiryBody,
  CreateEnquiryResponse,
  GetProductParams,
  GetProductResponse,
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  RecordAnalyticsEventBody,
} from "@workspace/api-zod";
import {
  analyticsEventsTable,
  categoriesTable,
  db,
  enquiriesTable,
  enquiryItemsTable,
  productsTable,
} from "@workspace/db";

const router: IRouter = Router();
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Please wait before sending another enquiry." },
});
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function fuzzyScore(query: string, fields: string[]): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const fieldWords = fields
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (queryWords.length === 0 || fieldWords.length === 0) return 0;

  const scores = queryWords.map((queryWord) => {
    const best = Math.max(
      ...fieldWords.map(
        (word) =>
          1 -
          editDistance(queryWord, word) /
            Math.max(queryWord.length, word.length, 1),
      ),
    );
    return best;
  });

  return scores.every((score) => score >= 0.54)
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;
}

function publicProduct(
  product: typeof productsTable.$inferSelect,
  categoryName: string,
) {
  return {
    ...product,
    categoryName,
    specifications: product.specifications ?? {},
    imageUrls: product.imageUrls ?? [],
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    q,
    category,
    brand,
    condition,
    availability,
    minPrice,
    maxPrice,
    sort = "featured",
    page = 1,
    pageSize = 12,
    featured,
  } = parsed.data;

  const filters = [
    eq(productsTable.status, "published"),
    eq(categoriesTable.active, true),
  ];
  if (category) filters.push(eq(categoriesTable.slug, category));
  if (brand) filters.push(ilike(productsTable.brand, brand));
  if (condition) filters.push(eq(productsTable.condition, condition));
  if (availability) filters.push(eq(productsTable.availability, availability));
  if (minPrice !== undefined) filters.push(gte(productsTable.priceUgx, minPrice));
  if (maxPrice !== undefined) filters.push(lte(productsTable.priceUgx, maxPrice));
  if (featured !== undefined) filters.push(eq(productsTable.featured, featured));

  const escapedQuery = q?.replace(/[\\%_]/g, "\\$&");
  const searchFilter = escapedQuery
    ? or(
        ilike(productsTable.title, `%${escapedQuery}%`),
        ilike(productsTable.brand, `%${escapedQuery}%`),
        ilike(productsTable.model, `%${escapedQuery}%`),
        ilike(categoriesTable.name, `%${escapedQuery}%`),
      )
    : undefined;
  const where = and(...filters, ...(searchFilter ? [searchFilter] : []));
  const orderBy =
    sort === "price-low"
      ? [asc(productsTable.priceUgx), asc(productsTable.title), asc(productsTable.id)]
      : sort === "price-high"
        ? [desc(productsTable.priceUgx), asc(productsTable.title), asc(productsTable.id)]
        : sort === "newest"
          ? [desc(productsTable.createdAt), desc(productsTable.id)]
          : sort === "popular"
            ? [desc(productsTable.viewCount), desc(productsTable.createdAt), desc(productsTable.id)]
            : [desc(productsTable.featured), desc(productsTable.createdAt), desc(productsTable.id)];

  const [{ value: exactTotal }] = await db
    .select({ value: count() })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(where);

  let items;
  let total = exactTotal;
  if (q && exactTotal === 0) {
    const candidates = await db
      .select({ product: productsTable, categoryName: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(and(...filters))
      .orderBy(...orderBy)
      .limit(500);
    const matches = candidates
      .map((row) => ({
        ...row,
        score: fuzzyScore(q, [
          row.product.title,
          row.product.brand ?? "",
          row.product.model ?? "",
          row.categoryName,
        ]),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    total = matches.length;
    items = matches
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ product, categoryName }) => publicProduct(product, categoryName));
  } else {
    const rows = await db
      .select({ product: productsTable, categoryName: categoriesTable.name })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    items = rows.map(({ product, categoryName }) =>
      publicProduct(product, categoryName),
    );
  }

  res.json(
    ListProductsResponse.parse({
      items,
      page,
      pageSize,
      total,
    }),
  );
});

router.get("/products/:slug", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(productsTable.slug, params.data.slug),
        eq(productsTable.status, "published"),
        eq(categoriesTable.active, true),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const related = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(productsTable.categoryId, row.product.categoryId),
        eq(productsTable.status, "published"),
        eq(categoriesTable.active, true),
      ),
    )
    .orderBy(desc(productsTable.featured), desc(productsTable.viewCount))
    .limit(5);

  res.json(
    GetProductResponse.parse({
      product: publicProduct(row.product, row.categoryName),
      related: related
        .filter(({ product }) => product.id !== row.product.id)
        .slice(0, 4)
        .map(({ product, categoryName }) =>
          publicProduct(product, categoryName),
        ),
    }),
  );
});

router.get("/categories", async (_req, res): Promise<void> => {
  const counts = await db
    .select({ categoryId: productsTable.categoryId, value: count() })
    .from(productsTable)
    .where(eq(productsTable.status, "published"))
    .groupBy(productsTable.categoryId);
  const countsByCategory = new Map(
    counts.map(({ categoryId, value }) => [categoryId, value]),
  );
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.active, true))
    .orderBy(asc(categoriesTable.name));

  res.json(
    ListCategoriesResponse.parse(
      categories.map((categoryRow) => ({
        ...categoryRow,
        productCount: countsByCategory.get(categoryRow.id) ?? 0,
      })),
    ),
  );
});

router.post(
  "/enquiries",
  enquiryLimiter,
  async (req, res): Promise<void> => {
    const parsed = CreateEnquiryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const input = parsed.data;
    if (
      (input.preferredContactMethod === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactValue)) ||
      (input.preferredContactMethod !== "email" &&
        !/^[+()\d\s-]{7,25}$/.test(input.contactValue))
    ) {
      res.status(400).json({
        error:
          input.preferredContactMethod === "email"
            ? "Enter a valid email address."
            : "Enter a valid phone number.",
      });
      return;
    }

    if (
      !input.website?.trim() &&
      input.items.length === 0 &&
      !input.message?.trim()
    ) {
      res.status(400).json({
        error: "Add a message or one or more products to your enquiry.",
      });
      return;
    }

    if (input.website?.trim()) {
      res.status(201).json(
        CreateEnquiryResponse.parse({
          id: 0,
          reference: `CR-${randomUUID().slice(0, 8).toUpperCase()}`,
          createdAt: new Date(),
        }),
      );
      return;
    }

    const quantityByProduct = new Map<number, number>();
    for (const item of input.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productIds = [...quantityByProduct.keys()];
    const selectedProducts =
      productIds.length > 0
        ? await db
            .select()
            .from(productsTable)
            .where(
              and(
                inArray(productsTable.id, productIds),
                eq(productsTable.status, "published"),
              ),
            )
        : [];
    if (selectedProducts.length !== productIds.length) {
      res.status(400).json({
        error: "One or more selected products are no longer available.",
      });
      return;
    }

    const reference = `CR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date();
    const enquiry = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(enquiriesTable)
        .values({
          reference,
          name: input.name.trim(),
          preferredContactMethod: input.preferredContactMethod,
          contactValue: input.contactValue.trim(),
          organisation: input.organisation?.trim() || null,
          locationNotes: input.locationNotes?.trim() || null,
          message: input.message?.trim() || null,
        })
        .returning();

      if (selectedProducts.length > 0) {
        await tx.insert(enquiryItemsTable).values(
          selectedProducts.map((product) => ({
            enquiryId: created.id,
            productId: product.id,
            title: product.title,
            quantity: quantityByProduct.get(product.id) ?? 1,
            priceUgx: product.priceUgx,
          })),
        );
      }

      return created;
    });

    res.status(201).json(
      CreateEnquiryResponse.parse({
        id: enquiry.id,
        reference: enquiry.reference,
        createdAt: enquiry.createdAt ?? createdAt,
      }),
    );
  },
);

router.post(
  "/analytics",
  analyticsLimiter,
  async (req, res): Promise<void> => {
    const parsed = RecordAnalyticsEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { event, productId, query } = parsed.data;
    if (event === "product_view" && productId) {
      await db
        .update(productsTable)
        .set({ viewCount: sql`${productsTable.viewCount} + 1` })
        .where(
          and(
            eq(productsTable.id, productId),
            eq(productsTable.status, "published"),
          ),
        );
    }

    await db.insert(analyticsEventsTable).values({
      event,
      productId: event === "product_view" ? (productId ?? null) : null,
      query: event === "search" ? query?.trim().slice(0, 120) || null : null,
    });
    res.status(204).end();
  },
);

export default router;
